import { Link, useLocation } from 'react-router-dom'
import { Home, Calendar, User, Globe, Mic } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Layout({ children }) {
    const location = useLocation()

    return (
        <div className="min-h-screen flex flex-col font-sans bg-slate-50">
            <div className="bg-[#1e3a8a] text-white text-[10px] font-bold text-center py-1.5 tracking-widest uppercase">
                PRODUCTION ENVIRONMENT ACTIVE • STABILITY MODE
            </div>
            <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="bg-[#1e3a8a] p-1.5 rounded flex items-center justify-center">
                            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight flex">
                            <span className="text-[#1e3a8a]">NEWS</span>
                            <span className="text-[#60a5fa]">SIMPLE</span>
                        </h1>
                    </Link>

                    <nav className="flex items-center gap-6 text-sm font-semibold text-slate-600">
                        <Link to="/" className="flex items-center gap-2 hover:text-slate-900 transition-colors">
                            <Home size={18} />
                            <span>Home</span>
                        </Link>
                        <Link to="/archive" className="flex items-center gap-2 hover:text-slate-900 transition-colors">
                            <Calendar size={18} />
                            <span>Archive</span>
                        </Link>
                        <Link to="/admin" className="flex items-center gap-2 hover:text-slate-900 transition-colors">
                            <User size={18} />
                            <span>Progress</span>
                        </Link>
                    </nav>

                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold text-slate-700 transition-colors">
                            <Globe size={16} />
                            <span>English</span>
                        </button>
                        <button className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-700 transition-colors">
                            <Mic size={18} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                    {children}
                </motion.div>
            </main>

            <footer className="bg-slate-900 text-slate-400 py-10 mt-auto">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center text-sm font-medium">
                    <p>© {new Date().getFullYear()} ClearNews Initiative.</p>
                    <p className="mt-2">Simplified, verified, and accessible public information.</p>
                </div>
            </footer>
        </div>
    )
}
