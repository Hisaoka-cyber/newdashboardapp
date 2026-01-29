import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { FileText, Cpu, ExternalLink, HardDrive } from 'lucide-react';

export const DriveWidget: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isSignedIn) {
            loadRecentFiles();
        }
    }, [isSignedIn]);

    const loadRecentFiles = async () => {
        setLoading(true);
        try {
            // Query for recent files, prioritizing notebooks
            const response = await (gapi.client as any).drive.files.list({
                pageSize: 5,
                fields: 'files(id, name, mimeType, webViewLink, iconLink)',
                orderBy: 'viewedByMeTime desc',
                q: "trashed = false",
            });
            setFiles(response.result.files || []);
        } catch (error) {
            console.error('Error fetching Drive files:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isSignedIn) {
        return (
            <div className="h-48 flex items-center justify-center text-zinc-400 italic text-sm">
                Sign in to view your documents
            </div>
        );
    }

    if (loading) {
        return (
            <div className="h-48 flex items-center justify-center space-y-2 flex-col">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-zinc-500 font-medium tracking-tight">Accessing Drive...</span>
            </div>
        );
    }

    if (files.length === 0) {
        return (
            <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-sm space-y-2">
                <HardDrive className="w-8 h-8 opacity-20" />
                <p>No recent files found</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {files.map((file) => {
                const isColab = file.name.endsWith('.ipynb') || file.mimeType === 'application/vnd.google.colab';
                return (
                    <a
                        key={file.id}
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group/file flex items-center gap-4 p-3 rounded-2xl border border-zinc-100 dark:border-zinc-800 hover:border-amber-200 dark:hover:border-amber-900/30 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all duration-300"
                    >
                        <div className={`p-2.5 rounded-xl shrink-0 transition-colors ${isColab ? 'bg-orange-50 dark:bg-orange-900/10' : 'bg-blue-50 dark:bg-blue-900/10'
                            }`}>
                            {isColab ? (
                                <Cpu className="w-5 h-5 text-orange-600" />
                            ) : (
                                <FileText className="w-5 h-5 text-blue-600" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate group-hover/file:text-amber-700 dark:group-hover/file:text-amber-400 transition-colors">
                                {file.name}
                            </p>
                            <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest mt-0.5">
                                {isColab ? 'Colab Notebook' : 'Document'}
                            </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-300 opacity-0 group-hover/file:opacity-100 transition-all" />
                    </a>
                );
            })}
        </div>
    );
};
