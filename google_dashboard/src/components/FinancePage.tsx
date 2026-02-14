import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Save, RefreshCw, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { gapi } from 'gapi-script';
import * as XLSX from 'xlsx';

interface Transaction {
    id: string;
    date: string;
    item: string;
    amount: number;
    type: 'income' | 'expense';
}

export const FinancePage: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [newItem, setNewItem] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newType, setNewType] = useState<'income' | 'expense'>('expense');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('kakeibo_last_sync'));
    const [syncError, setSyncError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'excel'>('dashboard');
    const [excelUrl, setExcelUrl] = useState<string | null>(localStorage.getItem('kakeibo_excel_url'));

    useEffect(() => {
        const savedData = localStorage.getItem('kakeibo_data');
        if (savedData) {
            setTransactions(JSON.parse(savedData));
        }
    }, []);

    const saveTransactions = (data: Transaction[]) => {
        setTransactions(data);
        localStorage.setItem('kakeibo_data', JSON.stringify(data));
        // Dispatch custom event for widget update
        window.dispatchEvent(new Event('kakeibo_update'));
    };

    const handleSync = useCallback(async () => {
        setIsSyncing(true);
        setSyncError(null);
        try {
            // 1. Search for "家計簿.xlsx"
            const response = await (gapi.client as any).drive.files.list({
                q: "name = '家計簿.xlsx' and trashed = false",
                fields: 'files(id, name, modifiedTime, webViewLink)',
                pageSize: 1
            });

            const files = response.result.files;
            if (!files || files.length === 0) {
                throw new Error('Google Drive内に「家計簿.xlsx」が見つかりませんでした。');
            }

            const fileId = files[0].id;
            const webLink = files[0].webViewLink;

            if (webLink) {
                const previewLink = webLink.replace('/view', '/preview');
                setExcelUrl(previewLink);
                localStorage.setItem('kakeibo_excel_url', previewLink);
            }

            // 2. Download the file via fetch for better binary handling
            // NOTE: We skip gapi.client.drive.files.get for media because fetch is more reliable for ArrayBuffer in some environments.

            // GAPI returns the data in different formats depending on how it was requested.
            // When using alt=media, we might need to handle the response body.
            // Using fetch with the access token is often more reliable for binary data.
            const accessToken = gapi.auth.getToken().access_token;
            const fetchResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            });

            const buffer = await fetchResponse.arrayBuffer();

            // 3. Parse Excel
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Expected format: JSON array of objects
            // Columns should match: Date, Item, Amount, Type
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const importedTransactions: Transaction[] = jsonData.map((row: any, index: number) => {
                // Heuristic to match columns
                return {
                    id: `excel-${index}-${Date.now()}`,
                    date: row.Date || row['日付'] || new Date().toISOString().split('T')[0],
                    item: row.Item || row['項目'] || row['名前'] || 'Unnamed Item',
                    amount: parseInt(row.Amount || row['金額'] || 0),
                    type: ((row.Type || row['種類'] || '').toLowerCase().includes('income') || (row.Type || row['種類'] || '') === '収入' ? 'income' : 'expense') as 'income' | 'expense'
                };
            }).filter(t => t.item !== 'Unnamed Item');

            if (importedTransactions.length > 0) {
                saveTransactions(importedTransactions);
                const syncTime = new Date().toLocaleString();
                setLastSync(syncTime);
                localStorage.setItem('kakeibo_last_sync', syncTime);
            } else {
                throw new Error('Excelファイルから有効なデータが見つかりませんでした。');
            }
        } catch (err: any) {
            console.error('Excel sync error:', err);
            setSyncError(err.message || '同期中にエラーが発生しました。');
        } finally {
            setIsSyncing(false);
        }
    }, [transactions]);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem || !newAmount) return;

        const transaction: Transaction = {
            id: Date.now().toString(),
            date: newDate,
            item: newItem,
            amount: parseInt(newAmount),
            type: newType
        };

        const updated = [transaction, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        saveTransactions(updated);

        setNewItem('');
        setNewAmount('');
    };

    const handleDelete = (id: string) => {
        const updated = transactions.filter(t => t.id !== id);
        saveTransactions(updated);
    };

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthTransactions = transactions.filter(t => t.date.startsWith(currentMonth));

    const totalIncome = monthTransactions
        .filter((t: Transaction) => t.type === 'income')
        .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    const totalExpense = monthTransactions
        .filter((t: Transaction) => t.type === 'expense')
        .reduce((sum: number, t: Transaction) => sum + t.amount, 0);

    const balance = totalIncome - totalExpense;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 text-emerald-600 mb-2">
                            <Wallet className="w-8 h-8" />
                            <h2 className="text-3xl font-black text-zinc-900 dark:text-zinc-100">Finance</h2>
                        </div>
                        <p className="text-zinc-500">Manage your household income and expenses.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Excel Sync</p>
                            <p className="text-xs font-bold text-zinc-500">{lastSync ? `Updated: ${lastSync}` : 'Never synced'}</p>
                        </div>
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                            {isSyncing ? 'Syncing...' : 'Sync with Drive'}
                        </button>
                    </div>
                </div>
                {syncError && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 rounded-xl flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p>{syncError}</p>
                    </div>
                )}
            </header>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'dashboard' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
                >
                    Dashboard
                </button>
                <button
                    onClick={() => setActiveTab('excel')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'excel' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-zinc-400 hover:text-zinc-600'}`}
                >
                    Full Excel View
                </button>
            </div>

            {activeTab === 'dashboard' ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2">Balance (This Month)</p>
                                <p className={`text-3xl font-black ${balance >= 0 ? 'text-zinc-900 dark:text-zinc-100' : 'text-red-500'}`}>
                                    ¥{balance.toLocaleString()}
                                </p>
                            </div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 p-6 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-2">Income</p>
                                <p className="text-3xl font-black text-emerald-600">
                                    ¥{totalIncome.toLocaleString()}
                                </p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-emerald-400" />
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-6 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-xs text-red-600 font-bold uppercase tracking-wider mb-2">Expenses</p>
                                <p className="text-3xl font-black text-red-600">
                                    ¥{totalExpense.toLocaleString()}
                                </p>
                            </div>
                            <TrendingDown className="w-8 h-8 text-red-400" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Input Form */}
                        <div className="lg:col-span-1">
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sticky top-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Plus className="w-5 h-5" />
                                    Add Transaction
                                </h3>
                                <form onSubmit={handleAdd} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={newDate}
                                            onChange={(e) => setNewDate(e.target.value)}
                                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Type</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setNewType('expense')}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${newType === 'expense' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
                                            >
                                                Expense
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewType('income')}
                                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${newType === 'income' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}
                                            >
                                                Income
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Item Name</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g., Lunch, Salary"
                                            value={newItem}
                                            onChange={(e) => setNewItem(e.target.value)}
                                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Amount (¥)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            placeholder="0"
                                            value={newAmount}
                                            onChange={(e) => setNewAmount(e.target.value)}
                                            className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                    >
                                        <Save className="w-4 h-4" />
                                        Save
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Transaction List */}
                        <div className="lg:col-span-2">
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 min-h-[500px]">
                                <h3 className="text-lg font-bold mb-6">Recent Transactions</h3>
                                <div className="space-y-3">
                                    {transactions.length === 0 ? (
                                        <div className="text-center py-20 text-zinc-400">
                                            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p>No transactions yet.</p>
                                        </div>
                                    ) : (
                                        transactions.map((t) => (
                                            <div key={t.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl group hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-3 rounded-full ${t.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                                        {t.type === 'income' ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{t.item}</p>
                                                        <p className="text-xs text-zinc-500">{t.date}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`font-bold font-mono ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {t.type === 'income' ? '+' : '-'}¥{t.amount.toLocaleString()}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDelete(t.id)}
                                                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden h-[700px] shadow-sm relative animate-in fade-in zoom-in-95 duration-500">
                    {excelUrl ? (
                        <iframe
                            src={excelUrl}
                            className="w-full h-full border-0"
                            title="Excel Preview"
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4 text-zinc-400">
                            <FileSpreadsheet className="w-16 h-16 opacity-20" />
                            <p>Excelファイルが同期されていません。<br />「Sync with Drive」ボタンを押して同期してください。</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
