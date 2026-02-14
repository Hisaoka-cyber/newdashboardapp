import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { CheckCircle2, Circle, ListPlus, Calendar, Flag, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export const TasksWidget: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDue, setNewTaskDue] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low' | 'None'>('None');
    const [showAdvanced, setShowAdvanced] = useState(false);
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

            const resource: any = {
                title: newTaskTitle,
                status: 'needsAction'
            };

            if (newTaskDue) {
                // Google Tasks API expects RFC 3339 timestamp
                resource.due = new Date(newTaskDue).toISOString();
            }

            if (newTaskPriority !== 'None') {
                resource.notes = `Priority: ${newTaskPriority}`;
            }

            await (gapi.client as any).tasks.tasks.insert({
                tasklist: tasklistId,
                resource: resource
            });

            setNewTaskTitle('');
            setNewTaskDue('');
            setNewTaskPriority('None');
            setShowAdvanced(false);
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

    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm('このタスクを完全に削除しますか？')) return;

        try {
            const listResponse = await (gapi.client as any).tasks.tasklists.list({ maxResults: 1 });
            const tasklistId = listResponse.result.items[0].id;

            // Optimistic update
            setTasks(prev => prev.filter(t => t.id !== taskId));

            await (gapi.client as any).tasks.tasks.delete({
                tasklist: tasklistId,
                task: taskId
            });
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('タスクの削除に失敗しました。');
            loadTasks(); // Rollback
        }
    };

    const getPriorityInfo = (notes?: string) => {
        if (!notes) return null;
        if (notes.includes('Priority: High')) return { label: 'High', color: 'text-red-500 bg-red-50 dark:bg-red-900/10' };
        if (notes.includes('Priority: Medium')) return { label: 'Medium', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/10' };
        if (notes.includes('Priority: Low')) return { label: 'Low', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/10' };
        return null;
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
            <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-sm">
                <form onSubmit={handleAddTask} className="p-2">
                    <div className="relative group">
                        <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Add a new task..."
                            disabled={isAdding}
                            className="w-full pl-12 pr-12 py-4 bg-transparent border-none focus:ring-0 outline-none text-sm font-medium"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                            {isAdding ? (
                                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <ListPlus className="w-5 h-5 text-zinc-400" />
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400"
                        >
                            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    </div>

                    {showAdvanced && (
                        <div className="px-12 pb-4 pt-2 border-t border-zinc-50 dark:border-zinc-800 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Due Date</label>
                                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                                        <Calendar className="w-4 h-4 text-zinc-400" />
                                        <input
                                            type="date"
                                            value={newTaskDue}
                                            onChange={(e) => setNewTaskDue(e.target.value)}
                                            className="bg-transparent border-none p-0 text-xs outline-none w-full"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Priority</label>
                                    <div className="flex gap-1">
                                        {(['High', 'Medium', 'Low', 'None'] as const).map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setNewTaskPriority(p)}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${newTaskPriority === p
                                                    ? p === 'High' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                                        : p === 'Medium' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                                            : p === 'Low' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                                : 'bg-zinc-900 text-white'
                                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600'
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={!newTaskTitle.trim() || isAdding}
                                className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                Add Task
                            </button>
                        </div>
                    )}
                </form>
            </div>

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
                                <div className="flex items-center gap-2 mt-1">
                                    {task.due && (
                                        <span className="flex items-center gap-1 text-[9px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                            <Calendar className="w-2.5 h-2.5" />
                                            {formatDate(task.due)}
                                        </span>
                                    )}
                                    {getPriorityInfo(task.notes) && (
                                        <span className={`flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${getPriorityInfo(task.notes)?.color}`}>
                                            <Flag className="w-2.5 h-2.5" />
                                            {getPriorityInfo(task.notes)?.label}
                                        </span>
                                    )}
                                    {task.notes && !task.notes.includes('Priority:') && (
                                        <p className="text-[10px] text-zinc-400 truncate italic">
                                            {task.notes}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="opacity-0 group-hover/task:opacity-100 transition-opacity flex items-center gap-1">
                                <button
                                    onClick={() => handleCompleteTask(task.id)}
                                    title="Complete"
                                    className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 rounded-lg transition-colors"
                                >
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 hover:text-emerald-500" />
                                </button>
                                <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    title="Delete"
                                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-500" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
