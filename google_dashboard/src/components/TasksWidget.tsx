import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { CheckCircle2, Circle, ListPlus } from 'lucide-react';

export const TasksWidget: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isSignedIn) {
            loadTasks();
        }
    }, [isSignedIn]);

    const loadTasks = async () => {
        setLoading(true);
        try {
            // First get the default tasklist
            const listResponse = await (gapi.client as any).tasks.tasklists.list({
                maxResults: 10,
            });

            const tasklists = listResponse.result.items;
            if (tasklists && tasklists.length > 0) {
                const response = await (gapi.client as any).tasks.tasks.list({
                    tasklist: tasklists[0].id,
                    showCompleted: false,
                    maxResults: 5,
                });
                setTasks(response.result.items || []);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isSignedIn) {
        return (
            <div className="h-48 flex items-center justify-center text-zinc-400 italic text-sm">
                Sign in to view your tasks
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-48 flex items-center justify-center space-y-2 flex-col">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-zinc-500 font-medium tracking-tight">Syncing tasks...</span>
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-sm space-y-3">
                <ListPlus className="w-8 h-8 opacity-20" />
                <p>Your to-do list is clean!</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {tasks.map((task) => (
                <div key={task.id} className="group/task flex items-center gap-4 p-3.5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl hover:bg-white dark:hover:bg-zinc-800 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
                    <button className="text-zinc-300 group-hover/task:text-emerald-500 transition-colors">
                        <Circle className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 truncate group-hover/task:text-emerald-600 transition-colors">
                            {task.title}
                        </p>
                        {task.notes && (
                            <p className="text-[10px] text-zinc-400 mt-0.5 truncate italic">
                                {task.notes}
                            </p>
                        )}
                    </div>
                    <div className="opacity-0 group-hover/task:opacity-100 transition-opacity">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 cursor-pointer" />
                    </div>
                </div>
            ))}
        </div>
    );
};
