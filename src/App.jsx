// frontend/src/App.jsx (UPDATED)
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ITServiceDesk from './pages/ITServiceDesk';
import DashboardPage from './pages/DashboardPage';
import ReportPage from './pages/ReportPage';
import MasterDataPage from './pages/MasterDataPage';
import TVMonitor from './pages/TVMonitor';


function App() {
    return (
        <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AuthProvider>
                <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/tv" element={<TVMonitor />} />

                    {/* Protected routes */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <ITServiceDesk />
                            </ProtectedRoute>
                        }
                    />

                    {/* Example: Admin-only route */}
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute requireITStaff={true}>
                                <ITServiceDesk />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <DashboardPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/report"
                        element={
                            <ProtectedRoute>
                                <ReportPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/master"
                        element={
                            <ProtectedRoute>
                                <MasterDataPage />
                            </ProtectedRoute>
                        }
                    />
                    {/* Catch-all redirect */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}


export default App;
