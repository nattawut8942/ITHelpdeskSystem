// frontend/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Initialize from localStorage on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('authUser');

        if (storedToken && storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                setToken(storedToken);
                setUser(userData);
            } catch (error) {
                console.error('Failed to parse stored auth data:', error);
                localStorage.removeItem('authToken');
                localStorage.removeItem('authUser');
            }
        }

        setIsLoading(false);
    }, []);

    // Login function - called from LoginPage
    const login = (userData) => {
        setUser(userData);
        
        // Token is stored via localStorage in LoginPage after successful API response
        // This just sets the context state
    };

    // Logout function
    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        // Redirect to login handled by ProtectedRoute
    };

    // Update token in context and localStorage
    const setAuthToken = (newToken, userData) => {
        setToken(newToken);
        setUser(userData);
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('authUser', JSON.stringify(userData));
    };

    const value = {
        user,
        token,
        isLoading,
        login,
        logout,
        setAuthToken,
        isAuthenticated: !!token
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
