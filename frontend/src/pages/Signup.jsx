import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { FiUser, FiMail, FiLock, FiAlertCircle, FiUserPlus } from 'react-icons/fi';

export const Signup = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { register } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await register(username, email, password);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.error);
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center p-4 h-full">
            <div className="max-w-md w-full bg-bg-card/80 backdrop-blur-xl border border-border-main p-8 rounded-2xl relative overflow-hidden transition-colors duration-300">
                {/* Decorative background blur */}
                <div className="absolute -top-32 -left-32 w-64 h-64 bg-brand-primary/20 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-brand-gradient-2/20 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 text-center mb-8">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-brand-gradient-1 to-brand-gradient-2 bg-clip-text text-transparent mb-2">{t('joinClearNews')}</h2>
                    <p className="text-text-muted">{t('createAccount')}</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start space-x-3 text-red-200">
                        <FiAlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-text-main ml-1">{t('username')}</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                                <FiUser className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-bg-hover border border-border-main text-text-main placeholder-text-muted rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-transparent transition-all"
                                placeholder="johndoe"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-text-main ml-1">{t('emailAddress')}</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                                <FiMail className="w-5 h-5" />
                            </div>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-bg-hover border border-border-main text-text-main placeholder-text-muted rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-transparent transition-all"
                                placeholder="you@example.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-text-main ml-1">{t('password')}</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                                <FiLock className="w-5 h-5" />
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-bg-hover border border-border-main text-text-main placeholder-text-muted rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-transparent transition-all"
                                placeholder="••••••••"
                                minLength="6"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-gradient-1 to-brand-gradient-2 hover:opacity-90 text-white rounded-xl font-medium shadow-lg shadow-brand-primary/20 transition-all flex items-center justify-center group disabled:opacity-50"
                    >
                        {loading ? 'Creating Account...' : (
                            <>
                                {t('signUp')}
                                <FiUserPlus className="ml-2 w-4 h-4 group-hover:scale-110 transition-transform" />
                            </>
                        )}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-text-muted relative z-10">
                    {t('alreadyHaveAccount')}{' '}
                    <Link to="/login" className="text-brand-primary hover:text-brand-gradient-2 font-medium transition-colors">
                        {t('signIn')}
                    </Link>
                </p>
            </div>
        </div>
    );
};
