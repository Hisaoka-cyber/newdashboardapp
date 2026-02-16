import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { gapi } from 'gapi-script';
import { FileText, Loader2, AlertCircle, ExternalLink, RefreshCw, Download, FileSpreadsheet, Target, Trophy, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';

export const PointsPage: React.FC = () => {
    const { isSignedIn } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [excelFile, setExcelFile] = useState<any>(null);
    const [pdfFiles, setPdfFiles] = useState<any[]>([]);
    const [currentPoints, setCurrentPoints] = useState<number | null>(null);
    const requiredPoints = 60;

    const fetchPointsData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Search for folder named "勉強会参加証明書"
            const folderResponse = await (gapi.client as any).drive.files.list({
                q: "name = '勉強会参加証明書' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
                fields: 'files(id, name)',
                pageSize: 1
            });

            const folders = folderResponse.result.files;
            if (!folders || folders.length === 0) {
                setError("Google Drive内に「勉強会参加証明書」フォルダが見つかりませんでした。");
                setLoading(false);
                return;
            }

            const folderId = folders[0].id;

            // 2. Fetch all files in the folder
            const filesResponse = await (gapi.client as any).drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, webViewLink, webContentLink, mimeType, iconLink, modifiedTime)',
                orderBy: 'name',
            });

            const allFiles = filesResponse.result.files || [];

            // 3. Separate Excel and PDF files
            const excel = allFiles.find((f: any) => f.name === 'ポイント管理エクセル.xlsx');
            const pdfs = allFiles.filter((f: any) => f.mimeType === 'application/pdf');

            setExcelFile(excel);
            setPdfFiles(pdfs);

            // 4. Extract points from Excel if found
            if (excel) {
                try {
                    const response = await (gapi.client as any).drive.files.get({
                        fileId: excel.id,
                        alt: 'media',
                    });

                    // Convert response body to array buffer
                    const buffer = new Uint8Array(response.body.length);
                    for (let i = 0; i < response.body.length; i++) {
                        buffer[i] = response.body.charCodeAt(i);
                    }

                    const workbook = XLSX.read(buffer, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];

                    // Get value from C17
                    const cellC17 = worksheet['C17'];
                    const points = cellC17 ? (typeof cellC17.v === 'number' ? cellC17.v : parseFloat(cellC17.v)) : 0;

                    setCurrentPoints(isNaN(points) ? 0 : points);
                } catch (excelErr) {
                    console.error('Error parsing Excel for points:', excelErr);
                    // Fallback or handle error
                }
            } else {
                setCurrentPoints(null);
            }

            if (!excel && pdfs.length === 0) {
                setError("「勉強会参加証明書」フォルダ内にファイルが見つかりませんでした。");
            }
        } catch (err: any) {
            console.error('Error fetching points data:', err);
            setError(`エラーが発生しました: ${err?.result?.error?.message || '不明なエラー'}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isSignedIn) {
            fetchPointsData();
        }
    }, [isSignedIn, fetchPointsData]);

    if (!isSignedIn) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-zinc-400" />
                <p className="text-zinc-500">Googleアカウントにサインインしてポイント管理を表示してください。</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex items-center justify-between shrink-0">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-amber-600">
                        <FileSpreadsheet className="w-8 h-8" />
                        <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">ポイント管理</h2>
                    </div>
                    <p className="text-zinc-500">勉強会参加ポイントと証明書を一覧で確認できます。</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchPointsData}
                        disabled={loading}
                        className="p-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
                        title="再読み込み"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* Points Summary Section */}
            {!loading && !error && currentPoints !== null && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-1000 delay-200">
                    <div className="md:col-span-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-8 text-white shadow-xl shadow-amber-500/20 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="space-y-4 flex-1">
                                <div className="flex items-center gap-2 text-amber-100">
                                    <Trophy className="w-5 h-5" />
                                    <span className="text-sm font-black uppercase tracking-widest">現在の進捗状況</span>
                                </div>
                                <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-100">有効期限</span>
                                    <span className="text-xs font-bold">2027.03.31</span>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-6xl font-black tabular-nums">{currentPoints}</span>
                                        <span className="text-xl font-bold text-amber-100">/ {requiredPoints} ポイント</span>
                                    </div>
                                    <p className="text-amber-100/80 font-medium">
                                        目標達成まであと <span className="text-white font-bold">{Math.max(0, requiredPoints - currentPoints)}</span> ポイントです。
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-4 w-full bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                                        <div
                                            className="h-full bg-white transition-all duration-1000 ease-out"
                                            style={{ width: `${Math.min(100, (currentPoints / requiredPoints) * 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs font-black text-amber-100 tracking-wider">
                                        <span>0%</span>
                                        <span>{Math.round((currentPoints / requiredPoints) * 100)}% 達成</span>
                                        <span>100%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 min-w-[160px]">
                                <Target className="w-10 h-10 mb-2 opacity-80" />
                                <span className="text-sm font-bold opacity-80 uppercase tracking-tighter">目標点数</span>
                                <span className="text-4xl font-black">{requiredPoints}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 shadow-sm flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                                <TrendingUp className="w-6 h-6 text-emerald-500" />
                            </div>
                            <h3 className="font-black text-lg text-zinc-900 dark:text-zinc-100">ステータス</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                <span className="text-zinc-500 font-bold">達成度</span>
                                <span className={`font-black p-1.5 px-3 rounded-lg text-xs tracking-tighter ${currentPoints >= requiredPoints
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                    {currentPoints >= requiredPoints ? '目標達成！' : '進行中'}
                                </span>
                            </div>
                            <p className="text-zinc-500 text-sm leading-relaxed px-1">
                                {currentPoints >= requiredPoints
                                    ? 'おめでとうございます！目標のポイントに到達しました。'
                                    : '引き続き、勉強会に参加してポイントを積み上げていきましょう。'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 flex-1 min-h-0">
                {/* Excel Preview Section */}
                <div className="xl:col-span-2 flex flex-col space-y-4 min-h-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-wider text-zinc-400">Excelプレビュー</h3>
                        {excelFile && (
                            <a
                                href={excelFile.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Googleスプレッドシートで開く
                            </a>
                        )}
                    </div>
                    <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden relative shadow-sm">
                        {loading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm z-10">
                                <Loader2 className="w-10 h-10 text-amber-600 animate-spin mb-4" />
                                <p className="text-zinc-500 font-medium">Driveを検索中...</p>
                            </div>
                        ) : error ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                                <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl">
                                    <AlertCircle className="w-8 h-8 text-red-500" />
                                </div>
                                <p className="text-zinc-800 dark:text-zinc-200 font-bold">{error}</p>
                            </div>
                        ) : excelFile ? (
                            <iframe
                                src={excelFile.webViewLink.replace('/view', '/preview')}
                                className="w-full h-full border-0"
                                title="ポイント管理Excelプレビュー"
                                allow="autoplay"
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-400 italic space-y-4">
                                <FileSpreadsheet className="w-12 h-12 opacity-20" />
                                <p>「ポイント管理.xlsx」が見つかりませんでした。</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* PDF Certificates List Section */}
                <div className="flex flex-col space-y-4 min-h-0">
                    <h3 className="text-sm font-black uppercase tracking-wider text-zinc-400">参加証明書 (PDF)</h3>
                    <div className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {pdfFiles.length > 0 ? (
                            pdfFiles.map((pdf) => (
                                <div
                                    key={pdf.id}
                                    className="group flex items-center gap-3 p-3 rounded-2xl border border-zinc-50 dark:border-zinc-800 hover:border-amber-200 dark:hover:border-amber-900/30 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all"
                                >
                                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                        <FileText className="w-5 h-5 text-red-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate text-zinc-700 dark:text-zinc-200">
                                            {pdf.name}
                                        </p>
                                        <p className="text-[10px] text-zinc-400 mt-0.5">
                                            {new Date(pdf.modifiedTime).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a
                                            href={pdf.webViewLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-blue-500 transition-colors"
                                            title="表示"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <a
                                            href={pdf.webContentLink}
                                            className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-emerald-500 transition-colors"
                                            title="ダウンロード"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            ))
                        ) : !loading && (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-400 italic space-y-4">
                                <FileText className="w-12 h-12 opacity-20" />
                                <p>PDFファイルが見つかりませんでした。</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
