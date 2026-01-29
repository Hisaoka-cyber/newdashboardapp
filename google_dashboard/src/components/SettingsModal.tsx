import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, ExternalLink, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { clientId, setClientId } = useAuth();
    const [inputValue, setInputValue] = useState(clientId);

    if (!isOpen) return null;

    const handleSave = () => {
        setClientId(inputValue);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-blue-500" />
                        Google API Settings
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-500">Google OAuth Client ID</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                            placeholder="000000000000-xxx.apps.googleusercontent.com"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                        <p className="text-xs text-zinc-400 mt-2">
                            You can find this in the <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1">Google Cloud Console <ExternalLink className="w-3 h-3" /></a>
                        </p>
                    </div>

                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl space-y-2">
                        <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400">Required Configuration:</h3>
                        <ul className="text-xs text-amber-700 dark:text-amber-500 list-disc list-inside space-y-1">
                            <li>Add these to <strong>Authorized JavaScript origins</strong>:
                                <ul className="pl-5 mt-1 font-mono text-[10px] space-y-0.5 opacity-80">
                                    <li>http://localhost:5173</li>
                                    <li>http://localhost:5174</li>
                                </ul>
                            </li>
                            <li>Enabled APIs: <strong>Calendar, Drive, Tasks</strong>.</li>
                        </ul>
                    </div>
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-zinc-200 dark:border-zinc-800">
                    <button onClick={onClose} className="px-4 py-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors font-medium">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-bold shadow-lg shadow-blue-500/20">
                        Save & Reconnect
                    </button>
                </div>
            </div>
        </div>
    );
};
