import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { Bell, ArrowRight, CheckCircle2 } from 'lucide-react';

export const DueSoonBanner: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [dueTodayTasks, setDueTodayTasks] = useState<any[]>([]);

    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );

    useEffect(() => {
        if (isSignedIn) {
            fetchDueTodayTasks();
        }
    }, [isSignedIn]);

    const requestNotificationPermission = async () => {
        if (typeof Notification === 'undefined') return;
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
            new Notification('Notifications Enabled!', {
                body: 'You will now receive alerts for your deadlines.',
                icon: '/vite.svg'
            });
        }
    };

    const triggerNotification = (taskCount: number) => {
        if (notificationPermission === 'granted') {
            new Notification('Today\'s Deadlines', {
                body: `You have ${taskCount} tasks due today.`,
                icon: '/vite.svg'
            });
        }
    };

    const fetchDueTodayTasks = async () => {
        try {
            const listResponse = await (gapi.client as any).tasks.tasklists.list({
                maxResults: 10,
            });

            const tasklists = listResponse.result.items;
            if (tasklists && tasklists.length > 0) {
                const response = await (gapi.client as any).tasks.tasks.list({
                    tasklist: tasklists[0].id,
                    showCompleted: false,
                    dueMin: new Date().toISOString(),
                });

                const tasks = response.result.items || [];
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const filtered = tasks.filter((task: any) => {
                    if (!task.due) return false;
                    const dueDate = new Date(task.due);
                    return dueDate >= today && dueDate < tomorrow;
                });

                setDueTodayTasks(filtered);
                if (filtered.length > 0) {
                    triggerNotification(filtered.length);
                }
            }
        } catch (error) {
            console.error('Error fetching due today tasks:', error);
        }
    };

    if (!isSignedIn || dueTodayTasks.length === 0) return null;

    return (
        <div className="relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-rose-500/20 animate-gradient-x" />
            <div className="relative bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-rose-500/30 dark:border-rose-500/20 rounded-3xl p-5 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-2xl shadow-rose-500/10 transition-all duration-500 hover:border-rose-500/50">
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className="relative shrink-0">
                        <div className="absolute inset-0 bg-rose-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <div className="relative w-12 h-12 sm:w-14 h-14 bg-gradient-to-br from-rose-500 to-amber-500 rounded-2xl flex items-center justify-center text-white shadow-lg transform group-hover:scale-110 transition-transform duration-500">
                            <Bell className="w-6 h-6 sm:w-7 h-7 animate-bounce" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            Today's Deadlines
                            <span className="bg-rose-500 text-white text-[8px] sm:text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
                                Priority
                            </span>
                        </h3>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium text-xs sm:text-sm mt-1">
                            You have <span className="text-rose-500 font-bold">{dueTodayTasks.length} tasks</span> due today.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {notificationPermission !== 'granted' && (
                        <button
                            onClick={requestNotificationPermission}
                            className="flex-1 lg:flex-none px-4 sm:px-6 py-3 bg-amber-500 text-white rounded-2xl text-xs sm:text-sm font-black hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                        >
                            <Bell className="w-4 h-4" />
                            Enable Notifications
                        </button>
                    )}
                    <div className="flex -space-x-2 mr-2">
                        {dueTodayTasks.slice(0, 3).map((task, i) => (
                            <div key={task.id} className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-rose-500 shadow-sm" style={{ zIndex: 3 - i }}>
                                {task.title.charAt(0)}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => window.location.hash = '/tasks'}
                        className="flex-1 lg:flex-none group/btn flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl text-xs sm:text-sm font-black hover:bg-rose-500 dark:hover:bg-rose-500 hover:text-white dark:hover:text-white transition-all duration-300 shadow-lg"
                    >
                        Review
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                    <button
                        onClick={fetchDueTodayTasks}
                        className="p-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        title="Refresh"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
