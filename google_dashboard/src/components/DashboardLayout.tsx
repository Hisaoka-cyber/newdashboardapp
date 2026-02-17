import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard,
    Calendar,
    CheckSquare,
    FileText,
    Cpu,
    Settings,
    LogOut,
    LogIn,
    Moon,
    Sun,
    Menu,
    X,
    Loader2,
    TrendingUp
} from 'lucide-react';
import { SettingsModal } from './SettingsModal';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const { isSignedIn, user, signIn, signOut, isSigningIn, error } = useAuth();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 flex">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed lg:sticky top-0 inset-y-0 left-0 z-40 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="p-8 flex items-center justify-between">
                        <Link to="/" className="text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-2">
                            <Cpu className="w-8 h-8 text-blue-600" />
                            WORKPAL
                        </Link>
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className="p-2 lg:hidden hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    <nav className="flex-1 px-4 space-y-1.5 mt-2 overflow-y-auto custom-scrollbar">
                        <NavItem to="/" icon={<LayoutDashboard />} label="Dashboard" active={location.pathname === '/'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                        <NavItem to="/calendar" icon={<Calendar />} label="Calendar" active={location.pathname === '/calendar'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                        <NavItem to="/tasks" icon={<CheckSquare />} label="To-Do" active={location.pathname === '/tasks'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                        <NavItem to="/documents" icon={<FileText />} label="Documents" active={location.pathname === '/documents'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                        <NavItem to="/colab" icon={<Cpu />} label="Colab" active={location.pathname === '/colab'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                        <NavItem to="/attendance" icon={<FileText />} label="勤務表" active={location.pathname === '/attendance'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                        <NavItem to="/points" icon={<TrendingUp />} label="ポイント管理" active={location.pathname === '/points'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                        <NavItem to="/minutes" icon={<FileText />} label="議事録" active={location.pathname === '/minutes'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                        <NavItem to="/finance" icon={<Calendar />} label="Finance" active={location.pathname === '/finance'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                        <NavItem to="/investment" icon={<TrendingUp />} label="Investment" active={location.pathname === '/investment'} onClick={() => { if (window.innerWidth < 1024) setIsSidebarOpen(false); }} />
                    </nav>

                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                        <button
                            onClick={() => {
                                setIsSettingsOpen(true);
                                if (window.innerWidth < 1024) setIsSidebarOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <Settings className="w-5 h-5 text-zinc-500" />
                            Settings
                        </button>

                        {isSignedIn ? (
                            <button
                                onClick={() => {
                                    signOut();
                                    if (window.innerWidth < 1024) setIsSidebarOpen(false);
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                            >
                                <LogOut className="w-5 h-5" />
                                Sign Out
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <button
                                    onClick={signIn}
                                    disabled={isSigningIn}
                                    className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-black rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {isSigningIn ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Signing In...
                                        </>
                                    ) : (
                                        <>
                                            <LogIn className="w-5 h-5" />
                                            Sign In
                                        </>
                                    )}
                                </button>
                                {error && (
                                    <p className="text-[10px] text-red-500 px-2 font-medium bg-red-50 dark:bg-red-900/10 py-1.5 rounded-lg border border-red-100 dark:border-red-900/20 animate-in fade-in slide-in-from-top-1">
                                        {error}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 min-h-screen">
                {/* Header */}
                <header className="sticky top-0 z-20 h-20 flex items-center justify-between px-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-3 lg:hidden hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl text-zinc-600 dark:text-zinc-400 transition-colors"
                        >
                            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <div className="lg:hidden h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
                        <h1 className="text-lg font-black tracking-tight hidden sm:block">
                            {location.pathname === '/' ? 'Dashboard' :
                                location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2)}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <button className="p-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all duration-300">
                            <Sun className="w-5 h-5 dark:hidden" />
                            <Moon className="w-5 h-5 hidden dark:block" />
                        </button>

                        {user && (
                            <div className="flex items-center gap-3 pl-4 border-l border-zinc-200 dark:border-zinc-800">
                                <div className="text-right hidden sm:block">
                                    <div className="text-sm font-black text-zinc-900 dark:text-zinc-100 leading-none">{user.getName()}</div>
                                    <div className="text-[10px] text-zinc-500 mt-1">{user.getEmail()}</div>
                                </div>
                                <img src={user.getImageUrl()} alt="Profile" className="w-10 h-10 rounded-2xl ring-2 ring-blue-500/10 object-cover" />
                            </div>
                        )}
                    </div>
                </header>

                <main className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto">
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </div>
    );
};

const NavItem = ({ to, icon, label, active = false, onClick }: { to: string, icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
    <Link to={to} onClick={onClick} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 group ${active ? 'bg-blue-600/10 text-blue-600' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'}`}>
        <span className={`transition-transform duration-200 group-hover:scale-110 ${active ? 'text-blue-600' : ''}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { size: 22 })}
        </span>
        <span className="font-semibold text-sm">{label}</span>
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600 shadow-sm shadow-blue-500/50" />}
    </Link>
);
