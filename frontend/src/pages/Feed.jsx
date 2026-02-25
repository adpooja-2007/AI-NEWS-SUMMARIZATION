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
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
        const token = localStorage.getItem('token')

        fetch(`${baseUrl}/api/articles`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-primary"></div>
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto transition-colors duration-300">
            {/* Header Section */}
            <div className="text-center sm:text-left mb-6">
                <div className="flex items-center gap-2 text-text-muted font-semibold mb-3">
                    <CalendarDays size={18} />
                    <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-text-main">
                    Today's <span className="bg-gradient-to-r from-brand-gradient-1 to-brand-gradient-2 bg-clip-text text-transparent">Simplified</span> News
                </h2>
                <p className="text-lg text-text-muted font-medium max-w-2xl">
                    Real-time news from across the globe, rewritten in simple language for easy understanding.
                </p>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-bg-card p-2.5 rounded-2xl shadow-sm border border-border-main flex flex-col md:flex-row items-center justify-between gap-4 mb-8 transition-colors duration-300">
                <div className="relative w-full md:w-1/2 flex items-center">
                    <Search className="absolute left-4 h-5 w-5 text-text-muted" />
                    <input
                        type="text"
                        placeholder="Search news articles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-bg-hover border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-brand-primary/50 placeholder-text-muted text-text-main transition-all"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                    {uniqueGenres.map(genre => (
                        <button
                            key={genre}
                            onClick={() => setSelectedGenre(genre)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${selectedGenre === genre
                                ? 'bg-gradient-to-r from-brand-gradient-1 to-brand-gradient-2 text-white shadow-md shadow-brand-primary/20'
                                : 'bg-bg-hover text-text-muted hover:text-text-main border border-transparent hover:border-border-main'
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
                    className="border-2 border-dashed border-border-main rounded-3xl p-10 mt-8 text-center flex flex-col items-center justify-center bg-bg-card/50 backdrop-blur-sm transition-colors duration-300"
                >
                    <p className="text-red-500 font-bold text-lg mb-5">
                        The news server is currently offline. Showing local news instead.
                    </p>
                    <button
                        onClick={fetchArticles}
                        className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:opacity-90 transition-all shadow-sm"
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
                    className="bg-bg-card border-2 border-dashed border-border-main rounded-2xl p-12 text-center text-text-muted transition-colors duration-300"
                >
                    <Search size={48} className="mx-auto text-text-muted/50 mb-4" />
                    <h3 className="text-2xl font-bold text-text-main mb-2">No matches found</h3>
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
                                        className="group bg-bg-card rounded-2xl p-6 sm:p-8 border-2 border-border-main hover:border-brand-primary shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
                                    >
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-text-muted mb-3">
                                                <span className="flex items-center gap-1.5 bg-brand-secondary text-brand-primary px-3 py-1 rounded-full border border-brand-primary/20 uppercase tracking-wide text-xs transition-colors">
                                                    {article.genre || 'General'}
                                                </span>
                                                <span className="flex items-center gap-1.5 bg-bg-hover px-3 py-1 rounded-full border border-border-main transition-colors">
                                                    📅 {article.date}
                                                </span>
                                                <span className="flex items-center gap-1.5 bg-bg-hover px-3 py-1 rounded-full border border-border-main transition-colors">
                                                    <Clock size={16} /> ~{article.read_time_min} min read
                                                </span>
                                                <span className="flex items-center gap-1.5 bg-green-500/10 text-green-500 px-3 py-1 rounded-full border border-green-500/20 transition-colors">
                                                    <ShieldCheck size={16} /> Grade {article.readability_score.toFixed(1)}
                                                </span>
                                            </div>
                                            <h3 className="text-2xl font-bold text-text-main leading-snug group-hover:text-brand-primary transition-colors">
                                                {article.headline}
                                            </h3>
                                        </div>
                                        <div className="hidden sm:flex bg-bg-hover border border-border-main p-3 rounded-full group-hover:bg-brand-secondary group-hover:text-brand-primary transition-colors duration-300">
                                            <ChevronRight size={24} className="text-text-muted group-hover:text-brand-primary" />
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
