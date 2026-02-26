import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp, BookOpen, Clock, CheckCircle, Brain, ExternalLink, Trophy, Volume2, Square } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'

export default function ArticleDetail() {
    const { id } = useParams()
    const [article, setArticle] = useState(null)
    const [loading, setLoading] = useState(true)
    const [answers, setAnswers] = useState({})
    const [quizResult, setQuizResult] = useState(null)
    const [showOriginal, setShowOriginal] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [audioElement, setAudioElement] = useState(null)
    const isSpeakingRef = useRef(false)
    const currentAudioRef = useRef(null)
    const { user } = useAuth()
    const { t, language } = useLanguage()

    useEffect(() => {
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
        const token = localStorage.getItem('token')

        fetch(`${baseUrl}/api/articles/${id}?lang=${language}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                setArticle(data)
                setLoading(false)
            })
            .catch(err => {
                console.error("Failed to fetch article", err)
                setLoading(false)
            })

        // Record article view in the background
        fetch(`${baseUrl}/api/articles/${id}/view`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(err => console.error("Failed to record view", err))

        return () => {
            // Clean up audio if component unmounts while playing
            if (currentAudioRef.current) {
                currentAudioRef.current.pause()
                currentAudioRef.current.src = ''
            }
        }
    }, [id, language, audioElement])

    // Handle Cloud Text-To-Speech via Zero-Latency Sentence Chunking
    const toggleSpeech = async () => {
        if (!article) return

        if (isSpeaking) {
            // Stop playback completely if already playing
            isSpeakingRef.current = false
            setIsSpeaking(false)
            if (currentAudioRef.current) {
                currentAudioRef.current.pause()
                currentAudioRef.current.src = ''
            }
            return
        }

        isSpeakingRef.current = true
        setIsSpeaking(true)

        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
        const token = localStorage.getItem('token')

        // Ensure we are reading the correct language text
        let textToRead = article.simplified_text
        if ((language === 'hi' || language === 'ta') && article.translations && article.translations[language]) {
            textToRead = article.translations[language].simplified_text
        }

        // Split paragraph into distinct sentences using periods, question marks, and Hindi/Tamil full stops (। ॥)
        const rawChunks = textToRead.match(/[^.!?।॥\n]+[.!?।॥\n]+/g) || [textToRead]
        const validChunks = rawChunks.map(c => c.trim()).filter(c => c.length > 1)

        if (validChunks.length === 0) {
            isSpeakingRef.current = false
            setIsSpeaking(false)
            return
        }

        const preloadedBlobs = new Map()

        const fetchSnippet = async (index, text) => {
            if (preloadedBlobs.has(index)) return preloadedBlobs.get(index)
            try {
                const response = await fetch(`${baseUrl}/api/tts/snippet`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, lang: language })
                })
                if (!response.ok) throw new Error("Snippet API failed")
                const blob = await response.blob()
                preloadedBlobs.set(index, blob)
                return blob
            } catch (err) {
                console.error("Failed to fetch audio snippet", err)
                return null
            }
        }

        for (let i = 0; i < validChunks.length; i++) {
            if (!isSpeakingRef.current) break // Abort if user pressed Stop

            // Instantly start pre-fetching the NEXT sentence's audio in the background
            if (i + 1 < validChunks.length) {
                fetchSnippet(i + 1, validChunks[i + 1]).catch(() => { })
            }

            const blob = await fetchSnippet(i, validChunks[i])
            if (!blob || !isSpeakingRef.current) break

            const objectUrl = URL.createObjectURL(blob)
            const newAudio = new Audio(objectUrl)
            currentAudioRef.current = newAudio

            await new Promise((resolve) => {
                newAudio.onended = () => {
                    URL.revokeObjectURL(objectUrl)
                    resolve()
                }
                newAudio.onerror = (e) => {
                    console.error("Cloud TTS Playback Error:", e)
                    URL.revokeObjectURL(objectUrl)
                    resolve() // Skip to next sentence on failure rather than hard-crashing
                }
                newAudio.play().catch(err => {
                    console.error("Autoplay prevented:", err)
                    isSpeakingRef.current = false // Hard abort playback if browser strict-blocks audio
                    resolve()
                })
            })
        }

        // Reset state once sequence ends naturally or is aborted
        isSpeakingRef.current = false
        setIsSpeaking(false)
        currentAudioRef.current = null
    }

    const handleSelectAnswer = (quizId, answerId) => {
        setAnswers(prev => ({ ...prev, [quizId]: answerId }))
    }

    const submitQuiz = async (e) => {
        e.preventDefault()
        try {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
            const token = localStorage.getItem('token')

            const res = await fetch(`${baseUrl}/api/quiz/${id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ answers, viewed_original: showOriginal })
            })
            const data = await res.json()
            setQuizResult(data)
        } catch (err) {
            console.error("Failed to submit quiz", err)
        }
    }

    if (loading || !article) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-primary"></div>
            </div>
        )
    }

    const isVerified = article.fact_confidence >= 90

    return (
        <div className="relative transition-colors duration-300">
            <Link to="/" className="inline-flex items-center gap-2 text-text-muted hover:text-brand-primary font-semibold mb-8 transition-colors">
                <ArrowLeft size={20} /> {t('backToFeed')}
            </Link>

            <article className="bg-bg-card rounded-3xl p-6 sm:p-12 shadow-sm border border-border-main transition-colors duration-300">
                {article.is_available === false && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-600 font-bold">
                        <AlertTriangle size={24} className="shrink-0" />
                        <span>{t('translationUnavailable')}</span>
                    </div>
                )}

                <h1 className="text-3xl sm:text-5xl font-extrabold text-text-main leading-tight mb-8 tracking-tight">
                    {article.headline}
                </h1>

                <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-full font-bold text-sm sm:text-base mb-10 border-2 ${isVerified ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                    {isVerified ? (
                        <>
                            <ShieldCheck className="animate-pulse" size={24} />
                            <span>AI Verified Match: {article.fact_confidence.toFixed(1)}%</span>
                            <span className="opacity-70 font-medium ml-2 border-l-2 pl-3 border-current hidden sm:inline">
                                Entities Matched: {article.matched_entities}
                            </span>
                        </>
                    ) : (
                        <>
                            <AlertTriangle size={24} />
                            <span>Warning: Low Confidence ({article.fact_confidence.toFixed(1)}%)</span>
                        </>
                    )}
                </div>

                {/* Soft-Tinted Minimalist TTS Play Button */}
                <div className="flex items-center gap-4 mb-10">
                    <button
                        onClick={toggleSpeech}
                        className={`flex items-center justify-center gap-3 px-6 py-3 rounded-full font-bold text-[15px] transition-all duration-300 border-2 ${isSpeaking
                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/20'
                            : 'bg-brand-primary/5 text-brand-primary border-brand-primary/20 hover:bg-brand-primary/10 hover:border-brand-primary/40 dark:bg-brand-primary/10 dark:border-brand-primary/30 dark:hover:bg-brand-primary/20'
                            }`}
                        style={{ minWidth: '150px' }}
                    >
                        {isSpeaking ? (
                            <>
                                <Square size={16} className="fill-current" />
                                <span>{t('stopAudio')}</span>
                                <span className="flex h-2.5 w-2.5 relative ml-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 dark:bg-red-300 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 dark:bg-red-400"></span>
                                </span>
                            </>
                        ) : (
                            <>
                                <Volume2 size={18} />
                                <span>{t('listenAudio')}</span>
                            </>
                        )}
                    </button>
                    {!isSpeaking && (
                        <div className="text-text-muted text-sm font-medium opacity-80 pl-2">
                            {t('readSilently')}
                        </div>
                    )}
                </div>

                <div className="prose prose-lg max-w-none text-xl leading-relaxed text-text-main mb-16 relative">
                    {isSpeaking && (
                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-primary to-brand-secondary rounded-full hidden sm:block"></div>
                    )}
                    <p>{article.simplified_text}</p>
                </div>

                {article.quizzes && article.quizzes.length > 0 && (
                    <div className="bg-bg-hover border-2 border-border-main rounded-3xl p-8 sm:p-10 mb-16 relative overflow-hidden transition-colors duration-300">
                        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-brand-gradient-1 to-brand-gradient-2"></div>
                        <h3 className="text-2xl font-black text-text-main mb-8 border-b-2 border-border-main pb-4">
                            {t('testComprehension')}
                        </h3>

                        <AnimatePresence>
                            {quizResult ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="space-y-8"
                                >
                                    <div className={`border-2 rounded-2xl p-8 text-center ${quizResult.score > 60 ? 'bg-green-500/10 border-green-500' : 'bg-amber-500/10 border-amber-500'}`}>
                                        <div className="text-5xl mb-4">{quizResult.score > 60 ? '🎉' : '📝'}</div>
                                        <h4 className={`text-2xl font-black mb-2 ${quizResult.score > 60 ? 'text-green-500' : 'text-amber-500'}`}>
                                            Quiz Complete!
                                        </h4>
                                        <p className={`font-bold text-xl ${quizResult.score > 60 ? 'text-green-500/80' : 'text-amber-500/80'}`}>
                                            You scored {quizResult.score.toFixed(0)}% ({quizResult.correct}/{quizResult.total})
                                        </p>
                                    </div>

                                    <div className="space-y-6 mt-8">
                                        <h4 className="text-xl font-bold text-text-main border-b-2 border-border-main pb-2">Review Your Answers</h4>
                                        {article.quizzes.map((quiz, i) => {
                                            const userAnswerId = answers[quiz.id];
                                            const correctAnswer = quizResult.correct_answers?.[quiz.id];
                                            const isCorrect = String(userAnswerId) === String(correctAnswer?.id);
                                            const userAnswerText = quiz.answers.find(a => String(a.id) === String(userAnswerId))?.text;

                                            return (
                                                <div key={quiz.id} className={`p-5 rounded-xl border-2 ${isCorrect ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                                                    <p className="font-bold text-text-main mb-3">{i + 1}. {quiz.question_text}</p>
                                                    <div className="space-y-2 text-sm">
                                                        <p className={`${isCorrect ? 'text-green-500 font-medium' : 'text-red-500 line-through opacity-80'}`}>
                                                            <span className="font-bold">Your Answer:</span> {userAnswerText || "Left Blank"}
                                                        </p>
                                                        {!isCorrect && (
                                                            <p className="text-green-500 font-bold bg-green-500/10 p-2 rounded inline-block w-full">
                                                                Correct Answer: {correctAnswer?.text}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <button
                                        onClick={() => setQuizResult(null) || setAnswers({})}
                                        className="w-full sm:w-auto mt-6 bg-bg-card border-2 border-border-main hover:border-brand-primary text-text-main hover:text-brand-primary font-bold text-lg py-3 px-8 rounded-xl transition-all"
                                    >
                                        {t('retakeQuiz')}
                                    </button>
                                </motion.div>
                            ) : (
                                <form onSubmit={submitQuiz} className="space-y-8">
                                    {article.quizzes.map((quiz, i) => (
                                        <div key={quiz.id} className="space-y-4">
                                            <p className="font-bold text-lg text-text-main">{i + 1}. {quiz.question_text}</p>
                                            <div className="grid gap-3">
                                                {quiz.answers.map(ans => (
                                                    <label
                                                        key={ans.id}
                                                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${answers[quiz.id] === ans.id
                                                            ? 'border-brand-primary bg-brand-secondary/30 text-brand-primary shadow-sm'
                                                            : 'border-border-main bg-bg-card hover:border-brand-primary/50 text-text-muted hover:text-text-main'
                                                            }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={`quiz_${quiz.id}`}
                                                            value={ans.id}
                                                            checked={answers[quiz.id] === ans.id}
                                                            onChange={() => handleSelectAnswer(quiz.id, ans.id)}
                                                            className="hidden"
                                                            required
                                                        />
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${answers[quiz.id] === ans.id ? 'border-brand-primary' : 'border-border-main'}`}>
                                                            {answers[quiz.id] === ans.id && <div className="w-2.5 h-2.5 bg-brand-primary rounded-full" />}
                                                        </div>
                                                        <span className="font-medium">{ans.text}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        type="submit"
                                        className="w-full sm:w-auto mt-4 bg-gradient-to-r from-brand-gradient-1 to-brand-gradient-2 hover:opacity-90 text-white font-bold text-lg py-4 px-10 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
                                    >
                                        {t('submitAnswers')}
                                    </button>
                                </form>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Source Toggle */}
                <div className="border border-border-main rounded-2xl overflow-hidden bg-bg-card transition-colors duration-300">
                    <button
                        onClick={() => setShowOriginal(!showOriginal)}
                        className="w-full flex items-center justify-between p-6 bg-bg-hover hover:bg-bg-hover/80 text-text-main font-bold text-lg sm:text-xl transition-colors"
                    >
                        <span>Show Original Complex Text (Reading Level ~12+)</span>
                        {showOriginal ? <ChevronUp size={24} className="text-brand-primary" /> : <ChevronDown size={24} className="text-text-muted" />}
                    </button>

                    <AnimatePresence>
                        {showOriginal && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="p-6 sm:p-8 bg-bg-card border-t border-border-main"
                            >
                                <div className="mb-6 pb-6 border-b border-border-main flex justify-between items-center text-sm font-bold text-text-muted">
                                    <span>{t('originalSource')} • {article.publisher_name}</span>
                                    <a href={article.original_url} target="_blank" rel="noreferrer" className="text-brand-primary hover:text-brand-gradient-2 hover:underline transition-colors">View Link ↗</a>
                                </div>
                                <div className="prose prose-lg max-w-none text-text-muted">
                                    <p>{article.original_text}</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

            </article>
        </div>
    )
}
