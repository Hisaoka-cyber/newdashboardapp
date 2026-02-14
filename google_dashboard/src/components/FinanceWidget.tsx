import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';

interface Transaction {
    id: string;
    date: string;
    item: string;
    amount: number;
    type: 'income' | 'expense';
}

export const FinanceWidget: React.FC = () => {
    const [balance, setBalance] = useState(0);
    const [income, setIncome] = useState(0);
    const [expense, setExpense] = useState(0);

    useEffect(() => {
        const loadData = () => {
            const savedData = localStorage.getItem('kakeibo_data');
            if (savedData) {
                const transactions: Transaction[] = JSON.parse(savedData);
                const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

                const monthTransactions = transactions.filter(t => t.date.startsWith(currentMonth));

                const totalIncome = monthTransactions
                    .filter(t => t.type === 'income')
                    .reduce((sum, t) => sum + t.amount, 0);

                const totalExpense = monthTransactions
                    .filter(t => t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0);

                setIncome(totalIncome);
                setExpense(totalExpense);
                setBalance(totalIncome - totalExpense);
            }
        };

        loadData();
        // Listen for storage events (in case updated in another tab or page)
        window.addEventListener('storage', loadData);
        // Custom event for same-page updates
        window.addEventListener('kakeibo_update', loadData);

        return () => {
            window.removeEventListener('storage', loadData);
            window.removeEventListener('kakeibo_update', loadData);
        };
    }, []);

    return (
        <div className="space-y-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-between">
                <div>
                    <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-1">Current Balance</p>
                    <p className={`text-2xl font-black ${balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        ¥{balance.toLocaleString()}
                    </p>
                </div>
                <div className={`p-3 rounded-full ${balance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    <Wallet className="w-6 h-6" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Income</span>
                    </div>
                    <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">¥{income.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <span className="text-[10px] font-bold text-red-600 uppercase">Expense</span>
                    </div>
                    <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">¥{expense.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
};
