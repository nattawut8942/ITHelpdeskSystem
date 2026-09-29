import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ticketAPI } from '../utils/apiClient';
import * as signalR from "@microsoft/signalr";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Sidebar from '../components/Sidebar';
import MobileNavbar from '../components/MobileNavbar';
import {
  LayoutDashboard, Clock, CheckCircle, Loader, AlertTriangle,
  Plus, Search, ChevronRight, MapPin, Ticket, User, Calendar, Activity, Zap, Monitor, Wifi, LoaderCircle, Key
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../config/api';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white text-slate-800 p-3 rounded border border-slate-300 shadow-sm text-xs font-semibold">
        <p className="font-bold text-slate-600 mb-1">{label || payload[0].name}</p>
        <p className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: payload[0].color || payload[0].payload.fill || '#3b82f6' }}></span>
          <span>Tickets: <span className="font-bold text-slate-800">{payload[0].value}</span></span>
        </p>
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const isITStaff = user?.cost_center === '7510';
  const navigate = useNavigate();

  const formatDateShort = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  const getDaysUntilDue = (targetDate) => {
    if (!targetDate) return null;
    const diff = new Date(targetDate) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await ticketAPI.getTickets();
        const tickets = res.data.data || res.data;
        setRequests(Array.isArray(tickets) ? tickets : []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();

    const hubUrl = API_BASE.replace('/api', '') + '/hubs/tickets';
    const token = localStorage.getItem('authToken');

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    connection.on('TicketsUpdated', () => {
      fetchData();
    });

    connection.start().catch(err => console.error('SignalR connect error:', err));

    return () => { connection.stop(); };
  }, []);

  const myTickets = useMemo(() =>
    requests.filter(r => r.cost_center === user?.cost_center),
    [requests, user]
  );

  const assignedTickets = useMemo(() =>
    isITStaff ? requests.filter(r => r.empCode_assigned === user?.empcode) : [],
    [requests, user, isITStaff]
  );

  const pendingQueue = useMemo(() =>
    isITStaff ? requests.filter(r => r.status === 'Open') : [],
    [requests, isITStaff]
  );


  const criticalUnassigned = useMemo(() => {
    if (!isITStaff) return [];
    return requests.filter(r =>
      r.priority === 'Critical' &&
      !r.empCode_assigned &&
      !['Closed', 'Rejected', 'Cancelled'].includes(r.status)
    );
  }, [requests, isITStaff]);


  const myStats = {
    total: myTickets.length,
    pending: myTickets.filter(r => r.status === 'Open').length,
    inProgress: myTickets.filter(r => r.status === 'In Progress').length,
    completed: myTickets.filter(r => r.status === 'Closed').length,
  };

  const itStats = {
    assigned: assignedTickets.length,
    inProgress: assignedTickets.filter(r => r.status === 'In Progress').length,
    completed: assignedTickets.filter(r => r.status === 'Closed').length,
    pendingQueue: pendingQueue.length,
  };

  const dueSoonTickets = useMemo(() => {
    const source = isITStaff ? requests : myTickets;
    return source
      .filter(r => r.status !== 'Closed' && r.status !== 'Rejected' && r.status !== 'Cancelled' && r.target_date)
      .map(r => ({ ...r, daysLeft: getDaysUntilDue(r.target_date) }))
      .filter(r => r.daysLeft <= 3)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 4);
  }, [requests, myTickets, isITStaff]);


  const agingTickets = useMemo(() => {
    if (!isITStaff) return [];
    const now = new Date();
    return requests
      .filter(r => r.status === 'In Progress' && r.accepted_at)
      .map(r => ({ ...r, hoursOpen: Math.floor((now - new Date(r.accepted_at)) / (1000 * 60 * 60)) }))
      .filter(r => r.hoursOpen >= 24)
      .sort((a, b) => b.hoursOpen - a.hoursOpen)
      .slice(0, 4);
  }, [requests, isITStaff]);


  const recentActivity = useMemo(() => {
    const source = isITStaff ? requests : myTickets;
    return [...source]
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 6);
  }, [requests, myTickets, isITStaff]);

  const problemTypeData = useMemo(() => {
    const source = isITStaff ? requests : myTickets;
    const counts = {};
    source.forEach(r => {
      const type = r.request_type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [requests, myTickets, isITStaff]);


  const deviceTypeData = useMemo(() => {
    const source = isITStaff ? requests : myTickets;
    const counts = {};
    source.forEach(r => {
      const dt = r.device_type || 'Unknown';
      counts[dt] = (counts[dt] || 0) + (parseInt(r.device_count, 10) || 1);
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [requests, myTickets, isITStaff]);


  const workloadData = useMemo(() => {
    if (!isITStaff) return [];
    const counts = {};
    requests.forEach(r => {
      if (r.status === 'In Progress' && r.empCode_assigned) {
        const name = r.assigned_name?.split(' ')[0] || r.empCode_assigned;
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [requests, isITStaff]);

  // Formal Distinct Colors for Charts (Suggestion 1)
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6', '#ef4444'];

  const performanceStats = useMemo(() => {
    if (!isITStaff) return null;
    const closedTickets = requests.filter(r => r.status === 'Closed');
    if (closedTickets.length === 0) return { slaRate: 100, avgTime: 0 };

    let onTimeCount = 0;
    let totalTime = 0;

    closedTickets.forEach(r => {
      if (r.target_date && r.updated_at) {
        const target = new Date(r.target_date);
        const closed = new Date(r.updated_at);
        if (closed <= target) onTimeCount++;
      } else {
        onTimeCount++;
      }
      const created = new Date(r.created_at || r.updated_at);
      const closed = new Date(r.updated_at);
      const diffHours = (closed - created) / (1000 * 60 * 60);
      totalTime += diffHours > 0 ? diffHours : 1;
    });

    return {
      slaRate: Math.round((onTimeCount / closedTickets.length) * 100),
      avgTime: Math.round(totalTime / closedTickets.length)
    };
  }, [requests, isITStaff]);

  // Clean formal styling for badges (Suggestion 2)
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Closed': return 'text-slate-600 bg-slate-100 border-slate-300';
      case 'In Progress': return 'text-emerald-700 bg-emerald-50 border-emerald-300';
      case 'On Hold': return 'text-amber-700 bg-amber-50 border-amber-300';
      case 'Rejected': return 'text-rose-700 bg-rose-50 border-rose-300';
      case 'Cancelled': return 'text-slate-500 bg-slate-50 border-slate-200';
      case 'Open': return 'text-blue-700 bg-blue-50 border-blue-300';
      default: return 'text-slate-600 bg-slate-100 border-slate-300';
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'Critical': return 'text-rose-700 bg-rose-50 border-rose-300';
      case 'High': return 'text-orange-700 bg-orange-50 border-orange-300';
      case 'Medium': return 'text-amber-700 bg-amber-50 border-amber-300';
      case 'Normal': return 'text-slate-600 bg-slate-100 border-slate-300';
      default: return 'text-slate-600 bg-slate-100 border-slate-300';
    }
  };

  const greetingTime = () => {
    const h = new Date().getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col md:flex-row overflow-hidden">

      {/* Mobile Navbar */}
      <MobileNavbar user={user} onMenuClick={() => setMobileOpen(true)} />

      {/* Sidebar */}
      <Sidebar user={user} isITStaff={isITStaff} logout={logout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Area - Formal Sharp Borders (Suggestion 3) */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden p-0 md:p-6">
        <div className="bg-white rounded shadow-sm flex flex-col h-full overflow-hidden border border-slate-200">

          {/* Header - Formal without gradients */}
          <header className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{greetingTime()}</p>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                {user?.name?.split(' ')[0] || 'User'}
              </h1>
              <p className="text-xs font-medium text-slate-500 mt-1">
                {isITStaff
                  ? 'Overview of your assigned tasks and system queue'
                  : `Overview of tickets for department ${user?.cost_center || ''}`
                }
              </p>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center justify-end gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded border border-slate-300 shadow-sm">
                <Calendar className="w-3.5 h-3.5" />
                {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <p className="text-[11px] font-semibold text-slate-500 mt-1.5">
                {!isITStaff && myStats.pending > 0 && <span className="text-amber-600 font-bold">Pending: {myStats.pending}</span>}
                {isITStaff && itStats.pendingQueue > 0 && <span className="text-amber-600 font-bold">New Queue: {itStats.pendingQueue}</span>}
                {((!isITStaff && myStats.pending === 0) || (isITStaff && itStats.pendingQueue === 0)) && 'All caught up!'}
              </p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 text-slate-800 custom-scrollbar">

            {/* KPI Cards - Minimalist formal style (Suggestion 5) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {isITStaff ? (
                <>
                  {[
                    { label: 'System Queue', desc: 'Awaiting IT', value: itStats.pendingQueue, icon: <Clock className="w-5 h-5 text-emerald-600" /> },
                    { label: 'My Pending', desc: 'On Hold', value: assignedTickets.filter(r => r.status === 'On Hold').length, icon: <Loader className="w-5 h-5 text-orange-600" /> },
                    { label: 'In Progress', desc: 'My Active Tasks', value: assignedTickets.filter(r => r.status === 'In Progress').length, icon: <LoaderCircle className="w-5 h-5 text-blue-600" /> },
                    { label: 'Resolved', desc: 'My Completed', value: itStats.completed, icon: <CheckCircle className="w-5 h-5 text-slate-500" /> },
                  ].map((s, i) => (
                    <div key={i} className="bg-white rounded border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:border-blue-400 transition-colors cursor-pointer">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{isLoading ? '—' : s.value}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{s.desc}</p>
                      </div>
                      <div className="p-3 rounded bg-slate-50 border border-slate-100">
                        {s.icon}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { label: 'Total Tickets', desc: 'All Submissions', value: myStats.total, icon: <Ticket className="w-5 h-5 text-indigo-600" /> },
                    { label: 'Open', desc: 'Awaiting IT', value: myStats.pending, icon: <Clock className="w-5 h-5 text-blue-600" /> },
                    { label: 'In Progress', desc: 'IT Working', value: myStats.inProgress, icon: <LoaderCircle className="w-5 h-5 text-emerald-600" /> },
                    { label: 'Closed', desc: 'Resolved', value: myStats.completed, icon: <CheckCircle className="w-5 h-5 text-slate-500" /> },
                  ].map((s, i) => (
                    <div key={i} className="bg-white rounded border border-slate-200 p-4 flex items-center justify-between shadow-sm hover:border-blue-400 transition-colors cursor-pointer">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                        <p className="text-2xl font-bold text-slate-800 mt-1">{isLoading ? '—' : s.value}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{s.desc}</p>
                      </div>
                      <div className="p-3 rounded bg-slate-50 border border-slate-100">
                        {s.icon}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Left Column: Charts and Recent Tickets */}
              <div className="lg:col-span-2 space-y-6">

                {/* IT Staff Charts Section */}
                {isITStaff && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {/* Workload Distribution */}
                    <div className="bg-white rounded border border-slate-200 shadow-sm p-5 flex flex-col">
                      <div className="mb-4 border-b border-slate-100 pb-3 flex justify-between items-center">
                        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          Workload
                        </h2>
                        <span className="text-[11px] bg-slate-100 px-2 py-1 rounded text-slate-500 border border-slate-200">In Progress</span>
                      </div>

                      <div className="h-[220px] w-full">
                        {workloadData.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No active tasks</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={workloadData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569', fontWeight: '600' }} width={80} axisLine={false} tickLine={false} />
                              <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                              <Bar dataKey="value" fill="#3b82f6" radius={[0, 2, 2, 0]} barSize={20} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    {/* Trending Issues (Donut + Custom Legend) */}
                    <div className="bg-white rounded border border-slate-200 shadow-sm p-5 flex flex-col">
                      <div className="mb-4 border-b border-slate-100 pb-3 flex justify-between items-center">
                        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-slate-400" />
                          Trending Issues
                        </h2>
                        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 border border-slate-200">Top 5</span>
                      </div>

                      {problemTypeData.length === 0 ? (
                        <div className="h-[280px] flex items-center justify-center text-xs text-slate-400 font-medium">No data</div>
                      ) : (
                        <div className="flex flex-col items-center h-[280px]">
                          <div className="relative h-[130px] w-full shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <Pie data={problemTypeData} cx="50%" cy="50%" innerRadius={40} outerRadius={58} paddingAngle={2} dataKey="value">
                                  {problemTypeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <RechartsTooltip content={<CustomTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Center total label */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <span className="text-xl font-bold text-slate-800">
                                {problemTypeData.reduce((sum, d) => sum + d.value, 0)}
                              </span>
                              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">Total</span>
                            </div>
                          </div>

                          {/* Custom legend — scrollable, 2-line clamp, with % */}
                          <div className="w-full mt-3 space-y-2 overflow-y-auto custom-scrollbar flex-1 pr-1">
                            {(() => {
                              const total = problemTypeData.reduce((sum, d) => sum + d.value, 0);
                              return problemTypeData.map((item, idx) => {
                                const pct = total ? Math.round((item.value / total) * 100) : 0;
                                return (
                                  <div key={idx} className="flex items-start gap-2 text-[11px]">
                                    <span className="w-2.5 h-2.5 rounded-sm shrink-0 mt-0.5" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                    <span className="text-slate-600 font-medium leading-snug line-clamp-2 flex-1">{item.name}</span>
                                    <span className="text-slate-500 font-bold shrink-0 text-right whitespace-nowrap">
                                      {item.value} <span className="text-slate-400 font-normal">({pct}%)</span>
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Device Type Breakdown */}
                    <div className="bg-white rounded border border-slate-200 shadow-sm p-5 flex flex-col">
                      <div className="mb-4 border-b border-slate-100 pb-3 flex justify-between items-center">
                        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-slate-400" />
                          Device Types
                        </h2>
                        <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500 border border-slate-200">Top 5</span>
                      </div>

                      <div className="h-[220px] w-full">
                        {deviceTypeData.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-slate-400 font-medium">No data</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={deviceTypeData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#475569', fontWeight: '600' }} width={90} axisLine={false} tickLine={false} />
                              <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                              <Bar dataKey="value" fill="#6366f1" radius={[0, 2, 2, 0]} barSize={20} />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Tickets List - Formal styling */}
                <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-slate-500" />
                      <h2 className="text-sm font-bold text-slate-800">
                        {isITStaff ? 'System Recent Activity' : 'Your Recent Tickets'}
                      </h2>
                    </div>
                    <button onClick={() => navigate('/?view=all')} className="text-xs text-blue-600 hover:text-blue-800 font-semibold transition-colors">
                      View All
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 flex-1">
                    {isLoading ? (
                      <div className="p-12 text-center text-slate-400">
                        <LoaderCircle className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <span className="text-xs font-semibold">Loading...</span>
                      </div>
                    ) : recentActivity.length === 0 ? (
                      <div className="p-12 text-center text-slate-500">
                        <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm font-semibold">No recent tickets</p>
                        {!isITStaff && (
                          <button onClick={() => navigate('/?view=all', { state: { openModal: true } })} className="mt-3 text-xs text-white font-semibold bg-blue-600 px-4 py-2 rounded shadow-sm hover:bg-blue-700 transition-colors">
                            Create Ticket
                          </button>
                        )}
                      </div>
                    ) : (
                      recentActivity.map(req => {
                        const isNew = req.status === 'Open';
                        return (
                          <div
                            key={req.id}
                            onClick={() => navigate('/?view=all', { state: { ticketId: req.id } })}
                            className="group cursor-pointer hover:bg-slate-50 flex items-center gap-4 px-5 py-3 transition-colors"
                          >
                            {/* Ticket Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {req.req_id}
                                </span>
                                {isNew && <span className="text-[9px] bg-red-600 text-white px-2.5 py-1 rounded font-bold uppercase">New</span>}
                              </div>
                              <p className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                                {req.project_name}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 truncate">
                                <MapPin className="w-3 h-3" />
                                {req.location}
                                {isITStaff && (
                                  <>
                                    <span className="mx-1">•</span>
                                    <User className="w-3 h-3" />
                                    {/* Null Safety Appled (Suggestion 4) */}
                                    {req.requester_name?.split(' ')[0] || req.empCode_created || 'Unknown'}
                                  </>
                                )}
                              </p>
                            </div>

                            {/* Status */}
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getStatusStyle(req.status)}`}>
                                {req.status}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${getPriorityStyle(req.priority)}`}>
                                {req.priority}
                              </span>
                            </div>

                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0 ml-2" />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">

                {/* User Quick Actions */}
                {!isITStaff && (
                  <div className="bg-white rounded border border-slate-200 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Fix Computer', icon: <Monitor className="w-5 h-5 mb-1.5" /> },
                        { label: 'Network Issue', icon: <Wifi className="w-5 h-5 mb-1.5" /> },
                        { label: 'Reset Password', icon: <Key className="w-5 h-5 mb-1.5" /> },
                        { label: 'Other Request', icon: <Plus className="w-5 h-5 mb-1.5" /> },
                      ].map((item, idx) => (
                        <button key={idx} onClick={() => navigate('/?view=all', { state: { openModal: true } })} className="flex flex-col items-center justify-center p-3 bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 text-slate-600 rounded transition-colors text-[10px] font-semibold text-center shadow-sm">
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Frequent Cases for Users */}
                {!isITStaff && (
                  <div className="bg-white rounded border border-slate-200 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-indigo-500" />
                      Department Trends
                    </h3>
                    <div className="space-y-4">
                      {problemTypeData.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center">No data</p>
                      ) : (
                        problemTypeData.map((item, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between items-center mb-1 text-xs">
                              <span className="font-semibold text-slate-700 truncate pr-2">{item.name}</span>
                              <span className="font-bold text-slate-500">{item.value}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded overflow-hidden">
                              <div className="h-full transition-all duration-1000" style={{ width: `${(item.value / Math.max(...problemTypeData.map(d => d.value))) * 100}%`, backgroundColor: COLORS[idx % COLORS.length] }}></div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* IT Performance Stats - Formal version */}
                {isITStaff && (
                  <div className="bg-slate-800 rounded border border-slate-700 p-5 shadow-sm text-white">
                    <div className="mb-4 border-b border-slate-700 pb-3 flex justify-between items-center">
                      <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400" /> Performance
                      </h3>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">Last 30 Days</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mb-1">SLA Hit Rate</p>
                        <p className="text-2xl font-bold">{performanceStats?.slaRate}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Avg Resolution</p>
                        <p className="text-2xl font-bold">{performanceStats?.avgTime}h</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Due Soon */}
                <div className={`rounded border p-5 shadow-sm transition-colors duration-300 ${dueSoonTickets.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                  <h3 className={`text-sm font-bold mb-4 border-b pb-3 flex items-center gap-2 ${dueSoonTickets.length > 0 ? 'text-red-700 border-red-200' : 'text-slate-800 border-slate-100'}`}>
                    {dueSoonTickets.length > 0 ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4 text-slate-400" />}
                    Overdue & Upcoming
                  </h3>

                  {dueSoonTickets.length === 0 ? (
                    <div className="text-center py-4">
                      <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-500">No imminent deadlines</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {dueSoonTickets.map(r => (
                        <div key={r.id} onClick={() => navigate('/?view=all', { state: { ticketId: r.id } })} className="flex items-center justify-between p-3 bg-white rounded border border-red-100 shadow-sm hover:border-red-300 cursor-pointer transition-colors">
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="text-xs font-semibold text-slate-800 truncate">{r.project_name}</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5">{r.req_id}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded border shrink-0 ${r.daysLeft < 0 ? 'bg-red-50 border-red-200 text-red-700' :
                            r.daysLeft === 0 ? 'bg-orange-50 border-orange-200 text-orange-700' :
                              'bg-amber-50 border-amber-200 text-amber-700'
                            }`}>
                            {r.daysLeft < 0 ? 'Overdue' : r.daysLeft === 0 ? 'Today' : `${r.daysLeft} days`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Ticket Aging */}
                {isITStaff && agingTickets.length > 0 && (
                  <div className="bg-amber-50 rounded border border-amber-200 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-amber-700 mb-4 border-b border-amber-200 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Aging Tickets (24h+)
                      </div>
                      <span className="text-[10px] bg-amber-100 px-2 py-0.5 rounded text-amber-700 font-bold border border-amber-300">
                        {agingTickets.length}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {agingTickets.map(r => (
                        <div
                          key={r.id}
                          onClick={() => navigate('/?view=all', { state: { ticketId: r.id } })}
                          className="flex items-center justify-between p-3 bg-white rounded border border-amber-100 hover:border-amber-300 cursor-pointer transition-colors group shadow-sm"
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-amber-700">{r.project_name}</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                              {r.req_id} • {r.assigned_name?.split(' ')[0] || r.empCode_assigned}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-1 rounded border shrink-0 bg-amber-50 border-amber-200 text-amber-700">
                            {r.hoursOpen >= 48 ? `${Math.floor(r.hoursOpen / 24)}d` : `${r.hoursOpen}h`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Critical & Unassigned Alert */}
                {isITStaff && criticalUnassigned.length > 0 && (
                  <div className="bg-rose-50 rounded border border-rose-300 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-rose-700 mb-4 border-b border-rose-200 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Critical & Unassigned
                      </div>
                      <span className="text-[10px] bg-rose-100 px-2 py-0.5 rounded text-rose-700 font-bold border border-rose-300">
                        {criticalUnassigned.length}
                      </span>
                    </h3>
                    <div className="space-y-2">
                      {criticalUnassigned.slice(0, 3).map(r => (
                        <div
                          key={r.id}
                          onClick={() => navigate('/?view=all', { state: { ticketId: r.id } })}
                          className="flex items-center justify-between p-3 bg-white rounded border border-rose-200 hover:border-rose-400 cursor-pointer transition-colors group shadow-sm"
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-rose-600">{r.project_name}</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5">{r.req_id}</p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-rose-400 group-hover:text-rose-600 transition-colors shrink-0" />
                        </div>
                      ))}
                      {criticalUnassigned.length > 3 && (
                        <button onClick={() => navigate('/?view=all')} className="w-full py-2 mt-2 text-xs font-semibold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 rounded transition-colors shadow-sm">
                          View remaining {criticalUnassigned.length - 3} tickets
                        </button>
                      )}
                    </div>
                  </div>
                )}


                {/* IT Admin: Pending Queue */}
                {isITStaff && pendingQueue.length > 0 && (
                  <div className="bg-white rounded border border-slate-200 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-600" /> New Queue
                      </div>
                      <span className="text-[10px] bg-emerald-50 px-2 py-0.5 rounded text-emerald-700 font-bold border border-emerald-200">{pendingQueue.length}</span>
                    </h3>
                    <div className="space-y-2">
                      {pendingQueue.slice(0, 3).map(r => (
                        <div key={r.id} onClick={() => navigate('/?view=all', { state: { ticketId: r.id } })} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-200 hover:border-blue-300 cursor-pointer transition-colors group shadow-sm">
                          <div className="flex-1 min-w-0 pr-3">
                            <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-600">{r.project_name}</p>
                            {/* Null Safety Appled (Suggestion 4) */}
                            <p className="text-[10px] font-medium text-slate-500 mt-0.5">{r.requester_name?.split(' ')[0] || r.empCode_created || 'Unknown'}</p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
                        </div>
                      ))}
                      {pendingQueue.length > 3 && (
                        <button onClick={() => navigate('/?view=all')} className="w-full py-2 mt-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded transition-colors shadow-sm">
                          View remaining {pendingQueue.length - 3} tickets
                        </button>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}