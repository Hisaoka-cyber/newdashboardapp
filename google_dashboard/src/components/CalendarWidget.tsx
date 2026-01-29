import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { Clock, MapPin, Calendar as CalendarIcon, Trash2, ExternalLink } from 'lucide-react';

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
            const response = await (gapi.client as any).calendar.events.list({
                calendarId: 'primary',
                timeMin: new Date().toISOString(),
                showDeleted: false,
                singleEvents: true,
                maxResults: 10,
                orderBy: 'startTime',
            });
            setEvents(response.result.items || []);
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

    const handleDeleteEvent = async (eventId: string) => {
        if (!window.confirm('Are you sure you want to delete this event?')) return;

        try {
            await (gapi.client as any).calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId,
            });
            // Optimistic update
            setEvents(prev => prev.filter(e => e.id !== eventId));
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Failed to delete event.');
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
                        return (
                            <div key={event.id} className="group/item flex items-center gap-4 p-4 rounded-2xl hover:bg-white dark:hover:bg-zinc-800 transition-all border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800 hover:shadow-xl hover:shadow-blue-500/5">
                                <div className="flex flex-col items-center justify-center w-12 h-12 bg-blue-50 dark:bg-blue-900/10 rounded-xl shrink-0 group-hover/item:scale-105 transition-transform duration-300">
                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter line-height-none">
                                        {date.toLocaleDateString('en-US', { month: 'short' })}
                                    </span>
                                    <span className="text-lg font-black text-blue-700 leading-none">
                                        {date.getDate()}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-sm truncate group-hover/item:text-blue-500 transition-colors">{event.summary}</h4>
                                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {event.location && (
                                            <span className="flex items-center gap-1 truncate max-w-[120px]">
                                                <MapPin className="w-3 h-3" />
                                                {event.location}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteEvent(event.id)}
                                    className="opacity-0 group-hover/item:opacity-100 p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                    title="Delete event"
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
