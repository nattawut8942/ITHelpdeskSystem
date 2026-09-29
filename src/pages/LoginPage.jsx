import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, User, Lock, Eye, EyeOff, Loader2, Info, MonitorPlay } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config/api';
import logo from '../../public/DAIKIN_logo.svg.png';

const LoginPage = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [username, setUsername] = useState('');
    const { setAuthToken } = useAuth();

    const navigate = useNavigate();
    const location = useLocation();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        const formData = new FormData(e.target);

        try {
            const res = await fetch(`${API_BASE}/authen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(Object.fromEntries(formData))
            });
            const data = await res.json();

            if (data.success) {
                setAuthToken(data.token, data.user);
                const from = location.state?.from || '/';
                navigate(from, { replace: true });
            } else {
                setError(data.message || 'Login failed');
            }
        } catch (err) {
            setError('Server error');
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 bg-[radial-gradient(#bae6fd99_2px,transparent_2px)] [background-size:40px_40px] font-sans p-4">

            {/* Main Card Container (Split Layout) */}
            <div className="w-full max-w-[900px] bg-white rounded-lg shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-200">

                {/* Left Side: Branding & Info (Corporate Dark Theme) */}
                <div className="md:w-5/12 bg-slate-900 text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden shrink-0">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30 z-0"></div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 z-0"></div>

                    <div className="relative z-10 flex flex-col items-center text-center">
                        <img
                            src={logo}
                            alt="DAIKIN Logo"
                            className="h-14 mb-8 object-contain bg-white/1 p-2 rounded-sm backdrop-blur-sm"
                            onError={(e) => {
                                // Fallback in case image is missing in preview
                                e.target.outerHTML = '<div class="h-14 w-32 mx-auto bg-white/20 rounded-sm mb-8 flex items-center justify-center text-sm font-bold">DAIKIN</div>';
                            }}
                        />
                        <h1 className="text-3xl font-black tracking-tight text-white leading-none mb-2">
                            IT HELP<span className="text-blue-500 mx-1">|</span><span className="text-blue-600">DESK</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium tracking-wide">
                            ENTERPRISE SERVICE PORTAL
                        </p>

                        {/* Static Welcome Message */}
                        <div className="mt-10 pt-8 border-t border-slate-700/50 w-full flex flex-col items-center">
                            <div className="flex flex-col items-center justify-center text-center gap-4 text-slate-400 min-h-[160px]">
                                <p className="text-sm leading-relaxed max-w-[250px]">
                                    Please enter your employee username and password to access the system.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10 mt-12 md:mt-0 text-center w-full">
                        <p className="text-[10px] text-slate-500 tracking-wider">
                            © 2026 BY: NATTHAWUT.Y<br />
                            <span className="font-bold text-slate-400">ALL RIGHTS RESERVED.</span>
                        </p>
                    </div>
                </div>

                {/* Right Side: Login Form */}
                <div className="md:w-7/12 p-8 md:p-12 flex flex-col justify-center bg-white">
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Sign in to your account</h2>
                        <p className="text-sm text-slate-500 mt-1">Enter your credentials to continue</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium flex items-center gap-2 rounded-r-md">
                            <AlertTriangle size={16} className="text-red-500 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username Field */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">Username</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                                    <User size={16} />
                                </span>
                                <input
                                    name="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    autoComplete="username"
                                    autoFocus
                                    className="w-full bg-white border border-slate-300 rounded-md py-2.5 pl-10 pr-4 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all text-sm text-slate-900 placeholder:text-slate-400"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">Password</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                                    <Lock size={16} />
                                </span>
                                <input
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    className="w-full bg-white border border-slate-300 rounded-md py-2.5 pl-10 pr-10 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all text-sm text-slate-900 placeholder:text-slate-400"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Instruction Note */}
                        <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-100 rounded-md">
                            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-600 leading-relaxed">
                                <span className="font-semibold text-slate-700">คำแนะนำ:</span> ใช้ Username และ Password เดียวกันกับที่ใช้เข้าสู่ระบบคอมพิวเตอร์ของบริษัท
                            </p>
                        </div>

                        {/* Submit Button */}
                        <button
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-md transition-colors active:bg-blue-800 disabled:opacity-70 mt-2 text-sm flex items-center justify-center gap-2 shadow-sm"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Authenticating...</span>
                                </>
                            ) : (
                                <span>Sign In</span>
                            )}
                        </button>
                    </form>

                    {/* TV Monitor Button */}
                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                        <button
                            type="button"
                            onClick={() => navigate('/tv')}
                            className="inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors px-4 py-2 rounded-md hover:bg-blue-50"
                        >
                            <MonitorPlay size={16} />
                            <span>View TV Monitor Dashboard</span>
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default LoginPage;