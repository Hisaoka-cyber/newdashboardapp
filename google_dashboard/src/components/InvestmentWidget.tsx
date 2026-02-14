import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, LineChart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const InvestmentWidget: React.FC = () => {
    const navigate = useNavigate();
    const [watchlist, setWatchlist] = useState<any[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('investment_watchlist');
        if (saved) setWatchlist(JSON.parse(saved).slice(0, 3));
    }, []);

    if (watchlist.length === 0) {
        return (
            <div className="h-48 flex flex-col items-center justify-center text-zinc-400 text-sm space-y-3">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-3xl opacity-50">
                    <LineChart className="w-8 h-8" />
                </div>
                <p>No active investments</p>
                <button
                    onClick={() => navigate('/investment')}
                    className="text-xs font-bold text-emerald-600 hover:underline"
                >
                    Add Tickers →
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                {watchlist.map((stock) => (
                    <div key={stock.symbol} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-3">
                            <div className={`p-1.5 rounded-lg ${stock.change >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                {stock.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            </div>
                            <span className="text-sm font-bold">{stock.symbol}</span>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-black">¥{stock.price.toLocaleString()}</div>
                            <div className={`text-[10px] font-bold ${stock.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <button
                onClick={() => navigate('/investment')}
                className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity"
            >
                View Full Monitor
            </button>
        </div>
    );
};
