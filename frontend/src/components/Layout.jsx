import { Link, useLocation } from 'react-router-dom'
import { Home, Calendar, User, Globe, LogIn, LogOut, UserPlus, ShieldAlert, Sun, Moon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Layout({ children }) {
    const location = useLocation()
    const { user, logout } = useAuth()
    const { isDarkMode, toggleTheme } = useTheme()

    return (
        <div className="min-h-screen flex flex-col font-sans bg-bg-base text-text-main transition-colors duration-300">


            {/* Main Navigation */}
            <header className="sticky top-0 z-50 bg-bg-base/80 backdrop-blur-xl border-b border-border-main transition-colors duration-300">
                <div className="w-full px-4 sm:px-8 lg:px-12 xl:px-20 h-20 grid grid-cols-2 md:grid-cols-[1fr_auto_1fr] items-center gap-4">

                    {/* Brand */}
                    <div className="flex items-center justify-start z-20">
                        <Link to="/" className="flex items-center gap-3 group">
                            <div className="bg-gradient-to-br from-brand-gradient-1 to-brand-gradient-2 p-2 rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/20 group-hover:shadow-brand-primary/40 transition-all duration-300">
                                <div className="w-4 h-4 border-2 border-bg-base rounded-md transform rotate-45 group-hover:rotate-0 transition-transform duration-500"></div>
                            </div>
                            <h1 className="text-xl font-bold tracking-tight flex">
                                <span className="text-text-main">NEWS</span>
                                <span className="text-brand-primary ml-1">SIMPLE</span>
                            </h1>
                        </Link>
                    </div>

                    {/* Centered Nav Links */}
                    <div className="hidden md:flex justify-center z-10 w-full">
                        {user && (
                            <nav className="flex items-center gap-8 px-8 py-3 bg-bg-hover/50 rounded-full border border-border-main transition-colors duration-300 shadow-sm">
                                <Link to="/" className={`flex items-center gap-2 text-sm font-medium transition-colors ${location.pathname === '/' ? 'text-brand-primary' : 'text-text-muted hover:text-text-main'}`}>
                                    <Home size={16} />
                                    <span>Feed</span>
                                </Link>
                                <Link to="/archive" className={`flex items-center gap-2 text-sm font-medium transition-colors ${location.pathname === '/archive' ? 'text-brand-primary' : 'text-text-muted hover:text-text-main'}`}>
                                    <Calendar size={16} />
                                    <span>Archive</span>
                                </Link>
                                <Link to="/progress" className={`flex items-center gap-2 text-sm font-medium transition-colors ${location.pathname === '/progress' ? 'text-brand-primary' : 'text-text-muted hover:text-text-main'}`}>
                                    <User size={16} />
                                    <span>Progress</span>
                                </Link>
                            </nav>
                        )}
                    </div>
                    {/* Right Actions */}
                    <div className="flex items-center justify-end gap-4 z-20">
                        <button
                            onClick={toggleTheme}
                            className="flex items-center justify-center p-2.5 bg-bg-hover rounded-xl text-text-muted hover:text-brand-primary transition-colors border border-border-main"
                            title="Toggle Theme"
                        >
                            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <button className="hidden sm:flex items-center gap-2 px-3 py-2 bg-bg-hover hover:bg-bg-hover-dark rounded-xl text-sm font-medium text-text-muted transition-colors border border-border-main">
                            <Globe size={16} className="text-text-muted" />
                            <span>EN</span>
                        </button>

                        <div className="w-px h-8 bg-border-main mx-1 hidden sm:block transition-colors duration-300"></div>

                        {user ? (
                            <div className="flex items-center gap-3">
                                <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-bg-hover/50 rounded-xl border border-border-main transition-colors duration-300">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-brand-gradient-1 to-brand-gradient-2 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                                        {user.username.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-medium text-text-main">{user.username}</span>
                                </div>
                                <button onClick={logout} className="p-2.5 bg-bg-hover hover:bg-red-500/10 text-text-muted hover:text-red-500 rounded-xl text-sm transition-colors group border border-border-main">
                                    <LogOut size={18} className="group-hover:-translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Link to="/login" className="flex items-center gap-2 px-4 py-2.5 text-text-muted hover:text-text-main text-sm font-medium transition-colors bg-bg-hover rounded-xl border border-border-main">
                                    <LogIn size={16} />
                                    <span className="hidden sm:inline">Log In</span>
                                </Link>
                                <Link to="/signup" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-gradient-1 to-brand-gradient-2 text-white rounded-xl text-sm font-medium hover:opacity-90 shadow-lg shadow-brand-primary/20 transition-all">
                                    <UserPlus size={16} />
                                    <span className="hidden sm:inline">Sign Up</span>
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Mobile Nav */}
            {user && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg-base/90 backdrop-blur-xl border-t border-border-main pb-safe transition-colors duration-300">
                    <nav className="flex items-center justify-around p-4 h-16">
                        <Link to="/" className={`flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-brand-primary' : 'text-text-muted'}`}>
                            <Home size={20} />
                            <span className="text-[10px] font-medium">Feed</span>
                        </Link>
                        <Link to="/archive" className={`flex flex-col items-center gap-1 ${location.pathname === '/archive' ? 'text-brand-primary' : 'text-text-muted'}`}>
                            <Calendar size={20} />
                            <span className="text-[10px] font-medium">Archive</span>
                        </Link>
                        <Link to="/progress" className={`flex flex-col items-center gap-1 ${location.pathname === '/progress' ? 'text-brand-primary' : 'text-text-muted'}`}>
                            <User size={20} />
                            <span className="text-[10px] font-medium">Progress</span>
                        </Link>
                    </nav>
                </div>
            )}

            <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 md:pb-10 relative z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Decorative Background Glow */}
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vh] bg-brand-primary/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

            <footer className="bg-bg-card border-t border-border-subtle py-12 mt-auto relative z-10 hidden md:block transition-colors duration-300">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-sm font-medium">
                    <p className="text-text-muted">© {new Date().getFullYear()} ClearNews Initiative.</p>
                    <p className="mt-2 text-text-muted/70">Simplified, verified, and accessible public information.</p>
                </div>
            </footer>
        </div>
    )
}
