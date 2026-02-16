import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { FileText, Loader2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

export const AttendancePage: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pdfFile, setPdfFile] = useState<any>(null);

    const fetchLatestAttendance = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Search for folder named "勤務表"
            const folderResponse = await (gapi.client as any).drive.files.list({
                q: "name = '勤務表' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
                fields: 'files(id, name)',
                pageSize: 1
            });

            const folders = folderResponse.result.files;
            if (!folders || folders.length === 0) {
                setError("Google Drive内に「勤務表」フォルダが見つかりませんでした。");
                setLoading(false);
                return;
            }

            const folderId = folders[0].id;

            // 2. Search for latest PDF in that folder
            const fileResponse = await (gapi.client as any).drive.files.list({
                q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
                fields: 'files(id, name, webViewLink, iconLink, modifiedTime)',
                orderBy: 'modifiedTime desc',
                pageSize: 1
            });

            const files = fileResponse.result.files;
            if (!files || files.length === 0) {
                setError("「勤務表」フォルダ内にPDFファイルが見つかりませんでした。");
            } else {
                setPdfFile(files[0]);
            }
        } catch (err: any) {
            console.error('Error fetching attendance:', err);
            setError(`エラーが発生しました: ${err?.result?.error?.message || '不明なエラー'}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isSignedIn) {
            fetchLatestAttendance();
        }
    }, [isSignedIn, fetchLatestAttendance]);

    if (!isSignedIn) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-zinc-400" />
                <p className="text-zinc-500">Googleアカウントにサインインして勤務表を表示してください。</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex items-center justify-between shrink-0">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-indigo-600">
                        <FileText className="w-8 h-8" />
                        <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">勤務表</h2>
                    </div>
                    <p className="text-zinc-500">Drive上の「勤務表」フォルダから最新のPDFを表示しています。</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchLatestAttendance}
                        disabled={loading}
                        className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
                        title="再読み込み"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {pdfFile && (
                        <a
                            href={pdfFile.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                        >
                            <ExternalLink className="w-4 h-4" />
                            <span className="hidden sm:inline">Driveで開く</span>
                        </a>
                    )}
                </div>
            </header>

            <div className="flex-1 min-h-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden relative shadow-sm">
                {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm z-10">
                        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                        <p className="text-zinc-500 font-medium">Driveを検索中...</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl">
                            <AlertCircle className="w-8 h-8 text-red-500" />
                        </div>
                        <p className="text-zinc-800 dark:text-zinc-200 font-bold">{error}</p>
                        <p className="text-sm text-zinc-500 max-w-md">
                            Google Driveのルートディレクトリに「勤務表」という名前のフォルダを作成し、その中に勤務表のPDFをアップロードしてください。
                        </p>
                    </div>
                ) : pdfFile ? (
                    <iframe
                        src={pdfFile.webViewLink.replace('/view', '/preview')}
                        className="w-full h-full border-0"
                        title="勤務表プレビュー"
                        allow="autoplay"
                    />
                ) : (
                    <div className="h-full flex items-center justify-center text-zinc-400 italic">
                        ファイルを選択してください。
                    </div>
                )}
            </div>
        </div>
    );
};
