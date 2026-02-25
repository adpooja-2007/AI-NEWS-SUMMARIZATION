import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart3, AlertCircle, FileText, Activity, ShieldCheck, Clock, BookOpen, CheckCircle, Target } from 'lucide-react'

export default function AdminDashboard() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchStats = () => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
        const token = localStorage.getItem('token')

        fetch(`${baseUrl}/api/user/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                setStats(data)
                setLoading(false)
            })
            .catch(err => {
                console.error("Failed to fetch admin stats", err)
                setLoading(false)
            })
    }

    useEffect(() => {
        fetchStats()
    }, [])

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-primary"></div>
            </div>
        )
    }

    const formatDate = (isoString) => {
        if (!isoString || isoString === "Now") return "Just now"
        const date = new Date(isoString)
        if (isNaN(date.getTime())) return "Recently"
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
    }

    return (
        <div className="space-y-12 transition-colors duration-300">
            <Link to="/" className="inline-flex items-center gap-2 text-text-muted hover:text-brand-primary font-semibold transition-colors">
                <ArrowLeft size={20} /> Back to Platform
            </Link>

            <div className="text-center sm:text-left">
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-text-main mb-4 flex items-center justify-center sm:justify-start gap-4 transition-colors">
                    <Activity className="text-brand-primary" size={40} /> Your Progress
                </h2>
                <p className="text-xl text-text-muted font-medium transition-colors max-w-2xl">
                    Track your reading history, analyze your comprehension scores, and witness your growth.
                </p>
            </div>

            {/* Top Level Aggregate Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    icon={<FileText />}
                    label="Articles Read"
                    value={stats?.articles_read || 0}
                />
                <MetricCard
                    icon={<ShieldCheck />}
                    label="Platform Articles"
                    value={`${stats?.global_total_articles || 0}`}
                    success
                />
                <MetricCard
                    icon={<BarChart3 />}
                    label="Avg Quiz Score"
                    value={`${stats?.avg_score || 0}%`}
                    highlight
                />
                <MetricCard
                    icon={<AlertCircle />}
                    label="Avg Reading Level"
                    value={`Grade ${stats?.avg_readability || 0}`}
                    highlight
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
                {/* Left Column: Reading History */}
                <div className="bg-bg-card border border-border-main rounded-3xl p-6 sm:p-8 shadow-sm transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 bg-brand-secondary rounded-xl">
                            <BookOpen className="text-brand-primary" size={24} />
                        </div>
                        <h3 className="text-2xl font-black text-text-main tracking-tight">Reading History</h3>
                    </div>

                    {!stats?.reading_history || stats.reading_history.length === 0 ? (
                        <div className="text-center py-12 px-4 border-2 border-dashed border-border-main rounded-2xl">
                            <BookOpen size={40} className="mx-auto text-text-muted/50 mb-3" />
                            <p className="text-text-muted font-medium text-lg">No articles read yet.</p>
                            <p className="text-sm text-text-muted/70 mt-1">Start exploring the feed to build your history.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {stats.reading_history.map((item, index) => (
                                <motion.div
                                    key={`read-${index}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group flex gap-4 p-4 rounded-2xl hover:bg-bg-hover border border-transparent hover:border-border-main transition-all duration-300"
                                >
                                    <div className="hidden sm:flex flex-col items-center mt-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-brand-primary shadow-[0_0_10px_rgba(var(--brand-primary),0.5)]"></div>
                                        {index !== stats.reading_history.length - 1 && (
                                            <div className="w-0.5 h-full bg-border-main mt-2 group-hover:bg-brand-primary/20 transition-colors"></div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <Link to={`/article/${item.article_id}`} className="block">
                                            <h4 className="text-lg font-bold text-text-main group-hover:text-brand-primary transition-colors leading-tight mb-1.5">
                                                {item.headline || 'Unknown Article'}
                                            </h4>
                                            <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                                                <Clock size={12} />
                                                {formatDate(item.date)}
                                            </div>
                                        </Link>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Column: Quiz Ledger */}
                <div className="bg-bg-card border border-border-main rounded-3xl p-6 sm:p-8 shadow-sm transition-colors duration-300">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 bg-green-500/10 rounded-xl">
                            <Target className="text-green-500" size={24} />
                        </div>
                        <h3 className="text-2xl font-black text-text-main tracking-tight">Quiz Ledger</h3>
                    </div>

                    {!stats?.quiz_history || stats.quiz_history.length === 0 ? (
                        <div className="text-center py-12 px-4 border-2 border-dashed border-border-main rounded-2xl">
                            <CheckCircle size={40} className="mx-auto text-text-muted/50 mb-3" />
                            <p className="text-text-muted font-medium text-lg">No quizzes taken.</p>
                            <p className="text-sm text-text-muted/70 mt-1">Test your comprehension at the end of any article.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {stats.quiz_history.map((quiz, index) => (
                                <motion.div
                                    key={`quiz-${index}`}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-bg-card border border-border-main hover:border-brand-primary/40 hover:shadow-md transition-all duration-300 relative overflow-hidden"
                                >
                                    {/* Subtle left accent bar based on score */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${quiz.score >= 80 ? 'bg-green-500' : quiz.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>

                                    <div className="flex-1 min-w-0 pl-2">
                                        <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">
                                            <Clock size={12} />
                                            {formatDate(quiz.date)}
                                        </div>
                                        <Link to={`/article/${quiz.article_id}`} className="block">
                                            <h4 className="text-base sm:text-lg font-bold text-text-main group-hover:text-brand-primary transition-colors leading-snug line-clamp-2">
                                                {quiz.headline || 'Unknown Article'}
                                            </h4>
                                        </Link>
                                    </div>

                                    <div className="flex sm:flex-col items-center justify-between sm:items-end shrink-0 pl-2 pt-3 sm:pt-0 sm:pl-4 border-t sm:border-t-0 sm:border-l border-border-main/50">
                                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest sm:mb-1">
                                            Score
                                        </div>
                                        <div className={`px-4 py-1.5 rounded-full font-black text-lg shadow-sm border ${quiz.score >= 80
                                                ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                                : quiz.score >= 60
                                                    ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                                                    : 'bg-red-500/10 text-red-600 border-red-500/20'
                                            }`}>
                                            {quiz.score}%
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function MetricCard({ label, value, highlight, success, icon }) {
    return (
        <motion.div
            whileHover={{ y: -4 }}
            className={`p-6 rounded-2xl border-2 transition-all cursor-default relative overflow-hidden shadow-sm duration-300 ${highlight ? 'bg-brand-secondary border-brand-primary/20' :
                success ? 'bg-green-500/10 border-green-500/20' :
                    'bg-bg-card border-border-main'
                }`}
        >
            <div className={`absolute top-4 right-4 opacity-50 ${highlight ? 'text-brand-primary' : success ? 'text-green-500' : 'text-text-muted/50'}`}>
                {icon}
            </div>
            <p className={`font-black text-sm uppercase tracking-wider mb-2 z-10 relative ${highlight ? 'text-brand-primary' :
                success ? 'text-green-500' :
                    'text-text-muted'
                }`}>{label}</p>
            <p className={`text-4xl font-extrabold z-10 relative tracking-tighter ${highlight ? 'text-brand-primary' :
                success ? 'text-green-500' :
                    'text-text-main'
                }`}>{value}</p>
        </motion.div>
    )
}


