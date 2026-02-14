import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { Clock, MapPin, Calendar as CalendarIcon, Trash2, ExternalLink, CheckCircle2 } from 'lucide-react';

export const CalendarWidget: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newEventSummary, setNewEventSummary] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (isSignedIn) {
            loadCalendarEvents();
        }
    }, [isSignedIn]);

    const loadCalendarEvents = async () => {
        setLoading(true);
        try {
            // 1. Fetch the list of calendars
            const listResponse = await (gapi.client as any).calendar.calendarList.list();
            const calendars = listResponse.result.items || [];

            // 2. Filter for selected calendars
            const selectedCalendars = calendars.filter((cal: any) => cal.selected);

            // 3. Fetch events for each calendar
            const allEventsPromises = selectedCalendars.map((cal: any) =>
                (gapi.client as any).calendar.events.list({
                    calendarId: cal.id,
                    timeMin: new Date().toISOString(),
                    showDeleted: false,
                    singleEvents: true,
                    maxResults: 10,
                    orderBy: 'startTime',
                }).then((resp: any) => {
                    // Inject calendar name/color for UI
                    // If backgroundColor is missing, generate one from the calendar ID
                    const color = cal.backgroundColor || '#3b82f6';
                    return (resp.result.items || []).map((ev: any) => ({
                        ...ev,
                        calendarName: cal.summaryOverride || cal.summary,
                        calendarColor: color
                    }));
                })
            );

            const eventsByCalendar = await Promise.all(allEventsPromises);

            // 4. Fetch Tasks
            let combinedTasks: any[] = [];
            try {
                if ((gapi.client as any).tasks) {
                    const taskListResponse = await (gapi.client as any).tasks.tasklists.list({ maxResults: 10 });
                    const taskLists = taskListResponse.result.items || [];

                    const allTasksPromises = taskLists.map((list: any) =>
                        (gapi.client as any).tasks.tasks.list({
                            tasklist: list.id,
                            showCompleted: false,
                            showHidden: false,
                        }).then((resp: any) => {
                            const tasks = resp.result.items || [];
                            return tasks.filter((t: any) => t.due).map((t: any) => ({
                                id: t.id,
                                summary: t.title,
                                description: t.notes,
                                start: { dateTime: t.due },
                                end: { dateTime: t.due },
                                isTask: true,
                                calendarName: `Task: ${list.title}`,
                                calendarColor: '#4285F4'
                            }));
                        }).catch((err: any) => {
                            console.error(`Error fetching tasks for list ${list.id}:`, err);
                            return [];
                        })
                    );

                    const tasksByList = await Promise.all(allTasksPromises);
                    combinedTasks = tasksByList.flat();
                }
            } catch (err) {
                console.error('Error fetching task lists:', err);
            }

            // 5. Flatten, filter and sort
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const filteredAll = [...eventsByCalendar.flat(), ...combinedTasks]
                .filter(item => {
                    const startStr = item.start.dateTime || item.start.date;
                    const itemDate = new Date(startStr);
                    return itemDate >= today;
                })
                .sort((a, b) => {
                    const startA = a.start.dateTime || a.start.date;
                    const startB = b.start.dateTime || b.start.date;
                    return new Date(startA).getTime() - new Date(startB).getTime();
                });

            setEvents(filteredAll.slice(0, 30));
        } catch (error) {
            console.error('Error fetching calendar events:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventSummary.trim() || isAdding) return;

        setIsAdding(true);
        try {
            const now = new Date();
            const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
            const end = new Date(start.getTime() + 60 * 60 * 1000); // 2 hours from now

            await (gapi.client as any).calendar.events.insert({
                calendarId: 'primary',
                resource: {
                    summary: newEventSummary,
                    start: { dateTime: start.toISOString() },
                    end: { dateTime: end.toISOString() },
                }
            });

            setNewEventSummary('');
            await loadCalendarEvents();
        } catch (error) {
            console.error('Error adding event:', error);
            alert('Failed to add event. Please try again.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteEvent = async (event: any) => {
        const isTask = event.isTask;
        if (!window.confirm(`Are you sure you want to delete this ${isTask ? 'task' : 'event'}?`)) return;

        try {
            if (isTask) {
                // We need the tasklist ID. For simplicity, we search for it or just use the first one if we don't store it.
                // In a real app, you'd store the tasklistId on the task object.
                // Let's assume the first tasklist for now or refetch.
                const listResponse = await (gapi.client as any).tasks.tasklists.list({ maxResults: 10 });
                const tasklist = listResponse.result.items.find((l: any) => `Task: ${l.title}` === event.calendarName);
                const tasklistId = tasklist ? tasklist.id : listResponse.result.items[0].id;

                await (gapi.client as any).tasks.tasks.delete({
                    tasklist: tasklistId,
                    task: event.id,
                });
            } else {
                await (gapi.client as any).calendar.events.delete({
                    calendarId: 'primary',
                    eventId: event.id,
                });
            }
            // Optimistic update
            setEvents(prev => prev.filter(e => e.id !== event.id));
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Failed to delete item.');
            loadCalendarEvents();
        }
    };

    if (!isSignedIn) {
        return (
            <div className="h-48 flex items-center justify-center text-zinc-400 italic text-sm">
                Sign in to view and manage your schedule
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <form onSubmit={handleAddEvent} className="relative flex-1 group">
                    <input
                        type="text"
                        value={newEventSummary}
                        onChange={(e) => setNewEventSummary(e.target.value)}
                        placeholder="Quick add event..."
                        disabled={isAdding}
                        className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all group-hover:bg-white dark:group-hover:bg-zinc-800 text-sm"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        {isAdding ? (
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <CalendarIcon className="w-5 h-5 text-zinc-400" />
                        )}
                    </div>
                </form>

                <a
                    href="https://calendar.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-sm hover:shadow-blue-500/20"
                    title="Open Google Calendar"
                >
                    <ExternalLink className="w-5 h-5" />
                </a>
            </div>

            <div className="space-y-4">
                {loading && events.length === 0 ? (
                    <div className="h-48 flex items-center justify-center space-y-2 flex-col">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-zinc-500 font-medium tracking-tight">Syncing events...</span>
                    </div>
                ) : events.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-sm space-y-2">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-3xl opacity-50">
                            <CalendarIcon className="w-8 h-8" />
                        </div>
                        <p>No upcoming events found</p>
                    </div>
                ) : (
                    events.map((event) => {
                        const start = event.start.dateTime || event.start.date;
                        const date = new Date(start);
                        // Subtly tint the background with the calendar color
                        const bgColor = event.calendarColor ? `${event.calendarColor}15` : undefined; // 15 is ~8% opacity in hex
                        const borderColor = event.calendarColor || '#3b82f6';

                        return (
                            <div
                                key={event.id}
                                className="group/item flex items-center gap-4 p-4 rounded-2xl transition-all border-l-4 hover:shadow-xl hover:shadow-blue-500/5"
                                style={{
                                    backgroundColor: bgColor,
                                    borderLeftColor: borderColor,
                                    borderTopColor: 'transparent',
                                    borderRightColor: 'transparent',
                                    borderBottomColor: 'transparent',
                                    borderStyle: 'solid',
                                    borderWidth: '0 0 0 4px'
                                }}
                            >
                                <div
                                    className="flex flex-col items-center justify-center w-12 h-12 rounded-xl shrink-0 group-hover/item:scale-105 transition-transform duration-300"
                                    style={{ backgroundColor: `${borderColor}25` }} // 25 is ~15% opacity
                                >
                                    <span
                                        className="text-[10px] font-black uppercase tracking-tighter line-height-none"
                                        style={{ color: borderColor }}
                                    >
                                        {date.toLocaleDateString('en-US', { month: 'short' })}
                                    </span>
                                    <span
                                        className="text-lg font-black leading-none"
                                        style={{ color: borderColor }}
                                    >
                                        {date.getDate()}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm truncate group-hover/item:text-blue-500 transition-colors">
                                        {event.isTask && <CheckCircle2 className="w-4 h-4 inline-block mr-2 text-blue-500" />}
                                        {event.summary}
                                    </h4>
                                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {event.calendarName && (
                                            <span className="flex items-center gap-1 opacity-80 border-l border-zinc-200 dark:border-zinc-700 pl-2">
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: event.calendarColor }}
                                                />
                                                {event.calendarName}
                                            </span>
                                        )}
                                        {event.location && (
                                            <span className="flex items-center gap-1 truncate max-w-[120px]">
                                                <MapPin className="w-3 h-3" />
                                                {event.location}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteEvent(event)}
                                    className="opacity-0 group-hover/item:opacity-100 p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                    title="Delete item"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
