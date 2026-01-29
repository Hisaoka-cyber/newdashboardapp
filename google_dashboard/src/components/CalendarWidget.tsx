import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { Clock, MapPin, Calendar as CalendarIcon } from 'lucide-react';

export const CalendarWidget: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

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
                maxResults: 5,
                orderBy: 'startTime',
            });
            setEvents(response.result.items || []);
        } catch (error) {
            console.error('Error fetching calendar events:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isSignedIn) {
        return (
            <div className="h-48 flex items-center justify-center text-zinc-400 italic text-sm">
                Sign in to view your schedule
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-48 flex items-center justify-center space-y-2 flex-col">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-zinc-500 font-medium tracking-tight">Syncing events...</span>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-sm space-y-2">
                <CalendarIcon className="w-8 h-8 opacity-20" />
                <p>No upcoming events found</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {events.map((event) => {
                const start = event.start.dateTime || event.start.date;
                const date = new Date(start);
                return (
                    <div key={event.id} className="group/item flex gap-4 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800">
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
                    </div>
                );
            })}
        </div>
    );
};
