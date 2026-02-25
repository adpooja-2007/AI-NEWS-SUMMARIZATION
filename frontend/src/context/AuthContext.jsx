import React, { createContext, useState, useEffect, useContext } from 'react';

// Create the context
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Dynamic API URL for deployed vs local
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';

    useEffect(() => {
        // Check if token exists and fetch user profile
        const initializeAuth = async () => {
            if (token) {
                try {
                    const res = await fetch(`${baseUrl}/api/auth/me`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (res.ok) {
                        const userData = await res.json();
                        setUser(userData);
                    } else {
                        // Token invalid or expired
                        logout();
                    }
                } catch (err) {
                    console.error("Failed to verify token:", err);
                    logout();
                }
            }
            setLoading(false);
        };

        initializeAuth();
    }, [token, baseUrl]);

    const login = async (email, password) => {
        try {
            const res = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.access_token);
                setToken(data.access_token);
                setUser(data.user);
                return { success: true };
            } else {
                return { success: false, error: data.detail || 'Login failed' };
            }
        } catch (err) {
            return { success: false, error: 'Network error occurred' };
        }
    };

    const register = async (username, email, password) => {
        try {
            const res = await fetch(`${baseUrl}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.access_token);
                setToken(data.access_token);
                setUser(data.user);
                return { success: true };
            } else {
                return { success: false, error: data.detail || 'Registration failed' };
            }
        } catch (err) {
            return { success: false, error: 'Network error occurred' };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);
