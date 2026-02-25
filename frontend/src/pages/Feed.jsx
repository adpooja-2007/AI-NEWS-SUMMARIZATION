import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Newspaper, ChevronRight, Clock, ShieldCheck, Search, CalendarDays, RefreshCw, FolderOpen, AlertCircle, XCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function Feed() {
    const [articles, setArticles] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedGenre, setSelectedGenre] = useState('All')
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [serverOffline, setServerOffline] = useState(false)
    const [uniqueGenres, setUniqueGenres] = useState(['All'])
    const { user } = useAuth()
    const { t, language } = useLanguage()

    useEffect(() => {
        fetchArticles()
    }, [language, currentPage])

    const fetchArticles = () => {
        setLoading(true)
        setServerOffline(false)
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
        const token = localStorage.getItem('token')
        const limit = 12 // Matches backend default, or could be adjusted

        // Build the query string dynamically
        const queryParams = new URLSearchParams({
            lang: language,
            page: currentPage,
            limit: limit
        })

        if (searchQuery) queryParams.append('search', searchQuery)
        if (selectedGenre !== 'All') queryParams.append('genre', selectedGenre)

        fetch(`${baseUrl}/api/articles?${queryParams.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                // Handle the new paginated response format
                const articlesData = data.articles || []
                setArticles(articlesData)
                setTotalPages(data.pagination ? data.pagination.total_pages : 1)
                setLoading(false)

                if (articlesData.length === 0 && currentPage === 1) {
                    // Only show offline warning if empty on the first page
                    setServerOffline(true)
                }
            })
            .catch(err => {
                console.error("Failed to fetch articles", err)
                // Don't flag offline just for a bad page request unless it's page 1
                if (currentPage === 1) setServerOffline(true)
                setLoading(false)
            })
    }
    // Fetch available genres on mount
    useEffect(() => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
        const token = localStorage.getItem('token')

        fetch(`${baseUrl}/api/genres`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.genres) {
                    setUniqueGenres(data.genres)
                }
            })
            .catch(err => console.error("Failed to fetch genres", err))
    }, [])
    // Reset page to 1 when search or genre changes
    useEffect(() => {
        setCurrentPage(1)
        // We need to fetch articles again when search/genre changes, so we add a specific effect for this or trigger it
    }, [searchQuery, selectedGenre])

    // Fetch when search or genre changes (with a slight debounce if typing)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchArticles()
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [searchQuery, selectedGenre])

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
                    {t('todaysNews')} <span className="bg-gradient-to-r from-brand-gradient-1 to-brand-gradient-2 bg-clip-text text-transparent">{t('simplifiedNews')}</span> {t('newsSuffix')}
                </h2>
                <p className="text-lg text-text-muted font-medium max-w-2xl">
                    {t('realTimeDesc')}
                </p>
            </div>

            {/* Ultra-Premium Search and Filter Hero */}
            <div className="relative z-10 mb-16 max-w-4xl mx-auto flex flex-col items-center gap-6">
                {/* Search Input - Floating & Glowing */}
                <div className="relative w-full group">
                    {/* Dynamic glowing background behind the search bar */}
                    <div className="absolute -inset-1.5 bg-gradient-to-r from-brand-gradient-1 via-brand-secondary to-brand-gradient-2 rounded-[2.5rem] blur-md opacity-20 group-focus-within:opacity-40 transition-opacity duration-500"></div>

                    <div className="relative flex items-center bg-bg-card border border-border-main rounded-[2rem] shadow-2xl p-2 sm:p-3 transition-colors duration-300">
                        <div className="pl-4 pr-2">
                            <Search className="h-6 w-6 text-brand-primary" />
                        </div>
                        <input
                            type="text"
                            placeholder={t('searchArticles')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-none text-lg sm:text-xl font-semibold text-text-main placeholder-text-muted/60 focus:ring-0 outline-none px-2 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="mr-4 p-2 rounded-full hover:bg-bg-hover text-text-muted hover:text-red-500 transition-colors"
                            >
                                <XCircle size={22} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Categories - Minimalist Wrapping Pills */}
                <div className="w-full relative">
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-2 pb-4 pt-2">
                        {uniqueGenres.map(genre => {
                            const isActive = selectedGenre === genre;
                            // Remove spaces to match translation keys, e.g. "World News" -> "WorldNews"
                            const translationKey = `genre_${genre.replace(/ /g, '')}`;
                            const displayGenre = t(translationKey) || genre;

                            return (
                                <button
                                    key={genre}
                                    onClick={() => setSelectedGenre(genre)}
                                    className={`relative px-5 py-2 sm:px-6 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300
                                        ${isActive
                                            ? 'text-white shadow-xl shadow-brand-primary/25 scale-[1.02]'
                                            : 'text-text-muted bg-bg-card hover:bg-bg-hover hover:text-text-main border border-border-main hover:border-brand-primary/30 shadow-sm'
                                        }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeCategoryPill"
                                            className="absolute inset-0 bg-gradient-to-r from-brand-gradient-1 to-brand-gradient-2 rounded-full -z-10"
                                            initial={false}
                                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                                        />
                                    )}
                                    <span className="relative z-10">{displayGenre}</span>
                                </button>
                            );
                        })}
                    </div>
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
            {!serverOffline && articles.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-bg-card border-2 border-dashed border-border-main rounded-2xl p-12 text-center text-text-muted transition-colors duration-300"
                >
                    <Search size={48} className="mx-auto text-text-muted/50 mb-4" />
                    <h3 className="text-2xl font-bold text-text-main mb-2">No matches found</h3>
                    <p className="text-lg">{t('noArticlesMatch')}</p>
                </motion.div>
            ) : (
                <div className="grid gap-6">
                    <AnimatePresence>
                        {articles.map((article) => (
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
                                                {article.is_available === false && (
                                                    <span className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-3 py-1 rounded-full border border-red-500/20 uppercase tracking-wide text-xs transition-colors">
                                                        <AlertCircle size={14} /> {t('translationUnavailable')}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1.5 bg-brand-secondary text-brand-primary px-3 py-1 rounded-full border border-brand-primary/20 uppercase tracking-wide text-xs transition-colors">
                                                    {article.genre || 'General'}
                                                </span>
                                                <span className="flex items-center gap-1.5 bg-bg-hover px-3 py-1 rounded-full border border-border-main transition-colors">
                                                    📅 {article.date}
                                                </span>
                                                <span className="flex items-center gap-1.5 bg-bg-hover px-3 py-1 rounded-full border border-border-main transition-colors">
                                                    <Clock size={16} /> ~{article.read_time_min} {t('minRead')}
                                                </span>
                                                <span className="flex items-center gap-1.5 bg-green-500/10 text-green-500 px-3 py-1 rounded-full border border-green-500/20 transition-colors">
                                                    <ShieldCheck size={16} /> {t('grade')} {article.readability_score.toFixed(1)}
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

            {/* Pagination Controls */}
            {!serverOffline && totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-12 bg-bg-card border border-border-main p-4 rounded-2xl mx-auto w-fit transition-colors duration-300">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1 || loading}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${currentPage === 1 || loading
                            ? 'opacity-50 cursor-not-allowed bg-bg-hover text-text-muted'
                            : 'bg-brand-primary text-white hover:shadow-lg shadow-brand-primary/20'
                            }`}
                    >
                        Previous
                    </button>
                    <span className="text-text-main font-semibold px-4">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages || loading}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${currentPage === totalPages || loading
                            ? 'opacity-50 cursor-not-allowed bg-bg-hover text-text-muted'
                            : 'bg-brand-primary text-white hover:shadow-lg shadow-brand-primary/20'
                            }`}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}
