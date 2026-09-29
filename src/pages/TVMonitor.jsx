import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import * as signalR from '@microsoft/signalr';
import {
  LayoutDashboard, Clock, CheckCircle, MapPin, X, User, Search,
  AlertCircle, Laptop, ArrowRight, Grid, List
} from 'lucide-react';
import { getDeviceTypeColor, getRequestTypeIcon } from '../utils/styleHelpers';
import { API_BASE } from '../config/api';

export default function TVMonitor() {
  // Grid is the default: easier to read at a distance on a large screen.
  // A small toggle button lets whoever sets up the screen switch to list.
  const [layoutMode, setLayoutMode] = useState('grid');

  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [newTicketNotice, setNewTicketNotice] = useState(null);
  const previousTicketIdsRef = useRef(new Set());
  const [notification, setNotification] = useState(null);

  // The ticket id a fresh arrival should auto-scroll the wallboard to.
  const [pendingJumpId, setPendingJumpId] = useState(null);

  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  // Continuous auto-scroll: refs instead of state so the animation loop
  // doesn't trigger re-renders every frame.
  const scrollRef = useRef(null);
  const pausedUntilRef = useRef(0);
  const rafRef = useRef(null);
  const SCROLL_PX_PER_FRAME = 0.5; // ~30px/sec at 60fps
  const PAUSE_AFTER_JUMP_MS = 8000;

  // SignalR is the primary update channel; this poll only exists as a
  // self-healing safety net for a 24/7 unattended screen in case a
  // real-time event is ever missed or the connection silently drops.
  const FALLBACK_POLL_MS = 120000;

  const formatDateShort = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const isToday = (value) => {
    if (!value) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
  };

  const formatThaiDateTime = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok'
    });
  };

  const formatElapsedTime = (start, end) => {
    if (!start || !end) return '-';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '-';
    const diffMs = endDate - startDate;
    if (diffMs <= 0) return '-';
    const totalMinutes = Math.floor(diffMs / 60000);

    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}.${minutes.toString().padStart(2, '0')} hrs`;
    }

    return `${totalMinutes} นาที`;
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // A clock that ticks every second, completely independent of data
  // fetching or SignalR — its purpose is purely to prove the screen is
  // alive and not frozen, even during a stretch with no new tickets.
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const clockTick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockTick);
  }, []);

  const fetchRequests = async (initialLoad = false) => {
    if (initialLoad) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const response = await axios.get(`${API_BASE}/tv/tickets`);
      const tickets = response.data.data || response.data;
      const normalizedTickets = Array.isArray(tickets)
        ? tickets.map(ticket => ({
          ...ticket,
          status: ticket.status === 'Pending'
            ? 'Open'
            : ticket.status === 'Completed'
              ? 'Closed'
              : ticket.status
        }))
        : [];
      if (!initialLoad && previousTicketIdsRef.current.size > 0) {
        const newTickets = normalizedTickets.filter(ticket => !previousTicketIdsRef.current.has(ticket.id));
        if (newTickets.length > 0) {
          setNewTicketNotice({ count: newTickets.length, ticket: newTickets[0] });
          setPendingJumpId(newTickets[0].id);
        }
      }
      previousTicketIdsRef.current = new Set(normalizedTickets.map(ticket => ticket.id));
      setRequests(normalizedTickets);
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error('Fetch error:', error);
      showNotification('Failed to load requests from database', 'error');
    } finally {
      if (initialLoad) setIsLoading(false);
      else setIsRefreshing(false);
    }
  };

  // Real-time updates via SignalR, with a slow polling fallback underneath.
  useEffect(() => {
    fetchRequests(true);

    const hubUrl = API_BASE.replace('/api', '') + '/hubs/tickets';
    // The TV page has no login, so there is normally no auth token. If the
    // hub requires one, this connection will fail to authenticate and
    // connectionStatus will sit on "offline" — the fallback poll below
    // still keeps the board updated (just without instant push updates)
    // until the hub is confirmed to allow anonymous access for this route.
    const token = localStorage.getItem('authToken');
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, token ? { accessTokenFactory: () => token } : {})
      .withAutomaticReconnect()
      .build();

    connection.onreconnecting(() => setConnectionStatus('connecting'));
    connection.onreconnected(() => setConnectionStatus('online'));
    connection.onclose(() => setConnectionStatus('offline'));

    connection.on('TicketsUpdated', () => {
      console.log('[TV DEBUG] ได้รับ event TicketsUpdated เวลา', new Date().toLocaleTimeString());
      fetchRequests(false);
    });

    connection.start()
      .then(() => setConnectionStatus('online'))
      .catch(err => {
        setConnectionStatus('offline');
        console.error('SignalR connect error:', err);
      });

    const fallbackPoll = setInterval(() => fetchRequests(false), FALLBACK_POLL_MS);

    return () => {
      connection.stop();
      clearInterval(fallbackPoll);
    };
  }, []);

  useEffect(() => {
    if (!newTicketNotice) return undefined;
    const timeout = setTimeout(() => setNewTicketNotice(null), 10000);
    return () => clearTimeout(timeout);
  }, [newTicketNotice]);

  const filteredRequests = useMemo(() => {
    let result = requests.filter(r => !['Closed', 'Rejected', 'Cancelled'].includes(r.status));

    result = [...result].sort((a, b) => {
      let valA = a[sortField], valB = b[sortField];
      if (sortField === 'priority') {
        const order = { Critical: 0, High: 1, Medium: 2, Normal: 3 };
        valA = order[valA] ?? 9; valB = order[valB] ?? 9;
      } else if (typeof valA === 'string') {
        valA = valA?.toLowerCase(); valB = valB?.toLowerCase();
      } else {
        valA = new Date(valA); valB = new Date(valB);
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [requests, sortField, sortDir]);

  // Continuous auto-scroll animation. Wraps back to the top when it hits
  // the bottom. Restarts whenever the view switches (grid <-> list) since
  // that swaps which DOM node scrollRef points at.
  useEffect(() => {
    function tick() {
      const el = scrollRef.current;
      if (el && Date.now() > pausedUntilRef.current) {
        const max = el.scrollHeight - el.clientHeight;
        if (max > 0) {
          let next = el.scrollTop + SCROLL_PX_PER_FRAME;
          if (next >= max) next = 0;
          el.scrollTop = next;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [layoutMode]);

  // When a new ticket arrives, smoothly scroll to it and pause auto-scroll
  // for a few seconds so it stays visible, then resume as normal.
  useEffect(() => {
    if (!pendingJumpId) return;
    const el = scrollRef.current;
    if (!el) { setPendingJumpId(null); return; }
    const target = el.querySelector(`[data-ticket-id="${pendingJumpId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pausedUntilRef.current = Date.now() + PAUSE_AFTER_JUMP_MS;
    }
    setPendingJumpId(null);
  }, [pendingJumpId, filteredRequests, layoutMode]);

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'Normal': return 'text-slate-600 bg-slate-100 border-slate-300 font-bold';
      case 'Medium': return 'text-amber-700 bg-amber-50 border-amber-300 font-bold';
      case 'High': return 'text-orange-700 bg-orange-50 border-orange-300 font-bold';
      case 'Critical': return 'text-white bg-red-600 border-red-700 font-bold';
      default: return 'text-slate-600 bg-slate-100 border-slate-300 font-bold';
    }
  };

  // Left-border color, standardized on priority (matches ITServiceDesk's
  // list view) rather than status, so the same color always means the
  // same priority no matter which page is open.
  const getPriorityBorder = (priority) => {
    switch (priority) {
      case 'Critical': return 'border-l-red-600';
      case 'High': return 'border-l-orange-500';
      case 'Medium': return 'border-l-amber-500';
      default: return 'border-l-slate-400'; // Normal
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'Closed':
      case 'Completed': return 'text-slate-600 bg-slate-100 border-slate-300 font-bold';
      case 'In Progress': return 'text-emerald-700 bg-emerald-50 border-emerald-300 font-bold';
      case 'Rejected': return 'text-rose-700 bg-rose-50 border-rose-300 font-bold';
      case 'Cancelled': return 'text-slate-500 bg-slate-50 border-slate-200 font-bold';
      case 'Open':
        return 'text-blue-700 bg-blue-50 border-blue-300 font-bold';
      case 'On Hold': return 'text-amber-700 bg-amber-50 border-amber-300 font-bold';
      default: return 'text-slate-600 bg-slate-100 border-slate-300 font-bold';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'Open':
        return 'w-2 h-2 rounded bg-blue-600 animate-pulse shrink-0';
      case 'In Progress': return 'w-2 h-2 rounded bg-emerald-600 animate-pulse shrink-0';
      case 'Closed':
      case 'Completed': return 'w-2 h-2 rounded bg-slate-500 shrink-0';
      case 'Rejected': return 'w-2 h-2 rounded bg-rose-500 shrink-0';
      case 'Cancelled': return 'w-2 h-2 rounded bg-slate-400 shrink-0';
      case 'On Hold': return 'w-2 h-2 rounded bg-amber-500 shrink-0';
      default: return 'w-2 h-2 rounded bg-slate-400 shrink-0';
    }
  };

  const displayStatusLabel = (status) => {
    switch (status) {
      case 'Open': return 'Open';
      case 'In Progress': return 'In Progress';
      case 'Closed':
      case 'Completed': return 'Closed';
      case 'Rejected': return 'Rejected';
      case 'Cancelled': return 'Cancelled';
      case 'On Hold': return 'On Hold';
      default: return status;
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1 text-lg">↕</span>;
    return <span className="text-blue-500 ml-1 text-lg">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // "Hardware Setup" or, when the type has a sub-problem, "Hardware Setup › Screen broken"
  const typeLabel = (req) => {
    const type = req.problem_type_name || req.request_type;
    if (!type) return '';
    return req.problem_subtype_name ? `${type} › ${req.problem_subtype_name}` : type;
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex overflow-hidden">
      {/* The scroll is driven by JS, not by the user, so the scrollbar
          itself serves no purpose on a wallboard — hide it everywhere. */}
      <style>{`.tv-scroll-hide::-webkit-scrollbar { display: none; }`}</style>

      {/* Toast Notification (fetch/connection errors) */}
      {notification && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`flex items-center gap-3.5 px-6 py-4 rounded shadow-md border min-w-[280px] ${notification.type === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
            <div className="shrink-0">
              {notification.type === 'error' ? <AlertCircle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
            </div>
            <div className="flex-1 pr-2">
              <p className="font-bold text-base leading-tight">
                {notification.type === 'error' ? 'เกิดข้อผิดพลาด' : 'สำเร็จ'}
              </p>
              <p className="text-sm font-semibold mt-0.5">{notification.message}</p>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="p-1 hover:bg-slate-200 rounded transition text-slate-500 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* New ticket banner — the one thing on this screen meant to grab attention */}
      {newTicketNotice && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] animate-in zoom-in-95 fade-in duration-300">
          <div className="flex items-center gap-4 rounded-lg border-2 border-red-500 bg-red-600 px-8 py-5 text-white shadow-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 animate-pulse">
              <AlertCircle className="h-7 w-7" />
            </span>
            <div>
              <p className="text-xl font-bold">มี Ticket ใหม่เข้ามา {newTicketNotice.count} รายการ</p>
              <p className="text-sm font-semibold text-red-100">{newTicketNotice.ticket?.req_id || ''} — {newTicketNotice.ticket?.project_name || 'กรุณาตรวจสอบคิวงานล่าสุด'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden p-4">
        <div className="bg-white rounded border border-slate-200 flex flex-col h-full shadow-sm overflow-hidden relative">

          {/* Header */}
          <header className="px-8 py-6 border-b border-slate-200 bg-slate-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 z-10 shrink-0">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                IT Help Desk Live Queue
              </h1>
              <p className="text-sm font-bold text-slate-500 mt-1 uppercase tracking-widest">
                Wallboard • real-time • auto-scroll
              </p>
            </div>

            <div className="flex items-center gap-4 text-right">
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800 tabular-nums tracking-wide leading-none">
                  {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
                <p className="text-xs font-bold text-slate-500 mt-1.5">
                  {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                {lastUpdatedAt && <p className="text-slate-400 mt-1 text-[11px]">ข้อมูลอัปเดต {formatThaiDateTime(lastUpdatedAt)}</p>}
              </div>

              {/* Grid / List toggle */}
              <div className="flex rounded border border-slate-300 bg-white overflow-hidden shadow-sm">
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`px-3 py-2.5 transition-colors ${layoutMode === 'grid' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                  title="Grid View"
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setLayoutMode('list')}
                  className={`px-3 py-2.5 border-l border-slate-300 transition-colors ${layoutMode === 'list' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                  title="List View"
                >
                  <List className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3 rounded bg-white border border-slate-300 shadow-sm px-4 py-2.5 text-sm font-bold">
                <span className={`w-3 h-3 rounded-full ${connectionStatus === 'online' ? 'bg-emerald-500' : connectionStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-slate-700">{connectionStatus === 'online' ? 'LIVE' : connectionStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}</span>
                {isRefreshing && <span className="text-slate-400 text-xs">SYNC</span>}
              </div>
            </div>
          </header>

          {/* Non-scrolling top section: stats + status bar */}
          <div className="px-6 pt-4 bg-slate-50 shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
              {[
                { label: 'Active Queue', value: requests.filter(r => !['Closed', 'Rejected', 'Cancelled'].includes(r.status)).length, icon: <LayoutDashboard className="w-5 h-5 text-indigo-600" />, bgIcon: 'bg-indigo-50 border border-indigo-100' },
                { label: 'Open', value: requests.filter(r => r.status === 'Open').length, icon: <Clock className="w-5 h-5 text-blue-600" />, bgIcon: 'bg-blue-50 border border-blue-100' },
                { label: 'In Progress', value: requests.filter(r => r.status === 'In Progress').length, icon: <Laptop className="w-5 h-5 text-emerald-600" />, bgIcon: 'bg-emerald-50 border border-emerald-100' },
                { label: 'On Hold', value: requests.filter(r => r.status === 'On Hold').length, icon: <Clock className="w-5 h-5 text-amber-600" />, bgIcon: 'bg-amber-50 border border-amber-100' },
                { label: 'Closed Today', value: requests.filter(r => r.status === 'Closed' && isToday(r.updated_at || r.completed_at)).length, icon: <CheckCircle className="w-5 h-5 text-slate-600" />, bgIcon: 'bg-slate-100 border border-slate-200' },
              ].map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded border border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-sm"
                >
                  <div>
                    <p className="text-[15px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">{s.label}</p>
                    <p className="text-2xl font-bold text-slate-800 leading-none">{isLoading ? '—' : s.value}</p>
                  </div>
                  <div className={`w-9 h-9 rounded flex items-center justify-center shrink-0 ${s.bgIcon}`}>
                    {s.icon}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-3 rounded border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">
              <span>คิวงานที่ยังไม่เสร็จ {filteredRequests.length} รายการ</span>
              <span>เลื่อนอัตโนมัติ • อัปเดตแบบเรียลไทม์</span>
            </div>
          </div>

          {/* Loading & Empty States Management */}
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400 px-8 pb-8">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-lg font-bold tracking-widest uppercase">Loading Tickets...</span>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 pb-8">
              <div className="w-20 h-20 bg-slate-50 rounded flex items-center justify-center mb-2 border border-slate-100">
                <Search className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-600 font-bold text-xl">ไม่พบรายการ Ticket</p>
            </div>
          ) : (

            /* Scrollable region — the ONLY part of the page that scrolls.
               scrollRef is what the auto-scroll animation drives. min-h-0
               keeps this flex item free to shrink to the space actually
               available instead of growing to fit its content. */
            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-y-auto tv-scroll-hide px-8 pb-8"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {layoutMode === 'grid' ? (

                /* --- GRID VIEW LAYOUT (compact cards, tuned for a 55" TV) --- */
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredRequests.map((req) => {
                    const isNewTicket = req.status === 'Open' || (!req.empCode_assigned && !['Rejected', 'Closed', 'Cancelled'].includes(req.status));
                    return (
                      <div
                        key={req.id}
                        data-ticket-id={req.id}
                        className={`bg-white rounded-lg border-l-[6px] border border-slate-200 p-4 shadow-sm flex flex-col justify-between ${getPriorityBorder(req.priority)} ${isNewTicket ? 'bg-amber-50/20' : ''}`}
                      >
                        <div>
                          {/* Top badges */}
                          <div className="flex items-center justify-between mb-3">
                            <span className={`inline-flex px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wide border ${getPriorityStyle(req.priority)}`}>
                              {req.priority}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-bold uppercase tracking-wide border ${getStatusStyle(req.status)}`}>
                              <span className={getStatusDot(req.status)} />
                              {displayStatusLabel(req.status)}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-2xl font-semibold text-slate-800 leading-snug mb-1 line-clamp-2">
                            {req.project_name}
                          </h3>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-mono font-bold text-slate-400">{req.req_id}</span>
                            {isNewTicket && (
                              <span className="inline-flex items-center px-1.5 py-1.5 rounded text-[10px] font-bold bg-red-600 text-white animate-pulse">
                                NEW
                              </span>
                            )}
                          </div>

                          {/* Category / Sub-problem */}
                          {typeLabel(req) && (
                            <div className="flex items-center gap-1.5 text-[12px] text-slate-500 mb-2 truncate">
                              <span className="shrink-0">{getRequestTypeIcon(req.problem_type_name || req.request_type)}</span>
                              <span className="truncate">{typeLabel(req)}</span>
                            </div>
                          )}

                          {/* Location */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-3">
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span className="truncate">{req.location}</span>
                          </div>
                        </div>

                        {/* Footer: requester / assignee */}
                        <div className="pt-3 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={req.emp_pic_url || `http://dcidmc.dci.daikin.co.jp/PICTURE/${req.empCode_created}.jpg`}
                                alt={req.requester_name}
                                className="w-10 h-12 rounded object-cover border border-slate-300 bg-slate-100 shrink-0"
                                onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(req.requester_name || '?')}&background=f1f5f9&color=475569`; }}
                              />
                              <p className="text-[11px] font-bold text-slate-700 truncate">{req.requester_name?.split(' ')[0] || req.empCode_created || '-'}</p>
                            </div>

                            <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mx-1" />

                            {req.empCode_assigned ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="text-[11px] font-bold text-blue-700 truncate">{req.assigned_name?.split(' ')[0] || req.empCode_assigned}</p>
                                <img
                                  src={`http://dcidmc.dci.daikin.co.jp/PICTURE/${req.empCode_assigned}.jpg`}
                                  alt={req.assigned_name}
                                  className="w-10 h-12 rounded object-cover border border-blue-200 bg-blue-50 shrink-0"
                                  onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(req.assigned_name || req.empCode_assigned)}&background=eff6ff&color=1d4ed8`; }}
                                />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                            )}
                          </div>

                          {/* Timing */}
                          <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-2 rounded border border-slate-100">
                            <span className="font-bold text-slate-600">{formatDateShort(req.target_date)}</span>
                            {req.accepted_at && req.completed_at ? (
                              <span className="font-bold text-emerald-600">⏱ {formatElapsedTime(req.accepted_at, req.completed_at)}</span>
                            ) : req.accepted_at ? (
                              <span className="font-bold text-blue-600 animate-pulse">In progress</span>
                            ) : (
                              <span className="font-bold text-slate-400">Pending</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (

                /* --- LIST VIEW LAYOUT (Formal, Larger Text, sticky header) --- */
                <table className="w-full text-left text-base table-fixed">
                  <colgroup>
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '12%' }} />
                  </colgroup>
                  <thead className="bg-slate-100 text-slate-600 text-sm uppercase font-bold tracking-widest border-b border-slate-200">
                    <tr>
                      <th className="sticky top-0 z-10 bg-slate-100 px-6 py-5 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('priority')}>Priority<SortIcon field="priority" /></th>
                      <th className="sticky top-0 z-10 bg-slate-100 px-6 py-5 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('project_name')}>Problem<SortIcon field="project_name" /></th>
                      <th className="sticky top-0 z-10 bg-slate-100 px-6 py-5 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('status')}>Status<SortIcon field="status" /></th>
                      <th className="sticky top-0 z-10 bg-slate-100 px-6 py-5">Location</th>
                      <th className="sticky top-0 z-10 bg-slate-100 px-6 py-5">Requester</th>
                      <th className="sticky top-0 z-10 bg-slate-100 px-6 py-5">In Charge</th>
                      <th className="sticky top-0 z-10 bg-slate-100 px-6 py-5 text-right cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('target_date')}>Target Date<SortIcon field="target_date" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-base bg-white">
                    {filteredRequests.map((req) => {
                      const isNewTicket = req.status === 'Open' || (!req.empCode_assigned && !['Rejected', 'Closed', 'Cancelled'].includes(req.status));
                      return (
                        <tr
                          key={req.id}
                          data-ticket-id={req.id}
                          className={`relative h-[110px] transition-colors group ${isNewTicket
                            ? 'bg-amber-50/30 hover:bg-amber-50'
                            : 'hover:bg-slate-50'
                            }`}
                        >
                          {/* Priority */}
                          <td className="relative px-6 py-4">
                            <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${getPriorityBorder(req.priority).replace('border-l-', 'bg-')}`} aria-hidden="true"></span>
                            <span className={`inline-flex px-4 py-2 rounded text-sm font-bold uppercase tracking-widest border ${getPriorityStyle(req.priority)}`}>
                              {req.priority}
                            </span>
                          </td>

                          {/* Project Name */}
                          <td className="px-6 py-4 pr-4">
                            <p className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors truncate mb-1">{req.project_name}</p>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-3 mb-1">
                              {req.req_id}
                              {isNewTicket && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white shadow-sm animate-pulse">
                                  NEW
                                </span>
                              )}
                            </p>
                            {typeLabel(req) && (
                              <p className="text-xs font-semibold text-slate-400 truncate normal-case tracking-normal">
                                {typeLabel(req)}
                              </p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-bold uppercase tracking-wider border ${getStatusStyle(req.status)}`}>
                              <span className={getStatusDot(req.status)} />
                              {displayStatusLabel(req.status)}
                            </span>
                          </td>

                          {/* Location */}
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-2 text-[12px] font-bold text-slate-700 min-w-0">
                              <MapPin className="w-5 h-5 shrink-0 text-slate-400" />
                              <span className="truncate">{req.location}</span>
                            </span>
                          </td>

                          {/* Requester */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 min-w-0" title={`Requester: ${req.requester_name}`}>
                              <img
                                src={req.emp_pic_url || `http://dcidmc.dci.daikin.co.jp/PICTURE/${req.empCode_created}.jpg`}
                                alt={req.requester_name}
                                className="w-10 h-12 rounded object-cover border border-slate-300 bg-slate-50 shrink-0"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(req.requester_name)}&background=f1f5f9&color=475569&size=64`;
                                }}
                              />
                              <span className="text-[15px] font-bold text-slate-800 truncate min-w-0">{req.requester_name || req.empCode_created || '-'}</span>
                            </div>
                          </td>

                          {/* In Charge */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3 min-w-0" title={req.empCode_assigned ? `In Charge: ${req.assigned_name}` : 'Unassigned'}>
                              {req.empCode_assigned ? (
                                <>
                                  <img
                                    src={`http://dcidmc.dci.daikin.co.jp/PICTURE/${req.empCode_assigned}.jpg`}
                                    alt={req.assigned_name}
                                    className="w-10 h-12 rounded object-cover border border-blue-200 bg-blue-50 shrink-0"
                                    onError={(e) => {
                                      e.target.onerror = null;
                                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(req.assigned_name || req.empCode_assigned)}&background=eff6ff&color=1d4ed8&size=64`;
                                    }}
                                  />
                                  <span className="text-[15px] font-bold text-blue-700 truncate min-w-0">{req.assigned_name || req.empCode_assigned}</span>
                                </>
                              ) : (
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-10 h-10 rounded border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 shrink-0">
                                    <User className="w-5 h-5" />
                                  </div>
                                  <span className="text-base font-bold text-slate-500 truncate">Unassigned</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Target Date */}
                          <td className="px-6 py-4 text-right">
                            <p className="text-lg font-bold text-slate-700">{formatDateShort(req.target_date)}</p>
                            {req.accepted_at && req.completed_at ? (
                              <p className="text-base font-bold text-emerald-600 mt-1">⏱ {formatElapsedTime(req.accepted_at, req.completed_at)}</p>
                            ) : req.accepted_at ? (
                              <p className="text-base font-bold text-blue-600 mt-1 animate-pulse">In progress...</p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}