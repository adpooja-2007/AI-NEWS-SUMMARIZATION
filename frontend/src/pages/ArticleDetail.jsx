import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

export default function ArticleDetail() {
    const { id } = useParams()
    const [article, setArticle] = useState(null)
    const [loading, setLoading] = useState(true)
    const [answers, setAnswers] = useState({})
    const [quizResult, setQuizResult] = useState(null)
    const [showOriginal, setShowOriginal] = useState(false)

    useEffect(() => {
        fetch(`http://localhost:8080/api/articles/${id}`)
            .then(res => res.json())
            .then(data => {
                setArticle(data)
                setLoading(false)
            })
            .catch(err => {
                console.error("Failed to fetch article", err)
                setLoading(false)
            })
    }, [id])

    const handleSelectAnswer = (quizId, answerId) => {
        setAnswers(prev => ({ ...prev, [quizId]: answerId }))
    }

    const submitQuiz = async (e) => {
        e.preventDefault()
        try {
            const res = await fetch(`http://localhost:8080/api/quiz/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary-600"></div>
            </div>
        )
    }

    const isVerified = article.fact_confidence >= 90

    return (
        <div className="relative">
            <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary-600 font-semibold mb-8 transition-colors">
                <ArrowLeft size={20} /> Back to Feed
            </Link>

            <article className="bg-white rounded-3xl p-6 sm:p-12 shadow-sm border border-slate-200">
                <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 leading-tight mb-8 tracking-tight">
                    {article.headline}
                </h1>

                <div className={`inline-flex items-center gap-3 px-5 py-3 rounded-full font-bold text-sm sm:text-base mb-10 border-2 ${isVerified ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
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

                <div className="prose prose-lg prose-slate max-w-none text-xl leading-relaxed text-slate-800 mb-16">
                    <p>{article.simplified_text}</p>
                </div>

                {article.quizzes && article.quizzes.length > 0 && (
                    <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-8 sm:p-10 mb-16 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-2 h-full bg-primary-500"></div>
                        <h3 className="text-2xl font-black text-slate-900 mb-8 border-b-2 border-slate-200 pb-4">
                            Check Your Understanding
                        </h3>

                        <AnimatePresence>
                            {quizResult ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="space-y-8"
                                >
                                    <div className={`border-2 rounded-2xl p-8 text-center ${quizResult.score > 60 ? 'bg-green-50 border-green-500' : 'bg-amber-50 border-amber-500'}`}>
                                        <div className="text-5xl mb-4">{quizResult.score > 60 ? '🎉' : '📝'}</div>
                                        <h4 className={`text-2xl font-black mb-2 ${quizResult.score > 60 ? 'text-green-800' : 'text-amber-800'}`}>
                                            Quiz Complete!
                                        </h4>
                                        <p className={`font-bold text-xl ${quizResult.score > 60 ? 'text-green-700' : 'text-amber-700'}`}>
                                            You scored {quizResult.score.toFixed(0)}% ({quizResult.correct}/{quizResult.total})
                                        </p>
                                    </div>

                                    <div className="space-y-6 mt-8">
                                        <h4 className="text-xl font-bold text-slate-800 border-b-2 border-slate-200 pb-2">Review Your Answers</h4>
                                        {article.quizzes.map((quiz, i) => {
                                            const userAnswerId = answers[quiz.id];
                                            const correctAnswer = quizResult.correct_answers?.[quiz.id];
                                            const isCorrect = String(userAnswerId) === String(correctAnswer?.id);
                                            const userAnswerText = quiz.answers.find(a => String(a.id) === String(userAnswerId))?.text;

                                            return (
                                                <div key={quiz.id} className={`p-5 rounded-xl border-2 ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                                    <p className="font-bold text-slate-800 mb-3">{i + 1}. {quiz.question_text}</p>
                                                    <div className="space-y-2 text-sm">
                                                        <p className={`${isCorrect ? 'text-green-800 font-medium' : 'text-red-800 line-through opacity-80'}`}>
                                                            <span className="font-bold">Your Answer:</span> {userAnswerText || "Left Blank"}
                                                        </p>
                                                        {!isCorrect && (
                                                            <p className="text-green-800 font-bold bg-green-100/50 p-2 rounded inline-block w-full">
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
                                        className="w-full sm:w-auto mt-6 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-lg py-3 px-8 rounded-xl transition-all"
                                    >
                                        Retake Quiz
                                    </button>
                                </motion.div>
                            ) : (
                                <form onSubmit={submitQuiz} className="space-y-8">
                                    {article.quizzes.map((quiz, i) => (
                                        <div key={quiz.id} className="space-y-4">
                                            <p className="font-bold text-lg text-slate-800">{i + 1}. {quiz.question_text}</p>
                                            <div className="grid gap-3">
                                                {quiz.answers.map(ans => (
                                                    <label
                                                        key={ans.id}
                                                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${answers[quiz.id] === ans.id
                                                            ? 'border-primary-500 bg-primary-50 text-primary-900 shadow-sm'
                                                            : 'border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50'
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
                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${answers[quiz.id] === ans.id ? 'border-primary-600' : 'border-slate-300'}`}>
                                                            {answers[quiz.id] === ans.id && <div className="w-2.5 h-2.5 bg-primary-600 rounded-full" />}
                                                        </div>
                                                        <span className="font-medium">{ans.text}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        type="submit"
                                        className="w-full sm:w-auto mt-4 bg-primary-600 hover:bg-primary-700 text-white font-bold text-lg py-4 px-10 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
                                    >
                                        Submit Answers
                                    </button>
                                </form>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Source Toggle */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <button
                        onClick={() => setShowOriginal(!showOriginal)}
                        className="w-full flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100 transition-colors font-bold text-slate-500 text-lg sm:text-xl"
                    >
                        <span>Show Original Complex Text (Reading Level ~12+)</span>
                        {showOriginal ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                    </button>

                    <AnimatePresence>
                        {showOriginal && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="p-6 sm:p-8 bg-white"
                            >
                                <div className="mb-6 pb-6 border-b border-slate-100 flex justify-between items-center text-sm font-bold text-slate-400">
                                    <span>Source Original • {article.publisher_name}</span>
                                    <a href={article.original_url} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">View Link ↗</a>
                                </div>
                                <div className="prose prose-slate max-w-none text-slate-600">
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
