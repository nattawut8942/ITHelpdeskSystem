// frontend/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute wrapper
 * Redirects to login if:
 * - No token present
 * - Token expired
 * - Cost Center is not 7510 (if requireITStaff = true)
 */
export const ProtectedRoute = ({ 
    children, 
    requireITStaff = false 
}) => {
    const { user, token, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!token || !user) {
        // Remember where the user was trying to go (e.g. /?view=all&ticket=42 from an
        // email link) so LoginPage can send them back there after a successful login.
        return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
    }

    // If route requires IT Staff, check cost_center
    if (requireITStaff && user.cost_center !== '7510') {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
                    <p className="text-slate-600 mb-6">
                        This feature is only available to IT Staff (Cost Center 7510).
                    </p>
                    <p className="text-sm text-slate-500">Your Cost Center: {user.cost_center}</p>
                </div>
            </div>
        );
    }

    return children;
};

export default ProtectedRoute;