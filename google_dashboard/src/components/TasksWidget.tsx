import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { CheckCircle2, Circle, ListPlus } from 'lucide-react';

export const TasksWidget: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (isSignedIn) {
            loadTasks();
        }
    }, [isSignedIn]);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const listResponse = await (gapi.client as any).tasks.tasklists.list({
                maxResults: 10,
            });

            const tasklists = listResponse.result.items;
            if (tasklists && tasklists.length > 0) {
                const response = await (gapi.client as any).tasks.tasks.list({
                    tasklist: tasklists[0].id,
                    showCompleted: false,
                    maxResults: 10,
                });
                setTasks(response.result.items || []);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim() || isAdding) return;

        setIsAdding(true);
        try {
            const listResponse = await (gapi.client as any).tasks.tasklists.list({ maxResults: 1 });
            const tasklistId = listResponse.result.items[0].id;

            await (gapi.client as any).tasks.tasks.insert({
                tasklist: tasklistId,
                resource: {
                    title: newTaskTitle,
                    status: 'needsAction'
                }
            });

            setNewTaskTitle('');
            await loadTasks();
        } catch (error) {
            console.error('Error adding task:', error);
            alert('Failed to add task. Please try again.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleCompleteTask = async (taskId: string) => {
        try {
            const listResponse = await (gapi.client as any).tasks.tasklists.list({ maxResults: 1 });
            const tasklistId = listResponse.result.items[0].id;

            // Optimistic update
            setTasks(prev => prev.filter(t => t.id !== taskId));

            await (gapi.client as any).tasks.tasks.patch({
                tasklist: tasklistId,
                task: taskId,
                resource: {
                    status: 'completed'
                }
            });
        } catch (error) {
            console.error('Error completing task:', error);
            loadTasks(); // Rollback
        }
    };

    if (!isSignedIn) {
        return (
            <div className="h-48 flex items-center justify-center text-zinc-400 italic text-sm">
                Sign in to view and manage your tasks
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <form onSubmit={handleAddTask} className="relative group">
                <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Add a new task..."
                    disabled={isAdding}
                    className="w-full pl-12 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all group-hover:bg-white dark:group-hover:bg-zinc-800 text-sm"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    {isAdding ? (
                        <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <ListPlus className="w-5 h-5 text-zinc-400" />
                    )}
                </div>
            </form>

            <div className="space-y-3">
                {loading && tasks.length === 0 ? (
                    <div className="h-48 flex items-center justify-center space-y-2 flex-col">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-zinc-500 font-medium tracking-tight">Syncing tasks...</span>
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-sm space-y-3">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-3xl opacity-50">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <p className="font-medium">Everything's done!</p>
                    </div>
                ) : (
                    tasks.map((task) => (
                        <div key={task.id} className="group/task flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-2xl hover:bg-white dark:hover:bg-zinc-800 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 transform hover:-translate-y-0.5">
                            <button
                                onClick={() => handleCompleteTask(task.id)}
                                className="text-zinc-300 group-hover/task:text-emerald-500 transition-colors"
                            >
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
                                <button onClick={() => handleCompleteTask(task.id)}>
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 hover:text-emerald-500" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
