import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Bell, Plus, Trash2, LineChart, AlertCircle, RefreshCcw } from 'lucide-react';

interface StockData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    history: number[];
    ma25?: number;
}

interface Alert {
    id: string;
    symbol: string;
    type: 'price_above' | 'price_below' | 'ma25_touch';
    target: number;
    active: boolean;
}

export const InvestmentPage: React.FC = () => {
    const [watchlist, setWatchlist] = useState<StockData[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [newSymbol, setNewSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<any[]>([]);

    // Initial load
    useEffect(() => {
        const savedWatchlist = localStorage.getItem('investment_watchlist');
        const savedAlerts = localStorage.getItem('investment_alerts');
        if (savedWatchlist) setWatchlist(JSON.parse(savedWatchlist));
        if (savedAlerts) setAlerts(JSON.parse(savedAlerts));
    }, []);

    // Persist data
    useEffect(() => {
        localStorage.setItem('investment_watchlist', JSON.stringify(watchlist));
        localStorage.setItem('investment_alerts', JSON.stringify(alerts));
    }, [watchlist, alerts]);

    const API_KEY = import.meta.env.VITE_FINANCE_API_KEY;

    const handleSearch = async (query: string) => {
        if (!query || !API_KEY) return;
        setLoading(true);
        setError(null);
        try {
            const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${API_KEY}`;
            const resp = await fetch(url);
            const data = await resp.json();
            if (data['Note'] || data['Information']) {
                setError('API rate limit reached. Please wait a minute before searching again.');
                return;
            }
            setSearchResults(data['bestMatches'] || []);
        } catch (err) {
            console.error('Search error:', err);
            setError('Failed to search for symbols.');
        } finally {
            setLoading(false);
        }
    };

    const fetchStockData = async (symbol: string): Promise<StockData> => {
        if (!API_KEY) {
            // Fallback to simulation if no API key
            return new Promise<StockData>((resolve) => {
                setTimeout(() => {
                    const basePrice = Math.random() * 10000 + 1000;
                    const history = Array.from({ length: 30 }, () => basePrice + (Math.random() - 0.5) * 500);
                    const currentPrice = history[history.length - 1];
                    const prevPrice = history[history.length - 2];
                    const ma25 = history.slice(-25).reduce((a, b) => a + b, 0) / 25;
                    resolve({
                        symbol: symbol.toUpperCase(),
                        price: currentPrice,
                        change: currentPrice - prevPrice,
                        changePercent: ((currentPrice - prevPrice) / prevPrice) * 100,
                        history,
                        ma25
                    });
                }, 800);
            });
        }

        const tryFetch = async (ticker: string) => {
            const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${API_KEY}`;
            const quoteResp = await fetch(quoteUrl);
            const quoteData = await quoteResp.json();

            console.log(`API Response for ${ticker} (Quote):`, quoteData); // Log API response

            if (quoteData['Note'] || quoteData['Information']) {
                throw new Error('API rate limit reached (5 calls/min). Please wait a moment.');
            }

            const quote = quoteData['Global Quote'];
            if (quote && quote['05. price']) return { quote, ticker };
            return null;
        };

        try {
            let inputSymbol = symbol.toUpperCase().trim();
            let result = await tryFetch(inputSymbol);

            // Fallback strategy for Japanese stocks
            if (!result && /^\d{4}$/.test(inputSymbol)) {
                await new Promise(r => setTimeout(r, 1200)); // Rate limit safety
                result = await tryFetch(`${inputSymbol}.T`);
                if (!result) {
                    await new Promise(r => setTimeout(r, 1200));
                    result = await tryFetch(`${inputSymbol}.TYO`);
                }
            }

            if (!result) {
                throw new Error(`Symbol "${inputSymbol}" not found. Try searching by name above.`);
            }

            const { quote, ticker } = result;

            // Get History
            const historyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${API_KEY}`;
            const historyResp = await fetch(historyUrl);
            const historyData = await historyResp.json();
            console.log(`API Response for ${ticker} (History):`, historyData); // Log API response
            const series = historyData['Time Series (Daily)'];

            let history: number[] = [];
            let ma25 = 0;

            if (series) {
                const dates = Object.keys(series).sort().reverse().slice(0, 30);
                history = dates.map(d => parseFloat(series[d]['4. close'])).reverse();
                if (history.length >= 25) {
                    ma25 = history.slice(-25).reduce((a, b) => a + b, 0) / 25;
                }
            }

            return {
                symbol: inputSymbol, // Keep original input for display
                price: parseFloat(quote['05. price']),
                change: parseFloat(quote['09. change']),
                changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
                history,
                ma25: ma25 || undefined
            };
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    };

    const handleAddSymbol = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSymbol || watchlist.some(s => s.symbol === newSymbol.toUpperCase())) return;

        setLoading(true);
        setError(null);
        try {
            const data = await fetchStockData(newSymbol);
            setWatchlist(prev => [...prev, data]);
            setNewSymbol('');
        } catch (err: any) {
            console.error('Error adding symbol:', err);
            setError(err.message || 'Failed to fetch stock data. Check your API key or symbol.');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveSymbol = (symbol: string) => {
        setWatchlist(prev => prev.filter(s => s.symbol !== symbol));
        setAlerts(prev => prev.filter(a => a.symbol !== symbol));
    };

    const toggleAlert = (id: string) => {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
    };

    const addAlert = (symbol: string, type: Alert['type'], target: number) => {
        const newAlert: Alert = {
            id: Math.random().toString(36).substr(2, 9),
            symbol,
            type,
            target,
            active: true
        };
        setAlerts(prev => [...prev, newAlert]);
    };

    // Request notification permission
    useEffect(() => {
        if (Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    // Monitoring loop
    useEffect(() => {
        const interval = setInterval(async () => {
            if (watchlist.length === 0) return;
            try {
                // To stay within free tier (5 calls/min), we fetch sequentially if needed
                // or just increase the interval significantly.
                const updatedWatchlist = [];
                for (const stock of watchlist) {
                    const data = await fetchStockData(stock.symbol);
                    checkAlerts(data);
                    updatedWatchlist.push(data);
                    // Minimal delay between calls to be safe
                    await new Promise(r => setTimeout(r, 1000));
                }
                setWatchlist(updatedWatchlist);
            } catch (err) {
                console.error('Monitoring loop error:', err);
            }
        }, 300000); // Check every 5 minutes to respect free tier limits

        return () => clearInterval(interval);
    }, [watchlist, alerts]);

    const checkAlerts = (stock: StockData) => {
        alerts.forEach(alert => {
            if (!alert.active || alert.symbol !== stock.symbol) return;

            let triggered = false;
            let message = '';

            if (alert.type === 'price_above' && stock.price >= alert.target) {
                triggered = true;
                message = `Price Alert: ${stock.symbol} is above ¥${alert.target.toLocaleString()}`;
            } else if (alert.type === 'price_below' && stock.price <= alert.target) {
                triggered = true;
                message = `Price Alert: ${stock.symbol} is below ¥${alert.target.toLocaleString()}`;
            } else if (alert.type === 'ma25_touch') {
                const threshold = stock.price * 0.005; // 0.5% proximity
                if (stock.ma25 && Math.abs(stock.price - stock.ma25) <= threshold) {
                    triggered = true;
                    message = `MA25 Alert: ${stock.symbol} is touching the 25-day average (¥${stock.ma25.toLocaleString()})`;
                }
            }

            if (triggered) {
                sendNotification(message);
                setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, active: false } : a));
            }
        });
    };

    const sendNotification = (message: string) => {
        if (Notification.permission === 'granted') {
            new Notification('Workpal Investment Alert', {
                body: message,
                icon: '/vite.svg'
            });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-3xl font-black">Investment Monitor</h2>
                        {!import.meta.env.VITE_FINANCE_API_KEY && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-[10px] font-bold rounded-md uppercase tracking-wide">
                                Simulation Mode
                            </span>
                        )}
                        {import.meta.env.VITE_FINANCE_API_KEY && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded-md uppercase tracking-wide">
                                Real Data Active
                            </span>
                        )}
                    </div>
                    <p className="text-zinc-500 mt-1">Track CFD prices, Japanese stocks, and MA25 alerts.</p>
                </div>
                <form onSubmit={handleAddSymbol} className="flex gap-2">
                    <div className="relative flex-1">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newSymbol}
                                onChange={(e) => setNewSymbol(e.target.value)}
                                placeholder="Ticker or Name (e.g. Toyota)"
                                className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm w-full md:w-64"
                            />
                            <button
                                type="button"
                                onClick={() => handleSearch(newSymbol)}
                                disabled={loading || !newSymbol}
                                className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50"
                                title="Search for symbols"
                            >
                                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto">
                                <div className="p-2 border-b border-zinc-100 dark:border-zinc-800 text-[9px] font-bold text-zinc-400 uppercase tracking-widest bg-zinc-50 dark:bg-zinc-800/50">Search Results</div>
                                {searchResults.map((match: any) => (
                                    <button
                                        key={match['1. symbol']}
                                        type="button"
                                        onClick={() => {
                                            setNewSymbol(match['1. symbol']);
                                            setSearchResults([]);
                                        }}
                                        className="w-full text-left px-4 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 border-b border-zinc-100 dark:border-zinc-800 last:border-0 transition-all group"
                                    >
                                        <div className="text-xs font-black group-hover:text-emerald-600 transition-colors">{match['1. symbol']}</div>
                                        <div className="text-[10px] text-zinc-500 truncate">{match['2. name']} ({match['4. region']})</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="p-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
                    >
                        {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    </button>
                </form>
            </header>

            {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium flex items-center gap-2 animate-in fade-in zoom-in-95">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-4">
                    {watchlist.length === 0 ? (
                        <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center text-zinc-400">
                            <LineChart className="w-12 h-12 mx-auto opacity-20 mb-4" />
                            <p>No tickers in your watchlist. Add one to get started.</p>
                        </div>
                    ) : (
                        watchlist.map((stock) => (
                            <div key={stock.symbol} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 hover:shadow-xl hover:shadow-emerald-500/5 transition-all">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl ${stock.change >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                            {stock.change >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold">{stock.symbol}</h3>
                                            <p className="text-xs text-zinc-500 font-medium tracking-tight">MA25: ¥{stock.ma25?.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black">¥{stock.price.toLocaleString()}</div>
                                        <div className={`text-sm font-bold ${stock.change >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)} ({stock.changePercent.toFixed(2)}%)
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-zinc-50 dark:border-zinc-800">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => addAlert(stock.symbol, 'ma25_touch', stock.ma25 || 0)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                                        >
                                            <Bell className="w-3.5 h-3.5" />
                                            Set MA25 Alert
                                        </button>
                                        <button
                                            onClick={() => addAlert(stock.symbol, 'price_above', stock.price * 1.05)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                                        >
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            +5% Alert
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveSymbol(stock.symbol)}
                                        className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-zinc-900 text-white rounded-3xl p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Bell className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-bold">Active Alerts</h3>
                        </div>
                        <div className="space-y-3">
                            {alerts.length === 0 ? (
                                <p className="text-sm text-zinc-500 italic">No active alerts.</p>
                            ) : (
                                alerts.map(alert => (
                                    <div key={alert.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-2xl border border-zinc-700/50">
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-widest text-emerald-400">{alert.symbol}</div>
                                            <div className="text-sm font-bold mt-0.5">
                                                {alert.type === 'ma25_touch' ? 'MA25 Touch' : alert.type === 'price_above' ? `Above ¥${alert.target.toLocaleString()}` : `Below ¥${alert.target.toLocaleString()}`}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleAlert(alert.id)}
                                            className={`w-10 h-6 rounded-full transition-all relative ${alert.active ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${alert.active ? 'right-1' : 'left-1'}`} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
                        <div className="flex items-center gap-2 mb-4 text-emerald-600">
                            <AlertCircle className="w-5 h-5" />
                            <h3 className="font-bold">Pro Tip</h3>
                        </div>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                            価格が25日移動平均線（MA25）にタッチした時にブラウザの通知が届きます。アプリを別のタブで開いたままにしておくことをお勧めします。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
