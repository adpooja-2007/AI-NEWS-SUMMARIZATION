import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowLeft, RefreshCw, BarChart3, AlertCircle, FileText, Activity } from 'lucide-react'

export default function AdminDashboard() {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [ingesting, setIngesting] = useState(false)
    const [message, setMessage] = useState(null)

    const fetchStats = () => {
        fetch('http://localhost:8080/api/admin/stats')
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

    const handleIngest = async () => {
        setIngesting(true)
        setMessage(null)
        try {
            const res = await fetch('http://localhost:8080/api/admin/ingest', { method: 'POST' })
            const data = await res.json()
            setMessage({ type: data.status === 'SUCCESS' ? 'success' : 'warn', text: data.msg || "Pipeline finished" })
            fetchStats() // refresh stats
        } catch (err) {
            setMessage({ type: 'error', text: 'Pipeline failed to respond.' })
        }
        setIngesting(false)
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary-600 font-semibold transition-colors">
                <ArrowLeft size={20} /> Back to Platform
            </Link>

            <div className="mb-10 text-center sm:text-left">
                <h2 className="text-4xl font-black tracking-tight text-slate-900 mb-3 flex items-center justify-center sm:justify-start gap-3">
                    <Activity className="text-primary-600" size={36} /> Platform Health
                </h2>
                <p className="text-xl text-slate-600 font-medium">Real-time metrics for pilot studies</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    icon={<FileText />}
                    label="Articles Processed"
                    value={stats?.total_processed || 0}
                />
                <MetricCard
                    icon={<ShieldCheckIcon />}
                    label="Successfully Simplified"
                    value={`${stats?.successful || 0} / ${stats?.total_processed || 0}`}
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
                    label="Avg Readability Level"
                    value={`Grade ${stats?.avg_readability || 0}`}
                    highlight
                />
            </div>

            <div className="bg-white border-2 border-slate-200 rounded-3xl p-8 sm:p-10 shadow-sm mt-12">
                <h3 className="text-2xl font-black text-slate-900 mb-4">Pipeline Control</h3>
                <p className="text-slate-500 text-lg mb-8 font-medium max-w-2xl">
                    The ingestion worker normally runs via an automated cron-job. For this demonstration, you can manually trigger the pipeline to pull an RSS item and run the AI simplification modules.
                </p>

                <AnimatePresence>
                    {message && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className={`mb-6 p-4 rounded-xl font-bold flex items-center gap-3 border-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                                message.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                                }`}
                        >
                            <div className={message.type === 'success' ? 'bg-green-100 p-1.5 rounded-full' : 'bg-yellow-100 p-1.5 rounded-full'}>
                                {message.type === 'success' ? '✓' : '!'}
                            </div>
                            {message.text}
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={handleIngest}
                    disabled={ingesting}
                    className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center gap-3 w-full sm:w-auto transition-colors shadow-md"
                >
                    {ingesting ? (
                        <>
                            <RefreshCw className="animate-spin" size={20} /> Pipeline Running...
                        </>
                    ) : (
                        <>
                            <RefreshCw size={20} /> Trigger Demo Ingestion
                        </>
                    )}
                </button>

                <div className="mt-12 p-8 bg-slate-50 border border-slate-200 rounded-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
                    <h4 className="font-black text-slate-800 text-xl mb-6">Backend Orchestration Steps</h4>
                    <ol className="space-y-4 font-semibold text-slate-600 relative z-10">
                        <li className="flex gap-3"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-sm">1</span> Fetch article from mock RSS feeds.</li>
                        <li className="flex gap-3"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-sm">2</span> Extract base entities & facts (Layer 1).</li>
                        <li className="flex gap-3"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-sm">3</span> Restructure to Grade 6 active voice limit (Layer 2).</li>
                        <li className="flex gap-3"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-sm">4</span> Cosine similarity Fact-Check verification.</li>
                        <li className="flex gap-3"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-sm">5</span> Auto-generate distractors & quizzes.</li>
                    </ol>
                </div>
            </div>
        </div>
    )
}

function MetricCard({ label, value, highlight, success, icon }) {
    return (
        <motion.div
            whileHover={{ y: -4 }}
            className={`p-6 rounded-2xl border-2 transition-all cursor-default relative overflow-hidden shadow-sm ${highlight ? 'bg-primary-50 border-primary-200' :
                success ? 'bg-green-50 border-green-200' :
                    'bg-white border-slate-200'
                }`}
        >
            <div className={`absolute top-4 right-4 opacity-50 ${highlight ? 'text-primary-500' : success ? 'text-green-500' : 'text-slate-300'}`}>
                {icon}
            </div>
            <p className={`font-black text-sm uppercase tracking-wider mb-2 z-10 relative ${highlight ? 'text-primary-700' :
                success ? 'text-green-700' :
                    'text-slate-500'
                }`}>{label}</p>
            <p className={`text-4xl font-extrabold z-10 relative tracking-tighter ${highlight ? 'text-primary-900' :
                success ? 'text-green-900' :
                    'text-slate-800'
                }`}>{value}</p>
        </motion.div>
    )
}

function ShieldCheckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
    )
}
