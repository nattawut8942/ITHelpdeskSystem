import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ticketAPI } from '../utils/apiClient';
import Sidebar from '../components/Sidebar';
import MobileNavbar from '../components/MobileNavbar';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
  Lock, TrendingUp, Users, Clock, CheckCircle, BarChart2,
  AlertTriangle, Target, Activity, Database, User
} from 'lucide-react';

const COLORS_STATUS = {
  Closed: '#10b981', 'In Progress': '#3b82f6',
  Open: '#f59e0b', Rejected: '#ef4444', Cancelled: '#64748b'
};

// Formal Palette (Suggestion: Muted, professional tones)
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#8b5cf6', '#ef4444', '#64748b', '#0ea5e9'];

const fmtDays = (ms) => ms > 0 ? (ms / 86400000).toFixed(1) : '0';
const slaColor = (pct) => pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-500' : 'text-rose-500';
const slaBg = (pct) => pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-400' : 'bg-rose-500';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white text-slate-800 p-4 rounded border border-slate-300 shadow-sm text-sm font-semibold">
        <p className="font-bold text-slate-600 mb-2">{label || payload[0].name}</p>
        {payload.map((p, idx) => (
          <p key={idx} className="flex items-center gap-2 mt-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color || p.payload.fill || '#3b82f6' }}></span>
            <span>{p.name}: <span className="font-bold text-slate-800">{p.value}</span></span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ReportPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const isITStaff = user?.cost_center === '7510';

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredByDate = useMemo(() => {
    if (!startDate && !endDate) return requests;
    return requests.filter(r => {
      const d = new Date(r.created_at);
      if (startDate && d < new Date(startDate)) return false;
      if (endDate && d > new Date(endDate + 'T23:59:59')) return false;
      return true;
    });
  }, [requests, startDate, endDate]);



  useEffect(() => {
    if (!isITStaff) { navigate('/'); return; }
    (async () => {
      setIsLoading(true);
      try {
        const res = await ticketAPI.getTickets();
        const tickets = res.data.data || res.data;
        setRequests(Array.isArray(tickets) ? tickets : []);
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    })();
  }, [isITStaff, navigate]);

  // KPIs
  const kpi = useMemo(() => {
    if (!filteredByDate.length) return { total: 0, completed: 0, rate: 0, avgDays: '0', slaRate: 0, overdue: 0, critical: 0, pending: 0, inProgress: 0, rejected: 0, cancelled: 0 };
    const completed = filteredByDate.filter(r => r.status === 'Closed');
    const withTime = completed.filter(r => r.accepted_at && r.completed_at);
    const avgMs = withTime.length ? withTime.reduce((s, r) => s + (new Date(r.completed_at) - new Date(r.accepted_at)), 0) / withTime.length : 0;
    const onTime = completed.filter(r => r.target_date && r.completed_at && new Date(r.completed_at) <= new Date(r.target_date)).length;
    const overdue = requests.filter(r => !['Closed', 'Rejected', 'Cancelled'].includes(r.status) && r.target_date && new Date(r.target_date) < new Date()).length;
    return {
      total: requests.length,
      completed: completed.length,
      rejected: requests.filter(r => r.status === 'Rejected').length,
      cancelled: requests.filter(r => r.status === 'Cancelled').length,
      inProgress: requests.filter(r => r.status === 'In Progress').length,
      pending: requests.filter(r => r.status === 'Open').length,
      rate: Math.round((completed.length / requests.length) * 100),
      avgDays: fmtDays(avgMs),
      slaRate: completed.length ? Math.round((onTime / completed.length) * 100) : 0,
      overdue, critical: requests.filter(r => r.priority === 'Critical' && r.status !== 'Closed').length,
    };
  }, [requests]);



  const oldestOpenTickets = useMemo(() => {
    const now = new Date();
    return requests
      .filter(r => !['Closed', 'Rejected', 'Cancelled'].includes(r.status))
      .map(r => ({ ...r, ageDays: Math.floor((now - new Date(r.created_at)) / (1000 * 60 * 60 * 24)) }))
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [requests]);

  const [oldestPage, setOldestPage] = useState(1);
  const OLDEST_PER_PAGE = 5;

  const oldestTotalPages = Math.ceil(oldestOpenTickets.length / OLDEST_PER_PAGE);
  const paginatedOldest = oldestOpenTickets.slice(
    (oldestPage - 1) * OLDEST_PER_PAGE,
    oldestPage * OLDEST_PER_PAGE
  );

  useEffect(() => { setOldestPage(1); }, [oldestOpenTickets.length]);

  const ageSeverity = (days) => {
    if (days >= 14) return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' };
    if (days >= 7) return { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
    return { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
  };




  // Data processing functions
  const monthlyData = useMemo(() => {
    const map = {};
    requests.forEach(r => {
      const d = new Date(r.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
      if (!map[key]) map[key] = { key, month: label, total: 0, completed: 0 };
      map[key].total++;
      if (r.status === 'Closed') map[key].completed++;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).slice(-8);
  }, [requests]);

  const statusData = useMemo(() => {
    const map = {};
    requests.forEach(r => { map[r.status] = (map[r.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [requests]);

  const typeData = useMemo(() => {
    const map = {};
    requests.forEach(r => {
      const key = r.problem_type_name || r.request_type || 'Other';
      if (!map[key]) map[key] = { name: key, total: 0, completed: 0 };
      map[key].total++;
      if (r.status === 'Closed') map[key].completed++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [requests]);

  const subtypeData = useMemo(() => {
    const map = {};
    requests.forEach(r => { if (r.problem_subtype_name) map[r.problem_subtype_name] = (map[r.problem_subtype_name] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [requests]);

  const staffData = useMemo(() => {
    const map = {};

    requests.forEach(r => {
      if (!r.empCode_assigned) return;
      const key = r.empCode_assigned;
      if (!map[key]) map[key] = { empCode: key, name: r.assigned_name || r.empCode_assigned, total: 0, completed: 0, totalMs: 0, count: 0, onTime: 0, asHelper: 0 };
      map[key].total++;
      if (r.status === 'Closed') {
        map[key].completed++;
        if (r.accepted_at && r.completed_at) {
          map[key].totalMs += new Date(r.completed_at) - new Date(r.accepted_at);
          map[key].count++;
        }
        if (r.target_date && r.completed_at && new Date(r.completed_at) <= new Date(r.target_date))
          map[key].onTime++;
      }
    });

    requests.forEach(r => {
      if (!r.helpers || !r.helpers.length) return;
      r.helpers.forEach(h => {
        const key = h.empCode;
        if (!map[key]) map[key] = { empCode: key, name: h.name || h.empCode, total: 0, completed: 0, totalMs: 0, count: 0, onTime: 0, asHelper: 0 };
        map[key].asHelper = (map[key].asHelper || 0) + 1;
      });
    });

    return Object.values(map).map(s => ({
      ...s,
      asHelper: s.asHelper || 0,
      avgDays: s.count ? fmtDays(s.totalMs / s.count) : '-',
      rate: s.total ? Math.round((s.completed / s.total) * 100) : 0,
      sla: s.completed ? Math.round((s.onTime / s.completed) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [requests]);


  const technicianMatrix = useMemo(() => {
    const matrix = {};
    const categories = new Set();
    filteredByDate.forEach(r => {
      if (!r.empCode_assigned) return;
      const tech = r.assigned_name || r.empCode_assigned;
      const cat = r.problem_type_name || r.request_type || 'Other';
      categories.add(cat);
      if (!matrix[tech]) matrix[tech] = {};
      matrix[tech][cat] = (matrix[tech][cat] || 0) + 1;
    });
    return {
      rows: Object.entries(matrix).sort((a, b) =>
        Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0)
      ), categories: Array.from(categories)
    };
  }, [filteredByDate]);



  const topRequestersData = useMemo(() => {
    const map = {};
    requests.forEach(r => {
      if (!r.empCode_created) return;
      const key = r.empCode_created;
      if (!map[key]) map[key] = { empCode: key, name: r.requester_name || r.empCode_created, cc: r.cost_center, total: 0 };
      map[key].total++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [requests]);

  const activeRequestersData = useMemo(() => {
    const map = {};
    filteredByDate
      .filter(r => !['Closed', 'Rejected', 'Cancelled'].includes(r.status))
      .forEach(r => {
        if (!r.empCode_created) return;
        const key = r.empCode_created;
        if (!map[key]) map[key] = { empCode: key, name: r.requester_name || r.empCode_created, open: 0, inProgress: 0, hold: 0, total: 0 };
        map[key].total++;
        if (r.status === 'Open') map[key].open++;
        if (r.status === 'In Progress') map[key].inProgress++;
        if (r.status === 'On Hold') map[key].hold++;
      });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filteredByDate]);


  const deptData = useMemo(() => {
    const map = {};
    requests.forEach(r => {
      const key = r.cost_center || 'N/A';
      if (!map[key]) map[key] = { cc: key, total: 0, completed: 0, critical: 0 };
      map[key].total++;
      if (r.status === 'Closed') map[key].completed++;
      if (r.priority === 'Critical') map[key].critical++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [requests]);

  const locationData = useMemo(() => {
    const mainMap = {};
    const allSubs = new Set();

    requests.forEach(r => {
      const loc = r.location || 'N/A';
      let main = loc;
      let sub = 'ทั่วไป (General)';
      if (loc.includes('›')) {
        const parts = loc.split('›');
        main = parts[0].trim();
        sub = parts.slice(1).join('›').trim();
      }

      if (!mainMap[main]) mainMap[main] = { name: main, total: 0 };
      mainMap[main].total += 1;
      mainMap[main][sub] = (mainMap[main][sub] || 0) + 1;
    });

    const sortedData = Object.values(mainMap).sort((a, b) => b.total - a.total).slice(0, 8);

    sortedData.forEach(item => {
      Object.keys(item).forEach(k => {
        if (k !== 'name' && k !== 'total') allSubs.add(k);
      });
    });

    return { data: sortedData, subKeys: Array.from(allSubs) };
  }, [requests]);

  const slaByType = useMemo(() => {
    const map = {};
    requests.filter(r => r.status === 'Closed').forEach(r => {
      const key = r.problem_type_name || r.request_type || 'Other';
      if (!map[key]) map[key] = { type: key, total: 0, onTime: 0, totalMs: 0, count: 0 };
      map[key].total++;
      if (r.target_date && r.completed_at && new Date(r.completed_at) <= new Date(r.target_date)) map[key].onTime++;
      if (r.accepted_at && r.completed_at) { map[key].totalMs += new Date(r.completed_at) - new Date(r.accepted_at); map[key].count++; }
    });
    return Object.values(map).map(d => ({
      ...d,
      sla: Math.round((d.onTime / d.total) * 100),
      avgDays: d.count ? parseFloat(fmtDays(d.totalMs / d.count)) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [requests]);

  const priorityData = useMemo(() =>
    ['Critical', 'High', 'Medium', 'Normal'].map(p => ({ name: p, value: requests.filter(r => r.priority === p).length }))
    , [requests]);

  if (!isITStaff) return null;

  const tabs = [
    { id: 'overview', label: 'ภาพรวม (Overview)' },
    { id: 'type', label: 'ประเภทปัญหา (Types)' },
    { id: 'staff', label: 'ทีมงาน (IT Staff)' },
    { id: 'dept', label: 'แผนก / สถานที่ (Locations)' },
    { id: 'sla', label: 'SLA (Service Level)' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col md:flex-row overflow-hidden">

      {/* Mobile Navbar */}
      <MobileNavbar user={user} onMenuClick={() => setMobileOpen(true)} />

      {/* Sidebar */}
      <Sidebar user={user} isITStaff={isITStaff} logout={logout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Area - Formal Sharp Borders */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden p-0 md:p-6">
        <div className="bg-white rounded shadow-sm flex flex-col h-full overflow-hidden border border-slate-200">

          {/* Header - Formal without gradients */}
          <header className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <BarChart2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Analytics & Reports</h1>
                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">ภาพรวมการให้บริการ IT Help Desk</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-xs uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200 px-4 py-2 rounded font-bold shadow-sm">
                <Lock className="w-4 h-4" /> IT Admin Only
              </span>
            </div>
          </header>

          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm" />
            <span className="text-xs text-slate-400">ถึง</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="bg-white border border-slate-300 rounded px-3 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 shadow-sm" />
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-xs font-semibold text-rose-500 hover:text-rose-700 px-2">
                Reset
              </button>
            )}
          </div>
          {/* Tabs (Formal Square Style) */}
          <div className="px-6 py-4 bg-white border-b border-slate-200 flex gap-2 overflow-x-auto custom-scrollbar shrink-0">
            <div className="flex rounded border border-slate-300 overflow-hidden shadow-sm">
              {tabs.map((t, i) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${tab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                    } ${i > 0 ? 'border-l border-slate-300' : ''}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 text-slate-800 custom-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                <Activity className="w-10 h-10 animate-spin text-blue-500" />
                <span className="font-semibold tracking-widest uppercase text-sm">กำลังประมวลผลข้อมูล...</span>
              </div>
            ) : (
              <div className="w-full space-y-8">

                {/* OVERVIEW TAB */}
                {tab === 'overview' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Main KPIs - Formal Style */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {[
                        { label: 'Ticket ทั้งหมด', value: kpi.total, icon: <BarChart2 className="w-7 h-7 text-indigo-600" />, filterVal: '' },
                        { label: 'Completion Rate', value: `${kpi.rate}%`, icon: <TrendingUp className="w-7 h-7 text-emerald-600" />, filterVal: '' },
                        { label: 'Avg. Resolution', value: `${kpi.avgDays} วัน`, icon: <Clock className="w-7 h-7 text-blue-600" />, filterVal: '' },
                        { label: 'SLA On-time', value: `${kpi.slaRate}%`, icon: <Target className="w-7 h-7 text-amber-600" />, filterVal: '' },
                      ].map((s, i) => (
                        <div key={i} className="bg-white rounded border border-slate-200 p-6 flex items-center justify-between shadow-sm transition-colors hover:border-blue-400">
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{s.label}</p>
                            <p className="text-4xl font-bold text-slate-800 leading-none">{s.value}</p>
                          </div>
                          <div className="w-14 h-14 rounded bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                            {s.icon}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Status Breakdown Mini Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-5">
                      {[
                        { label: 'รอดำเนินการ', value: kpi.pending, color: 'bg-amber-50 border-amber-200 text-amber-700' },
                        { label: 'กำลังทำ', value: kpi.inProgress, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                        { label: 'เสร็จแล้ว', value: kpi.completed, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                        { label: 'Rejected', value: kpi.rejected, color: 'bg-rose-50 border-rose-200 text-rose-700' },
                        { label: 'เกินกำหนด (Overdue)', value: kpi.overdue, color: kpi.overdue > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-50 border-slate-200 text-slate-500' },
                      ].map((s, i) => (
                        <div key={i} className={`rounded border p-5 text-center shadow-sm ${s.color}`}>
                          <p className="text-4xl font-bold">{s.value}</p>
                          <p className="text-xs font-semibold mt-2 uppercase tracking-wider">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                      {/* Trend Chart */}
                      <div className="col-span-1 lg:col-span-2 bg-white rounded border border-slate-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-slate-400" /> Ticket Trend รายเดือน
                        </h3>
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} /><stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b', fontWeight: '600' }} axisLine={false} tickLine={false} dy={10} />
                            <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: '600' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="total" name="Ticket ทั้งหมด" stroke="#94a3b8" fill="url(#gTotal)" strokeWidth={2} />
                            <Area type="monotone" dataKey="completed" name="เสร็จแล้ว" stroke="#3b82f6" fill="url(#gDone)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Status Pie Chart */}
                      <div className="bg-white rounded border border-slate-200 shadow-sm p-6 flex flex-col">
                        <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-slate-400" /> Status Distribution
                        </h3>
                        <div className="flex-1 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={2}>
                                {statusData.map((e, i) => <Cell key={i} fill={COLORS_STATUS[e.name] || '#94a3b8'} stroke="none" />)}
                              </Pie>
                              <Legend iconType="square" iconSize={10} formatter={v => <span className="text-xs font-semibold text-slate-600 ml-1.5">{v}</span>} />
                              <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Priority Breakdown */}
                    <div className="bg-white rounded border border-slate-200 shadow-sm p-6">
                      <h3 className="text-base font-bold text-slate-800 mb-6">Priority Breakdown</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {priorityData.map(p => {
                          const cfg = {
                            Critical: { color: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
                            High: { color: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                            Medium: { color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                            Normal: { color: 'bg-slate-400', light: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' }
                          }[p.name] || {};
                          const pct = kpi.total ? Math.round((p.value / kpi.total) * 100) : 0;
                          return (
                            <div key={p.name} className={`rounded border ${cfg.border} ${cfg.light} p-5 shadow-sm`}>
                              <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${cfg.text}`}>{p.name}</p>
                              <p className="text-4xl font-bold text-slate-800">{p.value}</p>
                              <div className="mt-4 h-2 bg-white rounded overflow-hidden shadow-inner border border-slate-200/50">
                                <div className={`h-full ${cfg.color}`} style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-xs font-semibold text-slate-500 mt-2 uppercase">{pct}% of total requests</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {/* Oldest Open Tickets */}
                <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-slate-400" /> เคสค้างนานที่สุด (Oldest Open)
                    </h3>
                    <span className="text-[10px] bg-rose-50 px-2 py-1 rounded text-rose-700 font-bold border border-rose-200">
                      {oldestOpenTickets.length} เคส
                    </span>
                  </div>
                  {oldestOpenTickets.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-sm font-medium">ไม่มีเคสค้างอยู่ 🎉</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-white text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4">Ticket</th>
                              <th className="px-4 py-4">ผู้แจ้ง</th>
                              <th className="px-4 py-4">สถานะ</th>
                              <th className="px-4 py-4">ผู้รับผิดชอบ</th>
                              <th className="px-6 py-4 text-right">ค้างมาแล้ว</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedOldest.map(t => {
                              const sev = ageSeverity(t.ageDays);
                              return (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4">
                                    <p className="font-semibold text-slate-700 text-sm truncate max-w-[300px]">{t.project_name}</p>
                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{t.req_id}</p>
                                  </td>
                                  <td className="text-sm text-slate-600">{t.requester_name?.split(' ')[0] || t.empCode_created}</td>
                                  <td>
                                    <span className="px-2 py-1 rounded text-xs font-semibold border bg-slate-50 border-slate-200 text-slate-600">{t.status}</span>
                                  </td>
                                  <td className="text-sm text-slate-600">{t.assigned_name?.split(' ')[0] || 'Unassigned'}</td>
                                  <td className="px-6 py-4 text-right">
                                    <span className={`px-3 py-1 rounded text-xs font-bold border ${sev.bg} ${sev.border} ${sev.text}`}>
                                      {t.ageDays} วัน
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {oldestTotalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
                          <p className="text-xs font-medium text-slate-500">
                            แสดง {(oldestPage - 1) * OLDEST_PER_PAGE + 1}–{Math.min(oldestPage * OLDEST_PER_PAGE, oldestOpenTickets.length)} จาก {oldestOpenTickets.length} รายการ
                          </p>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setOldestPage(p => Math.max(1, p - 1))} disabled={oldestPage === 1}
                              className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-30 transition-colors">
                              Prev
                            </button>
                            {Array.from({ length: oldestTotalPages }, (_, i) => i + 1).map(page => (
                              <button key={page} onClick={() => setOldestPage(page)}
                                className={`w-8 py-1.5 rounded border text-xs font-semibold transition-colors ${oldestPage === page
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                  }`}>
                                {page}
                              </button>
                            ))}
                            <button onClick={() => setOldestPage(p => Math.min(oldestTotalPages, p + 1))} disabled={oldestPage === oldestTotalPages}
                              className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-30 transition-colors">
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* TYPE TAB */}
                {tab === 'type' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                      <div className="bg-white rounded border border-slate-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                          <Database className="w-5 h-5 text-slate-400" /> ประเภทปัญหาหลัก (Main Types)
                        </h3>
                        <div className="space-y-5">
                          {typeData.map((t, i) => {
                            const pct = kpi.total ? Math.round((t.total / kpi.total) * 100) : 0;
                            const rate = t.total ? Math.round((t.completed / t.total) * 100) : 0;
                            return (
                              <div key={t.name}>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-semibold text-slate-700 flex items-center gap-2.5">
                                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                                    {t.name}
                                  </span>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className="font-semibold text-slate-600">{t.total} เคส</span>
                                    <span className={`font-bold ${rate >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{rate}% done</span>
                                  </div>
                                </div>
                                <div className="h-2 bg-slate-100 rounded overflow-hidden">
                                  <div className="h-full" style={{ width: `${pct}%`, background: PALETTE[i % PALETTE.length] }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-white rounded border border-slate-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-slate-800 mb-6">ประเภทย่อยที่พบบ่อย (Sub-types)</h3>
                        {subtypeData.length === 0 ? (
                          <div className="flex h-full items-center justify-center pb-10">
                            <p className="text-slate-400 text-sm font-medium">ยังไม่มีข้อมูล</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={subtypeData} layout="vertical" barSize={16} margin={{ top: 0, right: 20, left: -10, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: '#64748b', fontWeight: '500' }} axisLine={false} tickLine={false} />
                              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                              <Bar dataKey="value" name="จำนวน (Tickets)" radius={[0, 3, 3, 0]}>
                                {subtypeData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-base font-bold text-slate-800">สรุปสถานะแต่ละประเภทปัญหา</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-white text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4">ประเภทปัญหา</th>
                              <th className="text-center px-4 py-4">ทั้งหมด</th>
                              <th className="text-center px-4 py-4">รอ (Pending)</th>
                              <th className="text-center px-4 py-4">กำลังทำ (In Prog)</th>
                              <th className="text-center px-4 py-4">เสร็จ (Done)</th>
                              <th className="text-center px-4 py-4">Reject</th>
                              <th className="text-center px-6 py-4">Completion</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {typeData.map((t, i) => {
                              const rows = requests.filter(r => (r.problem_type_name || r.request_type) === t.name);
                              const pending = rows.filter(r => r.status === 'Open').length;
                              const inProg = rows.filter(r => r.status === 'In Progress').length;
                              const completed = rows.filter(r => r.status === 'Closed').length;
                              const rejected = rows.filter(r => r.status === 'Rejected').length;
                              const rate = rows.length ? Math.round((completed / rows.length) * 100) : 0;
                              return (
                                <tr key={t.name} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 flex items-center gap-3 text-sm font-semibold text-slate-700">
                                    <span className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                                    {t.name}
                                  </td>
                                  <td className="text-center text-sm font-bold text-slate-800">{t.total}</td>
                                  <td className="text-center text-sm font-medium text-amber-600">{pending}</td>
                                  <td className="text-center text-sm font-medium text-blue-600">{inProg}</td>
                                  <td className="text-center text-sm font-medium text-emerald-600">{completed}</td>
                                  <td className="text-center text-sm font-medium text-rose-500">{rejected}</td>
                                  <td className="text-center px-6 py-4">
                                    <span className={`px-3 py-1 rounded text-xs font-bold border ${rate >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                      {rate}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* STAFF TAB */}
                {tab === 'staff' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: 'IT Staff ที่รับเคส', value: staffData.length, icon: <Users className="w-6 h-6 text-indigo-600" />, bgIcon: 'bg-indigo-50 border border-indigo-100' },
                        { label: 'เคสที่ Assign แล้ว', value: requests.filter(r => r.empCode_assigned).length, icon: <CheckCircle className="w-6 h-6 text-blue-600" />, bgIcon: 'bg-blue-50 border border-blue-100' },
                        { label: 'เคสที่ยังไม่มีคนรับ', value: requests.filter(r => !r.empCode_assigned && r.status === 'Open').length, icon: <Clock className="w-6 h-6 text-amber-600" />, bgIcon: 'bg-amber-50 border border-amber-100' },
                      ].map((s, i) => (
                        <div key={i} className="bg-white rounded border border-slate-200 p-6 flex items-center justify-between shadow-sm">
                          <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">{s.label}</p>
                            <p className="text-4xl font-bold text-slate-800 leading-none">{s.value}</p>
                          </div>
                          <div className={`w-14 h-14 rounded flex items-center justify-center shrink-0 ${s.bgIcon}`}>
                            {s.icon}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <Users className="w-5 h-5 text-slate-400" /> IT Staff Performance
                        </h3>
                      </div>
                      {staffData.length === 0 ? (
                        <div className="py-20 text-center">
                          <p className="text-slate-500 text-sm font-medium">ยังไม่มีข้อมูลการมอบหมายงาน</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-white text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200">
                              <tr>
                                <th className="px-6 py-4">ชื่อทีมงาน (Staff Name)</th>
                                <th className="text-center px-4 py-4">รับเคสทั้งหมด</th>
                                <th className="text-center px-4 py-4">ปิดเคสแล้ว</th>
                                <th className="text-center px-4 py-4">อัตราสำเร็จ</th>
                                <th className="text-center px-4 py-4">เวลาเฉลี่ย</th>
                                <th className="text-center px-4 py-4">SLA (On-time)</th>
                                <th className="text-center px-4 py-4">ช่วยเป็น Helper</th>
                                <th className="px-6 py-4 text-left">Workload Bar</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {staffData.map(s => (
                                <tr key={s.name} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 flex items-center gap-4">
                                    <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                                      <img
                                        src={`http://dcidmc.dci.daikin.co.jp/PICTURE/${s.empCode}.jpg`}
                                        alt={s.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                      />
                                      <div className="hidden absolute inset-0 items-center justify-center text-sm font-bold text-slate-500 bg-slate-50">
                                        {s.name?.charAt(0) || '?'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-700 text-sm block">{s.name}</span>
                                      <span className="text-[11px] text-slate-400 font-mono">ID: {s.empCode}</span>
                                    </div>
                                  </td>
                                  <td className="text-center text-sm font-bold text-slate-800">{s.total}</td>
                                  <td className="text-center text-sm font-medium text-emerald-600">{s.completed}</td>
                                  <td className="text-center text-sm">
                                    <span className={`font-semibold ${s.rate >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{s.rate}%</span>
                                  </td>
                                  <td className="text-center text-sm text-slate-600">{s.avgDays} <span className="text-[10px]">วัน</span></td>
                                  <td className="text-center">
                                    <span className={`px-2.5 py-1 rounded text-xs font-bold border ${slaBg(s.sla).replace('bg-', 'bg-').replace('500', '50').replace('400', '50')} ${slaColor(s.sla)} ${slaColor(s.sla).replace('text-', 'border-').replace('600', '200').replace('500', '200')}`}>{s.sla}%</span>
                                  </td>
                                  <td className="text-center text-sm font-medium text-purple-600">{s.asHelper || 0}</td>
                                  <td className="px-6 py-4 w-[180px]">
                                    <div className="h-2 bg-slate-100 rounded overflow-hidden w-full">
                                      <div className={`h-full ${slaBg(s.rate)}`} style={{ width: `${(s.total / (staffData[0]?.total || 1)) * 100}%` }} />
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-base font-bold text-slate-800">Technician × ประเภทงาน</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 sticky left-0 bg-white">Technician</th>
                          {technicianMatrix.categories.map(c => (
                            <th key={c} className="text-center px-3 py-4 whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {technicianMatrix.rows.map(([tech, counts]) => {
                          const max = Math.max(...Object.values(counts));
                          return (
                            <tr key={tech} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 font-semibold text-slate-700 sticky left-0 bg-white">{tech}</td>
                              {technicianMatrix.categories.map(c => {
                                const v = counts[c] || 0;
                                const intensity = v === 0 ? 0 : v / max;
                                return (
                                  <td key={c} className="text-center px-3 py-2">
                                    {v > 0 ? (
                                      <span
                                        className="inline-flex items-center justify-center w-8 h-8 rounded text-xs font-bold"
                                        style={{ background: `rgba(59,130,246,${0.15 + intensity * 0.5})`, color: intensity > 0.5 ? '#fff' : '#1e40af' }}
                                      >
                                        {v}
                                      </span>
                                    ) : <span className="text-slate-200">–</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* DEPT TAB */}
                {tab === 'dept' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-white rounded border border-slate-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                          <Activity className="w-5 h-5 text-slate-400" /> แผนกที่แจ้งปัญหามากที่สุด (Top Cost Centers)
                        </h3>
                        <div className="space-y-4">
                          {deptData.map((d, i) => {
                            const pct = kpi.total ? Math.round((d.total / kpi.total) * 100) : 0;
                            const rate = d.total ? Math.round((d.completed / d.total) * 100) : 0;
                            return (
                              <div key={d.cc} className="p-4 rounded border border-slate-100 bg-slate-50/50 hover:bg-white transition-colors">
                                <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">{i + 1}</div>
                                    <span className="font-mono text-slate-700 text-sm font-semibold">CC: {d.cc}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs font-bold">
                                    {d.critical > 0 && <span className="text-rose-600 font-medium">🔴 Critical: {d.critical}</span>}
                                    <span className="text-slate-600 text-sm">{d.total} เคส</span>
                                    <span className={rate >= 70 ? 'text-emerald-500' : 'text-amber-500'}>{rate}% done</span>
                                  </div>
                                </div>
                                <div className="h-2 bg-slate-200/50 rounded overflow-hidden">
                                  <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="bg-white rounded border border-slate-200 shadow-sm p-6">
                        <h3 className="text-base font-bold text-slate-800 mb-6">สถานที่ที่แจ้งปัญหา (Locations)</h3>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={locationData.data} layout="vertical" barSize={16} margin={{ top: 0, right: 20, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: '#64748b', fontWeight: '500' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                            {locationData.subKeys.map((sub, i) => (
                              <Bar key={sub} dataKey={sub} name={sub} stackId="a" fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Top Requesters */}
                    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <Users className="w-5 h-5 text-slate-400" /> พนักงานที่แจ้งปัญหาบ่อยที่สุด (Top Requesters)
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-white text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4">พนักงาน (Requester)</th>
                              <th className="text-center px-4 py-4">แผนก (Cost Center)</th>
                              <th className="text-center px-4 py-4">จำนวนเคสทั้งหมด</th>
                              <th className="text-center px-6 py-4">สถานะเปิดอยู่ (Open)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {topRequestersData.map((u, idx) => {
                              const open = requests.filter(r => r.empCode_created === u.empCode && r.status === 'Open').length;
                              return (
                                <tr key={u.empCode} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 flex items-center gap-4">
                                    <span className="w-6 h-6 rounded bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                                    <div className="w-10 h-10 rounded bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                      <img
                                        src={`http://dcidmc.dci.daikin.co.jp/PICTURE/${u.empCode}.jpg`}
                                        alt={u.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                      />
                                      <div className="hidden absolute inset-0 items-center justify-center text-slate-400 bg-slate-50">
                                        <User className="w-5 h-5" />
                                      </div>
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-700 text-sm block">{u.name}</span>
                                      <span className="text-[11px] text-slate-400 font-mono">ID: {u.empCode}</span>
                                    </div>
                                  </td>
                                  <td className="text-center text-sm font-medium text-slate-600">{u.cc}</td>
                                  <td className="text-center text-lg font-bold text-slate-800">{u.total}</td>
                                  <td className="text-center px-6 py-4">
                                    <span className={`text-sm font-semibold ${open > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{open}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-base font-bold text-slate-800">ผู้แจ้งที่มีเคสค้างมากสุด (Not Closed)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-white text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4">พนักงาน</th>
                          <th className="text-center px-4 py-4">Open</th>
                          <th className="text-center px-4 py-4">In Progress</th>
                          <th className="text-center px-4 py-4">On Hold</th>
                          <th className="text-center px-6 py-4">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeRequestersData.map(u => (
                          <tr key={u.empCode} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-700 text-sm">{u.name}</td>
                            <td className="text-center text-sm font-medium text-emerald-600">{u.open}</td>
                            <td className="text-center text-sm font-medium text-blue-600">{u.inProgress}</td>
                            <td className="text-center text-sm font-medium text-amber-600">{u.hold}</td>
                            <td className="text-center px-6 py-4"><span className="font-bold text-slate-800 text-base">{u.total}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>


                {/* SLA TAB */}
                {tab === 'sla' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: 'SLA Overall', value: `${kpi.slaRate}%`, sub: 'เปอร์เซ็นต์การปิดเคสตามกำหนด', color: kpi.slaRate >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200' },
                        { label: 'Overdue Tickets', value: kpi.overdue, sub: 'เคสที่เกินกำหนดเวลาและยังเปิดอยู่', color: kpi.overdue > 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-700 bg-slate-50 border-slate-200' },
                        { label: 'Critical Active', value: kpi.critical, sub: 'เคสระดับ Critical ที่กำลังดำเนินการ', color: kpi.critical > 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-slate-700 bg-slate-50 border-slate-200' },
                      ].map((s, i) => (
                        <div key={i} className={`rounded border p-6 shadow-sm ${s.color}`}>
                          <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2">{s.label}</p>
                          <p className="text-5xl font-bold my-3">{s.value}</p>
                          <p className="text-[11px] font-medium opacity-70 uppercase mt-2">{s.sub}</p>
                        </div>
                      ))}
                    </div>

                    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
                      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                          <Target className="w-5 h-5 text-slate-400" /> SLA Performance ตามประเภทปัญหา
                        </h3>
                      </div>
                      {slaByType.length === 0 ? (
                        <div className="py-20 text-center">
                          <p className="text-slate-400 text-sm font-medium">ยังไม่มีข้อมูลการปิดเคสเพื่อคำนวณ SLA</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-white text-xs text-slate-500 uppercase tracking-widest border-b border-slate-200">
                              <tr>
                                <th className="px-6 py-4">ประเภทปัญหา (Type)</th>
                                <th className="text-center px-4 py-4">เคสที่ปิดแล้ว (Closed)</th>
                                <th className="text-center px-4 py-4">ทันเวลา (On-time)</th>
                                <th className="text-center px-4 py-4">เวลาเฉลี่ย (Avg. Time)</th>
                                <th className="px-6 py-4 text-left">SLA Rate</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {slaByType.map((t, i) => (
                                <tr key={t.type} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 flex items-center gap-3 text-sm font-semibold text-slate-700">
                                    <span className="w-2.5 h-2.5 rounded-sm shadow-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                                    {t.type}
                                  </td>
                                  <td className="text-center text-sm font-bold text-slate-800">{t.total}</td>
                                  <td className="text-center text-sm font-medium text-emerald-600">{t.onTime}</td>
                                  <td className="text-center text-sm text-slate-500">{t.avgDays} <span className="text-[10px]">วัน</span></td>
                                  <td className="px-6 py-4 w-[220px]">
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                                        <div className={`h-full ${slaBg(t.sla)}`} style={{ width: `${t.sla}%` }} />
                                      </div>
                                      <span className={`text-xs font-bold w-10 text-right ${slaColor(t.sla)}`}>{t.sla}%</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}