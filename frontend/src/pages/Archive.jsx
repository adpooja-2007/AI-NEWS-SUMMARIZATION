import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Archive, ChevronRight, Clock, ShieldCheck, CalendarSearch, XCircle, ChevronLeft } from 'lucide-react'

export default function ArchivePage() {
    const [articles, setArticles] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchDate, setSearchDate] = useState('')
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date())

    useEffect(() => {
        fetch('http://localhost:8080/api/articles')
            .then(res => res.json())
            .then(data => {
                setArticles(data)
                setLoading(false)
            })
            .catch(err => {
                console.error("Failed to fetch articles", err)
                setLoading(false)
            })
    }, [])

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[#1e3a8a]"></div>
            </div>
        )
    }

    // Filter articles by the exact selected date (if one is chosen)
    const filteredArticles = searchDate
        ? articles.filter(article => article.date === searchDate)
        : articles

    // Group the filtered articles by date
    const groupedArticles = filteredArticles.reduce((acc, article) => {
        const date = article.date || 'Unknown Date'
        if (!acc[date]) {
            acc[date] = []
        }
        acc[date].push(article)
        return acc
    }, {})

    // Sort dates descending
    const sortedDates = Object.keys(groupedArticles).sort((a, b) => new Date(b) - new Date(a))

    // Helper functions for custom calendar widget
    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
    }
    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
    }
    const handleSelectDate = (day) => {
        const year = currentMonth.getFullYear()
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0')
        const dayStr = String(day).padStart(2, '0')
        // Using YYYY-MM-DD to match the exact format of our database archive
        setSearchDate(`${year}-${month}-${dayStr}`)
        setIsDatePickerOpen(false)
    }

    const renderCalendarDays = () => {
        const year = currentMonth.getFullYear()
        const month = currentMonth.getMonth()
        const daysInMonth = getDaysInMonth(year, month)
        const firstDay = getFirstDayOfMonth(year, month)
        const days = []

        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-2"></div>)
        }

        // Actual days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
            const isSelected = searchDate === dateStr
            const isToday = new Date().toDateString() === new Date(year, month, i).toDateString()

            days.push(
                <button
                    key={i}
                    onClick={() => handleSelectDate(i)}
                    className={`h-10 w-10 mx-auto rounded-full flex items-center justify-center text-sm font-semibold transition-all
                        ${isSelected ? 'bg-[#1e3a8a] text-white shadow-md scale-110' :
                            isToday ? 'bg-slate-100 text-[#1e3a8a] ring-2 ring-[#60a5fa] ring-inset' :
                                'text-slate-700 hover:bg-slate-100'}`}
                >
                    {i}
                </button>
            )
        }
        return days
    }

    return (
        <div className="space-y-10 max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center sm:text-left">
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[#1e3a8a] mb-2">
                    News Archive
                </h2>
                <p className="text-lg text-slate-500 font-medium">
                    Explore past news simplified for your understanding.
                </p>
            </div>

            {/* Centralized Search Card */}
            <div className="bg-white rounded-[1.5rem] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-100 p-8 sm:p-14 max-w-3xl mx-auto text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-[#ebf5ff] text-[#1e3a8a] rounded-2xl flex items-center justify-center mb-6 border border-blue-100">
                    <Calendar size={32} />
                </div>

                <h3 className="text-xl font-bold text-[#1e3a8a] mb-6">Select a Date</h3>

                <div className="w-full max-w-md space-y-4">
                    <div className="relative z-40">
                        {/* Custom Input Trigger */}
                        <div
                            onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                            className="w-full px-5 py-4 border-2 border-slate-100 bg-white rounded-xl shadow-sm text-left flex justify-between items-center cursor-pointer hover:border-[#1e3a8a]/30 transition-colors"
                        >
                            <span className={`font-bold ${searchDate ? 'text-[#1e3a8a]' : 'text-slate-400'}`}>
                                {searchDate || 'Select a specific date...'}
                            </span>
                        </div>

                        {searchDate && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setSearchDate(''); }}
                                className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-rose-500 transition-colors"
                            >
                                <XCircle className="h-5 w-5" />
                            </button>
                        )}

                        {/* Custom Calendar Popover */}
                        <AnimatePresence>
                            {isDatePickerOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-5 overflow-hidden z-20"
                                >
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                                            <ChevronLeft size={20} />
                                        </button>
                                        <h4 className="font-bold text-[#1e3a8a]">
                                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                        </h4>
                                        <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-7 gap-1 mb-2">
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                                            <div key={day} className="text-center text-xs font-bold text-slate-400 uppercase">
                                                {day}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                                        {renderCalendarDays()}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button
                        onClick={() => setIsDatePickerOpen(false)}
                        className="w-full py-3.5 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 text-white rounded-xl font-bold transition-transform active:scale-[0.98] shadow-sm"
                    >
                        Fetch Archive
                    </button>
                </div>
            </div>

            {/* Empty State / Skeletons */}
            {searchDate && filteredArticles.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500 max-w-3xl mx-auto"
                >
                    <CalendarSearch size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-2xl font-bold text-slate-700 mb-2">No news found</h3>
                    <p className="text-lg">We couldn't find any articles published on <span className="font-bold text-slate-900">{searchDate}</span>.</p>
                </motion.div>
            ) : !searchDate ? (
                // Skeletons when no search date is provided (to match mockup)
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto opacity-50">
                    {[1, 2, 3].map((skel) => (
                        <div key={skel} className="bg-white/60 rounded-[2rem] border border-slate-100 p-6 flex flex-col justify-between gap-4 min-h-[320px]">
                            <div className="flex flex-col gap-4">
                                <div className="flex gap-2">
                                    <div className="h-8 bg-slate-200 rounded-lg w-20"></div>
                                    <div className="h-8 bg-slate-200 rounded-lg w-16"></div>
                                </div>
                                <div className="space-y-3 mt-4">
                                    <div className="h-6 bg-slate-200 rounded-full w-full"></div>
                                    <div className="h-6 bg-slate-200 rounded-full w-5/6"></div>
                                    <div className="h-6 bg-slate-200 rounded-full w-3/4"></div>
                                </div>
                            </div>
                            <div className="flex justify-end mt-auto">
                                <div className="h-12 w-12 bg-slate-200 rounded-[1rem]"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-12 max-w-5xl mx-auto">
                    <AnimatePresence>
                        {sortedDates.map((date) => (
                            <motion.div
                                key={date}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="flex items-center justify-center gap-4 mb-6">
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                    <h3 className="text-lg font-black text-slate-500 uppercase tracking-widest bg-slate-50 px-4 py-1 rounded-full border border-slate-200">
                                        {date}
                                    </h3>
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                </div>

                                <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {groupedArticles[date].map((article, index) => (
                                        <Link key={article.id} to={`/article/${article.id}`} className="block h-full">
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: index * 0.05 }}
                                                whileHover={{ scale: 1.02, y: -4 }}
                                                className="group h-full bg-white rounded-[2rem] p-6 border border-slate-100 hover:border-[#1e3a8a] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between gap-6 min-h-[320px]"
                                            >
                                                <div className="flex flex-col gap-4 h-full">
                                                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                                                        <span className="bg-[#ebf5ff] text-[#1e3a8a] px-3 py-1.5 rounded-lg border border-blue-100 tracking-wide">
                                                            {article.genre || 'General'}
                                                        </span>
                                                        <span className="flex items-center gap-1 bg-slate-50 px-2.5 py-1.5 border border-slate-100 rounded-lg text-slate-500">
                                                            <Clock size={14} /> {article.read_time_min}m
                                                        </span>
                                                    </div>
                                                    <h4 className="text-xl sm:text-2xl font-black text-slate-800 leading-snug group-hover:text-[#1e3a8a] transition-colors line-clamp-4">
                                                        {article.headline}
                                                    </h4>
                                                </div>
                                                <div className="flex justify-end mt-auto">
                                                    <div className="bg-slate-50 p-3.5 rounded-[1rem] group-hover:bg-[#1e3a8a] group-hover:text-white transition-colors border border-slate-100 text-slate-400 shadow-sm inline-flex items-center justify-center">
                                                        <ChevronRight size={20} />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        </Link>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}
