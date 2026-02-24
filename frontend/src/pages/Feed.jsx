import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Newspaper, ChevronRight, Clock, ShieldCheck, Search, CalendarDays, RefreshCw } from 'lucide-react'

export default function Feed() {
    const [articles, setArticles] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGenre, setSelectedGenre] = useState('All')
    const [serverOffline, setServerOffline] = useState(false)

    useEffect(() => {
        fetchArticles()
    }, [])

    const fetchArticles = () => {
        setLoading(true)
        setServerOffline(false)
        fetch('http://localhost:8080/api/articles')
            .then(res => res.json())
            .then(data => {
                setArticles(data)
                setLoading(false)
                if (data.length === 0) {
                    setServerOffline(true)
                }
            })
            .catch(err => {
                console.error("Failed to fetch articles", err)
                setServerOffline(true)
                setLoading(false)
            })
    }

    // Default genres shown in the UI mockup if db is empty
    const defaultGenres = ['All', 'Politics', 'Health', 'Sports', 'Education', 'Technology']
    const uniqueGenres = articles.length > 0
        ? ['All', ...new Set(articles.map(a => a.genre || 'General'))]
        : defaultGenres

    const filteredArticles = articles.filter(article => {
        const matchesSearch = article.headline.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesGenre = selectedGenre === 'All' || article.genre === selectedGenre
        return matchesSearch && matchesGenre
    })

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#1e3a8a]"></div>
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Header Section */}
            <div className="text-center sm:text-left mb-6">
                <div className="flex items-center gap-2 text-slate-500 font-semibold mb-3">
                    <CalendarDays size={18} />
                    <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-[#1e3a8a]">
                    Today's <span className="text-[#60a5fa]">Simplified</span> News
                </h2>
                <p className="text-lg text-slate-600 font-medium max-w-2xl">
                    Real-time news from across the globe, rewritten in simple language for easy understanding.
                </p>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div className="relative w-full md:w-1/2 flex items-center">
                    <Search className="absolute left-4 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search news articles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-[#1e3a8a]/20 placeholder-slate-400 text-slate-700 transition-all"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                    {uniqueGenres.map(genre => (
                        <button
                            key={genre}
                            onClick={() => setSelectedGenre(genre)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${selectedGenre === genre
                                ? 'bg-[#1e3a8a] text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            {genre}
                        </button>
                    ))}
                </div>
            </div>

            {/* Offline/Error State */}
            {serverOffline && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-2 border-dashed border-slate-200 rounded-3xl p-10 mt-8 text-center flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm"
                >
                    <p className="text-[#ef4444] font-bold text-lg mb-5">
                        The news server is currently offline. Showing local news instead.
                    </p>
                    <button
                        onClick={fetchArticles}
                        className="flex items-center gap-2 bg-[#1e3a8a] text-white px-6 py-2.5 rounded-lg font-bold hover:bg-[#1e3a8a]/90 transition-colors shadow-sm"
                    >
                        <RefreshCw size={18} />
                        Retry Connection
                    </button>
                </motion.div>
            )}

            {/* Content Area */}
            {!serverOffline && filteredArticles.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500"
                >
                    <Search size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-2xl font-bold text-slate-700 mb-2">No matches found</h3>
                    <p className="text-lg">Try adjusting your search terms or selecting a different genre.</p>
                </motion.div>
            ) : (
                <div className="grid gap-6">
                    <AnimatePresence>
                        {filteredArticles.map((article) => (
                            <motion.div
                                key={article.id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                            >
                                <Link to={`/article/${article.id}`}>
                                    <div
                                        className="group bg-white rounded-2xl p-6 sm:p-8 border-2 border-slate-200 hover:border-[#1e3a8a] shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
                                    >
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-slate-500 mb-3">
                                                <span className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-200 uppercase tracking-wide text-xs">
                                                    {article.genre || 'General'}
                                                </span>
                                                <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full">
                                                    📅 {article.date}
                                                </span>
                                                <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full">
                                                    <Clock size={16} /> ~{article.read_time_min} min read
                                                </span>
                                                <span className="flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full">
                                                    <ShieldCheck size={16} /> Grade {article.readability_score.toFixed(1)}
                                                </span>
                                            </div>
                                            <h3 className="text-2xl font-bold text-slate-900 leading-snug group-hover:text-[#1e3a8a] transition-colors">
                                                {article.headline}
                                            </h3>
                                        </div>
                                        <div className="hidden sm:flex bg-slate-50 p-3 rounded-full group-hover:bg-[#ebf5ff] group-hover:text-[#60a5fa] transition-colors">
                                            <ChevronRight size={24} />
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}
