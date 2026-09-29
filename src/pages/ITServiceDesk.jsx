import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ticketAPI } from '../utils/apiClient';
import { format } from 'date-fns';
import * as signalR from '@microsoft/signalr';
import Sidebar from '../components/Sidebar';
import {
  Search, Filter, Plus, Clock, CheckCircle,
  AlertCircle, X, MessageSquare, Monitor, FileText,
  User, LayoutDashboard, Settings, MapPin, LoaderCircle, Loader,
  Paperclip, Wrench, Laptop, Briefcase, Calendar, Info,
  ChevronRight, ArrowRight, Grid, List, AlertTriangle, Ticket /* เพิ่ม Ticket ตรงนี้ */
} from 'lucide-react';
import { getDeviceTypeColor, getColorGradient, getRequestTypeIcon } from '../utils/styleHelpers';
import OpenTicketModal from '../components/OpenTicketModal';
import TicketDetailModal from '../components/TicketDetailModal';
import MobileNavbar from '../components/MobileNavbar';
import { API_BASE } from '../config/api';
import { useLocation, useNavigate } from 'react-router-dom';

// Stock's uploaded images are served from its root, not under /ITinventory/api.
const STOCK_HOST = 'http://dciweb.dci.daikin.co.jp:3002';

const Chip = ({ label, onRemove }) => (
  <span className="flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-300 px-2 py-1 rounded text-xs font-semibold">
    {label}
    <button onClick={onRemove} className="text-slate-400 hover:text-rose-500 transition-colors">×</button>
  </span>
);

export default function ITServiceDesk() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = new URLSearchParams(location.search).get('view') || 'all';

  const [requests, setRequests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentMode, setCommentMode] = useState('comment');
  const [pendingAction, setPendingAction] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Debounced separately from the raw input: typing itself stays instant
  // (bound directly to the <input>), but the filter/sort recompute over
  // `requests` — which can grow large — only fires 300ms after the user
  // stops typing, instead of on every keystroke.
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [liveStatus, setLiveStatus] = useState('connecting');

  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSubtype, setFilterSubtype] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  // Sort states
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const [rootCause, setRootCause] = useState('');
  const [solution, setSolution] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [expectedAt, setExpectedAt] = useState('');

  const [ticketHistory, setTicketHistory] = useState([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  // Layout Mode state (Grid / List)
  const [layoutMode, setLayoutMode] = useState('list');

  const [formData, setFormData] = useState({
    requestType: 'Hardware Setup', projectName: '', targetDate: '', deviceType: 'Notebook (Windows)', deviceCount: 1, location: '', priority: 'Normal', requirements: ''
  });

  const isITStaff = user?.cost_center === '7510';

  const formatDateShort = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatThaiDateTime = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok'
    });
  };

  const formatElapsedTime = (start, end, holdAt = null, resumedAt = null) => {
    if (!start || !end) return '-';
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '-';
    let diffMs = endDate - startDate;
    if (diffMs <= 0) return '-';
    if (holdAt && resumedAt) {
      const holdMs = new Date(resumedAt) - new Date(holdAt);
      if (holdMs > 0) diffMs -= holdMs;
    }
    const totalMinutes = Math.floor(diffMs / 60000);
    if (totalMinutes <= 0) return '0 นาที';
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours}.${String(minutes).padStart(2, '0')} ชั่วโมง`;
    }
    return `${totalMinutes} นาที`;
  };

  const getElapsedStyle = (start, end, holdAt = null, resumedAt = null) => {
    if (!start || !end) return 'text-emerald-600 font-semibold';
    let diffMs = new Date(end) - new Date(start);
    if (holdAt && resumedAt) {
      const holdMs = new Date(resumedAt) - new Date(holdAt);
      if (holdMs > 0) diffMs -= holdMs;
    }
    const minutes = Math.floor(diffMs / 60000);
    if (minutes <= 30) return 'text-emerald-600 font-semibold';
    if (minutes <= 60) return 'text-amber-600 font-semibold';
    if (minutes >= 60) return 'text-red-600 font-semibold';
    return 'text-rose-600 font-semibold';
  };

  // When set, overrides the backend's default 180-day lookback window for
  // finished tickets — lets the user explicitly pull in older history.
  // Still-active tickets are always returned by the backend regardless.
  // Kept in refs (not just state) so fetchRequests always reads the latest
  // values even when called from the SignalR handler set up once at mount —
  // a plain state closure there would stay frozen at whatever the dates
  // were on first render.
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const historyStartDateRef = useRef('');
  const historyEndDateRef = useRef('');
  useEffect(() => { historyStartDateRef.current = historyStartDate; }, [historyStartDate]);
  useEffect(() => { historyEndDateRef.current = historyEndDate; }, [historyEndDate]);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (historyStartDateRef.current) params.startDate = historyStartDateRef.current;
      if (historyEndDateRef.current) params.endDate = historyEndDateRef.current;
      const response = await ticketAPI.getTickets(params);
      const tickets = response.data.data || response.data;
      setRequests(Array.isArray(tickets) ? tickets : []);
      setLastSyncedAt(new Date());
    } catch (error) {
      console.error('Fetch error:', error);
      showNotification('Failed to load requests from database', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch when the user picks a different history range — skips firing
  // on the very first mount, since the SignalR-setup effect below already
  // does an initial fetchRequests() call.
  const isFirstHistoryRender = useRef(true);
  useEffect(() => {
    if (isFirstHistoryRender.current) {
      isFirstHistoryRender.current = false;
      return;
    }
    fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyStartDate, historyEndDate]);

  useEffect(() => {
    fetchRequests();

    const hubUrl = API_BASE.replace('/api', '') + '/hubs/tickets';
    const token = localStorage.getItem('authToken');

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    connection.onreconnecting(() => setLiveStatus('connecting'));
    connection.onreconnected(() => setLiveStatus('online'));
    connection.onclose(() => setLiveStatus('offline'));

    connection.on('TicketsUpdated', () => {
      fetchRequests();
    });

    connection.start()
      .then(() => setLiveStatus('online'))
      .catch(err => {
        setLiveStatus('offline');
        console.error('SignalR connect error:', err);
      });

    return () => { connection.stop(); };
  }, []);

  useEffect(() => {
    if (selectedTicket) fetchTicketHistory(selectedTicket.id);
    else { setTicketHistory([]); setCommentText(''); }
  }, [selectedTicket]);

  useEffect(() => {
    if (!location.state?.openModal) return;
    setIsModalOpen(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state?.openModal, navigate]);

  const fetchTicketHistory = async (id) => {
    try {
      const response = await ticketAPI.getTicketHistory(id);
      setTicketHistory(response.data.data || []);
    } catch (error) { console.error('Failed to fetch history:', error); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedTicket) return;
    setIsSubmittingComment(true);
    try {
      await ticketAPI.addTicketComment(selectedTicket.id, commentText);
      setCommentText('');
      fetchTicketHistory(selectedTicket.id);
      showNotification('Comment added successfully', 'success');
    } catch (error) {
      showNotification('Failed to add comment', 'error');
    } finally { setIsSubmittingComment(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.projectName || !formData.location) {
      showNotification('Please fill in required fields.', 'error');
      return;
    }
    try {
      const ticketPayload = {
        request_type: formData.requestType,
        project_name: formData.projectName,
        device_type: formData.deviceType,
        device_count: parseInt(formData.deviceCount, 10) || 1,
        location: formData.location,
        priority: formData.priority,
        target_date: formData.targetDate || new Date().toISOString().split('T')[0],
        notes: formData.requirements
      };
      await ticketAPI.createTicket(ticketPayload);
      showNotification('Request submitted successfully!', 'success');
      setIsModalOpen(false);
      setFormData({ requestType: 'Hardware Setup', projectName: '', targetDate: '', deviceType: 'Notebook (Windows)', deviceCount: 1, location: '', priority: 'Normal', requirements: '' });
      fetchRequests();
    } catch (error) {
      showNotification('Failed to submit request to database', 'error');
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const openConfirm = ({ title, message, confirmLabel = 'Confirm', onConfirm }) => {
    setPendingAction({ title, message, confirmLabel, onConfirm });
  };

  const closeConfirm = () => setPendingAction(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const isProcessingRef = useRef(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const isSubmittingRef = useRef(false);

  // Stock item picker
  const [selectedStockItems, setSelectedStockItems] = useState([]);
  const [assetPickerProduct, setAssetPickerProduct] = useState(null);
  const [assetSerialInput, setAssetSerialInput] = useState('');
  const [assetCodeInput, setAssetCodeInput] = useState('');

  const [stockPickerOpen, setStockPickerOpen] = useState(false);
  const [stockPickerStep, setStockPickerStep] = useState('type');
  const [stockDeviceTypes, setStockDeviceTypes] = useState([]);
  const [isLoadingDeviceTypes, setIsLoadingDeviceTypes] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState(null);
  const [stockProductsForType, setStockProductsForType] = useState([]);
  const [isLoadingStockProducts, setIsLoadingStockProducts] = useState(false);
  const [productSearchInModal, setProductSearchInModal] = useState('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const globalSearchTimer = useRef(null);

  const searchAllProducts = (query) => {
    setGlobalSearchQuery(query);
    if (globalSearchTimer.current) clearTimeout(globalSearchTimer.current);
    if (!query.trim()) { setGlobalSearchResults([]); return; }
    globalSearchTimer.current = setTimeout(async () => {
      setIsSearchingGlobal(true);
      try {
        const res = await ticketAPI.searchStockProducts(query.trim());
        setGlobalSearchResults(res.data.data || []);
      } catch (err) {
        console.error('Global stock search failed:', err);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 300);
  };

  const openStockPicker = async () => {
    setStockPickerOpen(true);
    setStockPickerStep('type');
    setProductSearchInModal('');
    setGlobalSearchQuery('');
    setGlobalSearchResults([]);
    if (stockDeviceTypes.length === 0) {
      setIsLoadingDeviceTypes(true);
      try {
        const res = await ticketAPI.getStockDeviceTypes();
        setStockDeviceTypes(res.data.data || []);
      } catch (err) {
        console.error('Failed to load device types:', err);
        showNotification('โหลดประเภทอุปกรณ์ไม่สำเร็จ', 'error');
      } finally {
        setIsLoadingDeviceTypes(false);
      }
    }
  };

  const closeStockPicker = () => {
    setStockPickerOpen(false);
    setStockPickerStep('type');
    setSelectedDeviceType(null);
    setStockProductsForType([]);
    setProductSearchInModal('');
    setGlobalSearchQuery('');
    setGlobalSearchResults([]);
  };

  const selectDeviceType = async (type) => {
    setSelectedDeviceType(type);
    setStockPickerStep('products');
    setIsLoadingStockProducts(true);
    try {
      const res = await ticketAPI.searchStockProducts(undefined, type.TypeId);
      setStockProductsForType(res.data.data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
      showNotification('โหลดรายการอุปกรณ์ไม่สำเร็จ', 'error');
    } finally {
      setIsLoadingStockProducts(false);
    }
  };

  const backToTypeSelection = () => {
    setStockPickerStep('type');
    setSelectedDeviceType(null);
    setStockProductsForType([]);
    setProductSearchInModal('');
  };

  const visibleStockProducts = productSearchInModal.trim()
    ? stockProductsForType.filter(p => p.ProductName?.toLowerCase().includes(productSearchInModal.trim().toLowerCase()))
    : stockProductsForType;

  const addStockItem = (product) => {
    if (product.DeviceType === 'Asset') {
      setAssetPickerProduct(product);
      setAssetSerialInput('');
      setAssetCodeInput('');
      return;
    }
    setSelectedStockItems(prev => {
      const existing = prev.find(i => i.productId === product.ProductID);
      if (existing) {
        return prev.map(i => i.productId === product.ProductID ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { productId: product.ProductID, productName: product.ProductName, qty: 1, deviceType: product.DeviceType }];
    });
    showNotification(`เพิ่ม ${product.ProductName} แล้ว`, 'success');
  };

  const confirmAddAssetItem = () => {
    if (!assetSerialInput.trim() || !assetCodeInput.trim()) return;
    setSelectedStockItems(prev => [...prev, {
      productId: assetPickerProduct.ProductID,
      productName: assetPickerProduct.ProductName,
      qty: 1,
      deviceType: 'Asset',
      serialNumber: assetSerialInput.trim(),
      fixedAssetCode: assetCodeInput.trim()
    }]);
    setAssetPickerProduct(null); setAssetSerialInput(''); setAssetCodeInput('');
  };

  const updateStockItemQty = (productId, qty) => {
    setSelectedStockItems(prev => prev.map(i => i.productId === productId ? { ...i, qty: Math.max(1, qty) } : i));
  };

  const removeStockItem = (productId) => {
    setSelectedStockItems(prev => prev.filter(i => i.productId !== productId));
  };

  const executePendingAction = async () => {
    if (!pendingAction?.onConfirm || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessingAction(true);
    try { await pendingAction.onConfirm(); }
    catch (error) { showNotification('ไม่สามารถดำเนินการได้', 'error'); }
    finally {
      isProcessingRef.current = false;
      setIsProcessingAction(false);
      closeConfirm();
    }
  };

  const fetchTicketDetails = async (ticketId) => {
    setIsDetailLoading(true);
    try {
      const response = await ticketAPI.getTicket(ticketId);
      setSelectedTicket(response.data.data || response.data);
    } catch (error) {
      showNotification('Failed to load ticket details', 'error');
    } finally { setIsDetailLoading(false); }
  };


  useEffect(() => {
    const ticketIdFromUrl = new URLSearchParams(location.search).get('ticket');
    if (!ticketIdFromUrl) return;
    fetchTicketDetails(ticketIdFromUrl);
    const params = new URLSearchParams(location.search);
    params.delete('ticket');
    navigate({ search: params.toString() }, { replace: true });
  }, [location.search])


  useEffect(() => {
    const ticketId = location.state?.ticketId;
    if (!ticketId) return;
    fetchTicketDetails(ticketId);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state?.ticketId, navigate]);

  const handleSaveComment = async () => {
    if (commentMode === 'hold' && !holdReason.trim()) {
      showNotification('กรุณาระบุเหตุผลที่ต้อง Hold', 'error');
      return;
    }
    if (commentMode === 'reject' && !commentText.trim()) {
      showNotification('กรุณาระบุเหตุผลในการปฏิเสธเคส', 'error');
      return;
    }
    const updatePayload = commentMode === 'reject' ? { status: 'Rejected', comment: commentText }
      : commentMode === 'close' ? {
        status: 'Closed', root_cause: rootCause, solution: solution, comment: commentText || undefined,
        stock_items: selectedStockItems.length > 0 ? selectedStockItems : undefined
      }
        : commentMode === 'hold' ? { status: 'On Hold', hold_reason: holdReason, expected_at: expectedAt || null }
          : { comment: commentText };

    try {
      await ticketAPI.updateTicket(selectedTicket.id, updatePayload);
      showNotification(commentMode === 'close' ? 'ปิดเคสสำเร็จ' : commentMode === 'reject' ? 'Ticket rejected' : 'Comment added', 'success');
      setCommentModalOpen(false); setCommentText(''); setRootCause(''); setSolution(''); setHoldReason(''); setExpectedAt('');
      setSelectedStockItems([]); closeStockPicker();

      setCommentMode('comment'); setSelectedTicket(null); fetchRequests();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save';
      showNotification(msg, 'error');
    }
  };

  const openCommentModal = (mode = 'comment') => {
    setCommentMode(mode); setCommentText(''); setCommentModalOpen(true);
    if (mode === 'close') { setSelectedStockItems([]); closeStockPicker(); }
  };

  const handleAcceptTicket = async () => {
    try {
      await ticketAPI.updateTicket(selectedTicket.id, {
        status: 'In Progress', empCode_assigned: user?.empcode,
        notes: (selectedTicket.notes || '') + `\n\n[Action] รับเคสโดย ${user?.name || 'IT Staff'}`
      });
      showNotification('รับเคสเรียบร้อย', 'success');
      setSelectedTicket(null); fetchRequests();
    } catch (err) { showNotification('ไม่สามารถรับเคสได้', 'error'); }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteTicket = async () => {
    try {
      await ticketAPI.deleteTicket(selectedTicket.id);
      showNotification('Ticket deleted', 'success');
      setSelectedTicket(null); fetchRequests();
    } catch (err) {
      if (err.response?.status === 404) {
        showNotification('Ticket นี้ถูกลบไปแล้ว', 'info');
        setSelectedTicket(null); fetchRequests();
      } else {
        showNotification('Failed to delete ticket', 'error');
      }
    }
  };

  const handleCancelTicket = async () => {
    try {
      await ticketAPI.updateTicket(selectedTicket.id, { status: 'Cancelled', comment: 'ยกเลิกโดยผู้แจ้ง' });
      showNotification('ยกเลิก Ticket เรียบร้อย', 'success');
      setSelectedTicket(null); fetchRequests();
    } catch (err) { showNotification('ไม่สามารถยกเลิก Ticket ได้', 'error'); }
  };

  const handleResumeTicket = async () => {
    try {
      await ticketAPI.updateTicket(selectedTicket.id, {
        status: 'In Progress',
        comment: 'กลับมาดำเนินการต่อแล้ว'
      });
      showNotification('Resume เรียบร้อย', 'success');
      setSelectedTicket(null);
      fetchRequests();
    } catch (err) {
      showNotification('ไม่สามารถ Resume ได้', 'error');
    }
  };

  const handleAddHelper = async (empCode) => {
    try {
      await ticketAPI.addHelper(selectedTicket.id, empCode);
      showNotification('เพิ่ม Helper เรียบร้อย', 'success');
      fetchTicketDetails(selectedTicket.id);
    } catch (err) {
      showNotification('ไม่สามารถเพิ่ม Helper ได้', 'error');
    }
  };

  const handleRemoveHelper = async (empCode) => {
    try {
      await ticketAPI.removeHelper(selectedTicket.id, empCode);
      showNotification('ลบ Helper เรียบร้อย', 'success');
      fetchTicketDetails(selectedTicket.id);
    } catch (err) {
      showNotification('ไม่สามารถลบ Helper ได้', 'error');
    }
  };

  const filteredRequests = useMemo(() => {
    let result = requests;

    if (currentView === 'mine') result = result.filter(r => r.empCode_created === user?.empcode);
    if (currentView === 'incharge') result = result.filter(r => r.empCode_assigned === user?.empcode);

    if (debouncedSearchQuery) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(r =>
        r.project_name?.toLowerCase().includes(q) ||
        r.req_id?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q) ||
        r.requester_name?.toLowerCase().includes(q) ||
        r.problem_subtype_name?.toLowerCase().includes(q)
      );
    }

    if (filterStatus) result = result.filter(r => r.status === filterStatus);
    if (filterPriority) result = result.filter(r => r.priority === filterPriority);
    if (filterType) result = result.filter(r => (r.problem_type_name || r.request_type) === filterType);
    if (filterSubtype) result = result.filter(r => r.problem_subtype_name === filterSubtype); // ← เพิ่ม
    if (filterAssignee) result = result.filter(r =>
      filterAssignee === 'unassigned'
        ? !r.empCode_assigned
        : r.empCode_assigned === filterAssignee
    );
    if (filterDate) {
      const now = new Date();
      result = result.filter(r => {
        const d = new Date(r.created_at);
        if (filterDate === 'today') return d.toDateString() === now.toDateString();
        if (filterDate === 'week') return (now - d) <= 7 * 86400000;
        if (filterDate === 'month') return (now - d) <= 30 * 86400000;
        return true;
      });
    }

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
  }, [requests, currentView, searchQuery, filterStatus, filterPriority, filterType, filterSubtype, filterAssignee, filterDate, sortField, sortDir, user?.empcode]);

  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => { setCurrentPage(1); }, [filterStatus, filterPriority, filterType, filterSubtype, filterAssignee, filterDate, searchQuery, currentView]);


  const uniqueTypes = [...new Set(requests.map(r => r.problem_type_name || r.request_type).filter(Boolean))];
  const uniqueAssignees = [...new Map(requests.filter(r => r.empCode_assigned).map(r => [r.empCode_assigned, r.assigned_name || r.empCode_assigned])).entries()];
  const activeFilterCount = [filterStatus, filterPriority, filterType, filterSubtype, filterAssignee, filterDate].filter(Boolean).length;
  const uniqueSubtypes = useMemo(() => {
    const source = filterType
      ? requests.filter(r => (r.problem_type_name || r.request_type) === filterType)
      : requests;
    return [...new Set(source.map(r => r.problem_subtype_name).filter(Boolean))];
  }, [requests, filterType]);

  // KPI cards should match whatever the current tab (All/Mine/In Charge) is
  // showing below them — this was previously only handling 'mine' and
  // silently treating 'incharge' the same as 'all'.
  const matchesCurrentView = (r) => {
    if (currentView === 'mine') return r.empCode_created === user?.empcode;
    if (currentView === 'incharge') return r.empCode_assigned === user?.empcode;
    return true; // 'all'
  };


  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'Normal': return 'text-slate-600 bg-slate-100 border-slate-300';
      case 'Medium': return 'text-amber-700 bg-amber-50 border-amber-300';
      case 'High': return 'text-orange-700 bg-orange-50 border-orange-300';
      case 'Critical': return 'text-white bg-red-600 border-red-700';
      default: return 'text-slate-600 bg-slate-100 border-slate-300';
    }
  };

  // Left-border color, standardized on priority (matches TVMonitor's grid
  // cards) rather than status, so the same color always means the same
  // priority no matter which page/view is open.
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
      case 'Closed': return 'text-slate-600 bg-slate-100 border-slate-300';
      case 'In Progress': return 'text-emerald-700 bg-emerald-50 border-emerald-300';
      case 'On Hold': return 'text-amber-700 bg-amber-50 border-amber-300';
      case 'Rejected': return 'text-rose-700 bg-rose-50 border-rose-300';
      case 'Cancelled': return 'text-slate-500 bg-slate-50 border-slate-200';
      case 'Open': return 'text-blue-700 bg-blue-50 border-blue-300';
      default: return 'text-slate-600 bg-slate-100 border-slate-300';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'Open': return 'w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse shrink-0';
      case 'In Progress': return 'w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse shrink-0';
      case 'On Hold': return 'w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0';
      case 'Closed': return 'w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0';
      case 'Rejected': return 'w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0';
      case 'Cancelled': return 'w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0';
      default: return 'w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0';
    }
  };

  const displayStatusLabel = (status) => {
    switch (status) {
      case 'Open': return 'Open';
      case 'In Progress': return 'In Progress';
      case 'Closed': return 'Closed';
      case 'Rejected': return 'Rejected';
      case 'Cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const greetingTime = () => {
    const h = new Date().getHours();
    if (h < 12) return 'GOOD MORNING';
    if (h < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col md:flex-row overflow-hidden">

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2">
          <div className={`flex items-center gap-3 px-4 py-3 rounded shadow-md border ${notification.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
            {notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            <span className="font-semibold text-sm">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Mobile Navbar */}
      <MobileNavbar user={user} onMenuClick={() => setMobileOpen(true)} />

      {/* Sidebar */}
      <Sidebar user={user} isITStaff={isITStaff} logout={logout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Area - Formal Sharp Borders */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden p-0 md:p-6">
        <div className="bg-white rounded shadow-sm flex flex-col h-full overflow-hidden border border-slate-200">

          {/* Header - Formal without gradients */}
          <header className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{greetingTime()}</p>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                {currentView === 'all' ? 'All IT Tickets' : currentView === 'incharge' ? 'Tickets In Charge' : 'My IT Tickets'}
              </h1>
              <div className="flex items-center gap-2 mt-1 text-xs font-medium text-slate-500">
                <span className={`w-2 h-2 rounded-full ${liveStatus === 'online' ? 'bg-emerald-500' : liveStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'}`} />
                <span>{liveStatus === 'online' ? 'Live' : liveStatus === 'connecting' ? 'Connecting' : 'Offline'}</span>
                {lastSyncedAt && <span className="text-slate-400 ml-1">• Synced {formatDateShort(lastSyncedAt)}</span>}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">

              {/* Tab Toggles - Square buttons */}
              <div className="flex rounded border border-slate-300 bg-white overflow-hidden shadow-sm">
                <button onClick={() => navigate('/?view=all')} className={`px-4 py-1.5 text-xs font-semibold transition-colors ${currentView === 'all' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>All Tickets</button>
                <button onClick={() => navigate('/?view=mine')} className={`px-4 py-1.5 text-xs font-semibold border-l border-slate-300 transition-colors ${currentView === 'mine' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>My Tickets</button>
                {isITStaff && (
                  <button onClick={() => navigate('/?view=incharge')} className={`px-4 py-1.5 text-xs font-semibold border-l border-slate-300 transition-colors ${currentView === 'incharge' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>In Charge</button>
                )}
              </div>

              {/* Grid / List Layout Switcher */}
              <div className="flex rounded border border-slate-300 bg-white overflow-hidden shadow-sm">
                <button
                  onClick={() => setLayoutMode('list')}
                  className={`px-3 py-1.5 transition-colors ${layoutMode === 'list' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`px-3 py-1.5 border-l border-slate-300 transition-colors ${layoutMode === 'grid' ? 'bg-slate-200 text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}
                  title="Grid View"
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar - Standard input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text" placeholder="Search ID, Project, Location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>

              {/* Primary Action Button */}
              <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-sm font-semibold shadow-sm transition-colors shrink-0">
                <Plus className="w-4 h-4" /> New Ticket
              </button>
            </div>

          </header>

          {/* Scrollable Dashboard Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 text-slate-800 custom-scrollbar">

            {/* KPI Cards - Minimalist formal style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                {
                  label: 'Total Tickets', desc: 'All Submissions',
                  value: requests.filter(matchesCurrentView).length,
                  icon: <Ticket className="w-5 h-5  text-slate-600" />,
                  filterVal: ''
                },
                {
                  label: 'Open', desc: 'Awaiting Action',
                  value: requests.filter(r => matchesCurrentView(r) && r.status === 'Open').length,
                  icon: <Clock className="w-5 h-5 text-blue-600" />,
                  filterVal: 'Open'
                },
                {
                  label: 'In Progress', desc: 'Actively Working',
                  value: requests.filter(r => matchesCurrentView(r) && r.status === 'In Progress').length,
                  icon: <LoaderCircle className="w-5 h-5 text-emerald-600" />,
                  filterVal: 'In Progress'
                },
                {
                  label: 'Closed', desc: 'Resolved Issues',
                  value: requests.filter(r => matchesCurrentView(r) && r.status === 'Closed').length,
                  icon: <CheckCircle className="w-5 h-5 text-slate-500" />,
                  filterVal: 'Closed'
                },
              ].map((s, i) => (
                <div
                  key={i}
                  onClick={() => setFilterStatus(prev => prev === s.filterVal ? '' : s.filterVal)}
                  className={`bg-white rounded border p-4 flex items-center justify-between shadow-sm cursor-pointer transition-colors
                    ${filterStatus === s.filterVal ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{s.label}</p>
                    <p className="text-2xl font-bold text-slate-800 mt-1">{isLoading ? '—' : s.value}</p>
                    <p className="text-[10px] text-slate-400 mt-1 truncate">{s.desc}</p>
                  </div>
                  <div className="p-3 rounded bg-slate-50 border border-slate-100 shrink-0">
                    {s.icon}
                  </div>
                </div>
              ))}
            </div>

            {/* Filter Bar */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <button
                onClick={() => setShowFilter(v => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold border transition-all ${showFilter || activeFilterCount > 0
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-white text-blue-600 rounded px-1.5 py-0.5 text-[10px] font-bold">{activeFilterCount}</span>
                )}
              </button>

              {/* {Active filter chips */}
              {filterStatus && <Chip label={filterStatus} onRemove={() => setFilterStatus('')} />}
              {filterPriority && <Chip label={filterPriority} onRemove={() => setFilterPriority('')} />}
              {filterType && <Chip label={filterType} onRemove={() => setFilterType('')} />}
              {filterSubtype && <Chip label={filterSubtype} onRemove={() => setFilterSubtype('')} />}
              {filterDate && <Chip label={{ today: 'Today', week: 'This Week', month: 'This Month' }[filterDate]} onRemove={() => setFilterDate('')} />}
              {filterAssignee && <Chip label={filterAssignee === 'unassigned' ? 'Unassigned' : uniqueAssignees.find(([k]) => k === filterAssignee)?.[1] || filterAssignee} onRemove={() => setFilterAssignee('')} />}

              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterType(''); setFilterSubtype(''); setFilterAssignee(''); setFilterDate(''); }}
                  className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors"
                >
                  Clear all
                </button>
              )}

              <span className="ml-auto text-xs font-semibold text-slate-500">{filteredRequests.length} Records found</span>
            </div>

            {/* Filter Panel */}
            {showFilter && (
              <div className="bg-white rounded border border-slate-200 shadow-sm p-4 mb-5 grid grid-cols-2 md:grid-cols-6 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Status</label>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500">
                    <option value="">All Statuses</option>
                    {['Open', 'In Progress', 'Closed', 'Rejected', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Priority</label>
                  <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500">
                    <option value="">All Priorities</option>
                    {['Critical', 'High', 'Medium', 'Normal'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Request Type</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500">
                    <option value="">All Types</option>
                    {uniqueTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sub-type</label>
                  <select value={filterSubtype} onChange={e => setFilterSubtype(e.target.value)}
                    disabled={uniqueSubtypes.length === 0}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed">
                    <option value="">All Sub-types</option>
                    {uniqueSubtypes.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Assignee</label>
                  <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500">
                    <option value="">All Assignees</option>
                    <option value="unassigned">Unassigned</option>
                    {uniqueAssignees.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Date Created</label>
                  <select value={filterDate} onChange={e => setFilterDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500">
                    <option value="">Any Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>
              </div>
            )}

            {showFilter && (
              <div className="bg-white rounded border border-slate-200 shadow-sm p-4 mb-5">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  ดูข้อมูลย้อนหลัง (เฉพาะเคสที่ปิด/ยกเลิกแล้ว — เคสที่ยังไม่ปิดแสดงเสมออยู่แล้ว)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500" />
                  <span className="text-xs text-slate-400">ถึง</span>
                  <input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded p-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500" />
                  {(historyStartDate || historyEndDate) && (
                    <button onClick={() => { setHistoryStartDate(''); setHistoryEndDate(''); }}
                      className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors">
                      รีเซ็ต (กลับไปดู 180 วันล่าสุด)
                    </button>
                  )}
                  <span className="text-[10px] text-slate-400 ml-auto">
                    {historyStartDate || historyEndDate ? '' : 'ค่าเริ่มต้น: 180 วันล่าสุด'}
                  </span>
                </div>
              </div>
            )}

            {/* Loading & Empty States Management */}
            {isLoading ? (
              <div className="bg-white border border-slate-200 rounded shadow-sm p-16 text-center flex flex-col items-center gap-3 text-slate-400">
                <LoaderCircle className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-xs font-semibold tracking-widest uppercase">Loading Tickets...</span>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded shadow-sm p-20 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 bg-slate-50 rounded flex items-center justify-center mb-2">
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-700 font-semibold text-sm">No Tickets Found</p>
                <p className="text-slate-500 text-xs">Try adjusting your search or filters.</p>
              </div>
            ) : layoutMode === 'grid' ? (

              /* --- GRID VIEW LAYOUT (Formal) --- */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in">
                {paginatedRequests.map((req) => {
                  const requestType = req.problem_type_name || req.request_type || 'General Request';
                  return (
                    <div
                      key={req.id}
                      onClick={() => fetchTicketDetails(req.id)}
                      className="bg-white rounded border border-slate-200 p-4 shadow-sm hover:border-blue-400 cursor-pointer flex flex-col group transition-colors"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityStyle(req.priority)}`}>
                          {req.priority}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${getStatusStyle(req.status)}`}>
                          <span className={getStatusDot(req.status)} />
                          {displayStatusLabel(req.status)}
                        </span>
                      </div>

                      <h3 className="font-semibold text-slate-800 text-sm mb-1 group-hover:text-blue-600 line-clamp-2 transition-colors">
                        {req.project_name}
                      </h3>

                      <div className="flex items-center gap-2 mb-3">
                        <p className="text-xs text-slate-500 font-mono">{req.req_id}</p>
                        {req.status === 'Open' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white uppercase">
                            New
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mb-4 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="[&_svg]:w-3.5 [&_svg]:h-3.5 text-slate-400 flex items-center justify-center shrink-0">
                            {getRequestTypeIcon(requestType)}
                          </span>
                          <span className="truncate">{requestType}</span>
                        </span>
                        {req.problem_subtype_name && (
                          <span className="text-[10px] text-slate-400 pl-5 truncate">
                            › {req.problem_subtype_name}
                          </span>
                        )}
                      </div>

                      <div className="mt-auto border-t border-slate-100 pt-3 flex flex-col gap-2">
                        <div className="flex justify-between items-center text-xs text-slate-500">
                          <span className="flex items-center gap-1 truncate max-w-[60%]">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{req.location}</span>
                          </span>
                          <span className="shrink-0">{formatDateShort(req.target_date)}</span>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-slate-600">{req.requester_name?.split(' ')[0] || req.empCode_created}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Assigned:</span>
                            {req.empCode_assigned ? (
                              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[10px] font-semibold">
                                {req.assigned_name?.split(' ')[0] || req.empCode_assigned}
                              </span>
                            ) : (
                              <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 border-dashed text-[10px] font-medium">
                                Unassigned
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (

              /* --- LIST VIEW LAYOUT (Formal Table) --- */
              <div className="bg-white border border-slate-200 rounded shadow-sm overflow-x-auto animate-in fade-in">
                <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] uppercase font-semibold tracking-wider">
                    <tr>
                      <th className="w-1 p-0"></th>
                      <th className="pl-4 pr-2 py-3 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('priority')}>Priority<SortIcon field="priority" /></th>
                      <th className="px-3 py-3 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('req_id')}>Ticket No.<SortIcon field="req_id" /></th>
                      <th className="px-3 py-3 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('project_name')}>Problem | Ticket<SortIcon field="project_name" /></th>
                      <th className="px-3 py-3 cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('status')}>Status<SortIcon field="status" /></th>
                      <th className="px-3 py-3">Location</th>
                      <th className="px-3 py-3">Requester</th>
                      <th className="px-3 py-3">In charge</th>
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-slate-800 transition-colors" onClick={() => handleSort('target_date')}>Target Date<SortIcon field="target_date" /></th>
                      <th className="pr-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {paginatedRequests.map((req) => {
                      const isNewTicket = req.status === 'Open' || (!req.empCode_assigned && !['Rejected', 'Closed', 'Cancelled'].includes(req.status));

                      return (
                        <tr
                          key={req.id}
                          onClick={() => fetchTicketDetails(req.id)}
                          className="group cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <td className={`w-1 p-0 border-l-[3px] ${getPriorityBorder(req.priority)}`}></td>

                          {/* Priority */}
                          <td className="pl-4 pr-2 py-3">
                            <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold border ${getPriorityStyle(req.priority)}`}>
                              {req.priority}
                            </span>
                          </td>

                          {/* Ticket No. */}
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[12px] font-mono text-slate-600">{req.req_id}</p>
                              {isNewTicket && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white uppercase">
                                  New
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Problem | Ticket */}
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                              {req.project_name}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 truncate">
                              <span className="[&_svg]:w-3 [&_svg]:h-3 text-slate-400 shrink-0">
                                {getRequestTypeIcon(req.problem_type_name || req.request_type)}
                              </span>
                              <span className="truncate">{req.problem_type_name || req.request_type}</span>
                              {req.problem_subtype_name && (
                                <span className="text-slate-400 shrink-0">› {req.problem_subtype_name}</span>
                              )}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-semibold border ${getStatusStyle(req.status)}`}>
                              {displayStatusLabel(req.status)}
                            </span>
                          </td>

                          {/* Location */}
                          <td className="px-3 py-3 text-[11px] text-slate-600">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[180px]">{req.location}</span>
                            </span>
                          </td>

                          {/* Requester */}
                          <td className="px-3 py-3 text-[11px] text-slate-700">
                            {req.requester_name?.split(' ')[0] || req.empCode_created}
                          </td>

                          {/* In Charge */}
                          <td className="px-3 py-3 text-[11px]">
                            {req.empCode_assigned ? (
                              <span className="inline-flex font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded truncate max-w-[120px]">
                                {req.assigned_name?.split(' ')[0] || req.empCode_assigned}
                              </span>
                            ) : (
                              <span className="inline-flex text-slate-500 bg-slate-50 px-2 py-1 rounded border border-dashed border-slate-300">
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Target Date */}
                          <td className="px-4 py-3 text-right">
                            <p className="text-xs text-slate-600">{formatDateShort(req.target_date)}</p>
                            {req.accepted_at && req.completed_at ? (
                              <p className={`text-[11px] mt-0.5 ${getElapsedStyle(req.accepted_at, req.completed_at, req.hold_at, req.resumed_at)}`}>
                                ⏱ {formatElapsedTime(req.accepted_at, req.completed_at, req.hold_at, req.resumed_at)}
                              </p>
                            ) : req.accepted_at ? (
                              <p className="text-[12px] text-blue-500 mt-0.5 font-medium">In progress...</p>
                            ) : null}
                          </td>

                          {/* Chevron */}
                          <td className="pr-4 py-3 text-right">
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors inline-block" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {filteredRequests.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 mt-4 bg-white border border-slate-200 rounded shadow-sm">
                <p className="text-xs font-medium text-slate-500">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRequests.length)} of {filteredRequests.length} entries
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">First</button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">Prev</button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) page = i + 1;
                    else if (currentPage <= 3) page = i + 1;
                    else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                    else page = currentPage - 2 + i;
                    return (
                      <button key={page} onClick={() => setCurrentPage(page)}
                        className={`w-8 py-1.5 rounded border text-xs font-semibold transition-colors ${currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                          }`}>{page}</button>
                    );
                  })}

                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">Next</button>
                  <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors">Last</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- PREMIUM CENTERED MODAL (TICKET DETAILS) --- */}
      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        ticketHistory={ticketHistory}
        user={user}
        isITStaff={isITStaff}
        formatters={{
          formatDateShort,
          formatElapsedTime,
          formatThaiDateTime,
          getStatusStyle,
          getPriorityStyle,
          getRequestTypeIcon,
          getDeviceTypeColor,
          displayStatusLabel
        }}
        actions={{
          openCommentModal,
          openConfirm,
          handleAcceptTicket,
          handleCancelTicket,
          handleDeleteTicket,
          handleResumeTicket,
          handleAddHelper,
          handleRemoveHelper,
          setCommentMode,
          setCommentText,
          setCommentModalOpen,
          isDeleting
        }}
      />

      {/* --- MODALS --- */}

      {/* Comment/Close Modal */}
      {commentModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={() => setCommentModalOpen(false)}></div>
          <div className={`bg-white rounded w-full ${commentMode === 'close' ? 'max-w-2xl' : 'max-w-lg max-h-[90vh]'} shadow-2xl z-[90] p-6 sm:p-8 border border-slate-200 animate-in zoom-in-95 overflow-visible flex flex-col`}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                {commentMode === 'close' && (
                  <div className="w-10 h-10 rounded bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-200">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    {commentMode === 'reject' ? 'Reject Ticket'
                      : commentMode === 'close' ? 'Close Ticket'
                        : commentMode === 'hold' ? 'Hold Ticket'
                          : 'Add Comment'}
                  </h3>
                  {commentMode === 'close' && <p className="text-xs font-medium text-slate-500 mt-0.5">บันทึกผลการแก้ไขและอุปกรณ์ที่ใช้กับเคสนี้</p>}
                </div>
              </div>
              <button onClick={() => setCommentModalOpen(false)} className="p-2 bg-slate-50 hover:bg-slate-100 rounded transition-colors text-slate-400 border border-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {commentMode === 'close' ? (
              <div className="space-y-5 overflow-visible pr-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">สาเหตุของปัญหา <span className="text-rose-500">*</span></label>
                    <textarea rows="4" value={rootCause} onChange={(e) => setRootCause(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-3 text-sm text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-colors"
                      placeholder="เช่น RAM เสีย, อะไหล่ชำรุด..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">วิธีแก้ไข <span className="text-rose-500">*</span></label>
                    <textarea rows="4" value={solution} onChange={(e) => setSolution(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded p-3 text-sm text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-colors"
                      placeholder="เช่น เปลี่ยนอะไหล่, ตั้งค่าใหม่..." />
                  </div>
                </div>

                {/* Stock item picker */}
                <div className="rounded border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700">อุปกรณ์ที่ใช้กับเคส <span className="text-slate-400 font-normal">(ไม่บังคับ)</span></label>
                      <p className="text-[11px] text-slate-500 mt-0.5">เลือกประเภทแล้วเลือกอุปกรณ์จากสต็อก หากมีการเบิกใช้</p>
                    </div>
                    {selectedStockItems.length > 0 && (
                      <span className="shrink-0 rounded bg-blue-100 px-2.5 py-1 text-[10px] font-bold text-blue-700 border border-blue-200">
                        เลือกแล้ว {selectedStockItems.length} รายการ
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={openStockPicker}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 rounded py-2.5 text-xs font-semibold text-slate-600 hover:text-blue-700 transition-colors shadow-sm"
                  >
                    <Paperclip className="w-4 h-4" /> เลือกอุปกรณ์จากสต็อก
                  </button>

                  {/* Selected items list */}
                  {selectedStockItems.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {selectedStockItems.map((item) => (
                        <div key={item.productId} className="flex items-center gap-3 bg-white border border-slate-200 rounded px-3 py-2 shadow-sm">
                          <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Laptop className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{item.productName}</p>
                            <p className="text-[10px] text-slate-500">{item.deviceType}{item.serialNumber ? ` • S/N: ${item.serialNumber} • ${item.fixedAssetCode}` : ''}</p>
                          </div>
                          {item.deviceType !== 'Asset' && (
                            <input type="number" min="1" value={item.qty}
                              onChange={(e) => updateStockItemQty(item.productId, parseInt(e.target.value, 10) || 1)}
                              aria-label={`จำนวน ${item.productName}`}
                              className="w-14 bg-slate-50 border border-slate-300 rounded p-1 text-xs font-semibold text-center focus:outline-none focus:border-blue-500" />
                          )}
                          <button type="button" aria-label={`ลบ ${item.productName}`} onClick={() => removeStockItem(item.productId)} className="text-slate-400 hover:text-rose-600 transition-colors p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            ) : commentMode === 'hold' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    เหตุผลที่ต้อง Hold <span className="text-rose-500">*</span>
                  </label>
                  <textarea rows="3" value={holdReason} onChange={e => setHoldReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-3 text-sm text-slate-700 focus:bg-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-none transition-colors"
                    placeholder="เช่น รออะไหล่จาก vendor, รอ approve จาก manager..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    คาดว่าจะกลับมาดำเนินการได้
                  </label>
                  <input type="date" value={expectedAt} onChange={e => setExpectedAt(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-sm text-slate-700 focus:bg-white focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
              </div>)
              : (

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {commentMode === 'reject' ? 'เหตุผลการปฏิเสธ (Required)' : 'ข้อความ (Message)'}
                  </label>
                  <textarea rows="4" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-3 text-sm text-slate-700 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-colors"
                    placeholder={commentMode === 'reject' ? "ระบุเหตุผลที่ไม่สามารถรับเคสได้..." : "พิมพ์ข้อความที่ต้องการแจ้ง..."} />
                </div>
              )}

            <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-slate-100">
              <button onClick={() => setCommentModalOpen(false)} className="px-5 py-2 rounded text-sm font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">
                Cancel
              </button>
              <button
                onClick={() => openConfirm({
                  title: commentMode === 'close' ? 'Confirm ปิดเคส' : commentMode === 'reject' ? 'Confirm Reject' : 'Confirm Comment',
                  message: commentMode === 'close' ? `ยืนยันการปิดเคส ${selectedTicket.req_id}?` : commentMode === 'reject' ? `ยืนยันการปฏิเสธเคส ${selectedTicket.req_id}?` : 'บันทึกข้อความลงในระบบ?',
                  confirmLabel: commentMode === 'close' ? 'ปิดเคส' : commentMode === 'reject' ? 'Reject' : 'Save Comment',
                  onConfirm: handleSaveComment
                })}
                disabled={commentMode === 'close' && (!rootCause.trim() || !solution.trim())}
                className={`px-6 py-2 rounded text-sm font-semibold text-white transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none
                  ${commentMode === 'close' ? 'bg-emerald-600 hover:bg-emerald-700' : commentMode === 'reject' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {commentMode === 'close' ? 'Submit & Close' : commentMode === 'reject' ? 'Reject Ticket' : 'Post Comment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Item Picker Modal (two steps: device type -> products) */}
      {stockPickerOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeStockPicker}></div>
          <div className="relative bg-white rounded w-full max-w-2xl shadow-2xl z-[96] flex flex-col max-h-[85vh] animate-in zoom-in-95 overflow-hidden border border-slate-200">

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50">
              <div className="flex items-center gap-3">
                {stockPickerStep === 'products' && (
                  <button type="button" onClick={backToTypeSelection} className="p-1.5 hover:bg-slate-200 rounded border border-transparent hover:border-slate-300 transition-colors text-slate-600">
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </button>
                )}
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    {stockPickerStep === 'type' ? 'เลือกประเภทอุปกรณ์' : selectedDeviceType?.Label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {stockPickerStep === 'type' ? 'เลือกหมวดหมู่ก่อนเพื่อดูอุปกรณ์' : 'แตะเพื่อเพิ่มอุปกรณ์'}
                  </p>
                </div>
              </div>
              <button onClick={closeStockPicker} className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded transition-colors shadow-sm text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-white">
              {stockPickerStep === 'type' ? (
                <>
                  <div className="relative mb-5">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={globalSearchQuery}
                      onChange={(e) => searchAllProducts(e.target.value)}
                      placeholder="ค้นหาอุปกรณ์ (ทุกหมวด)..."
                      className="w-full bg-white border border-slate-300 rounded pl-9 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm"
                    />
                  </div>

                  {globalSearchQuery.trim() ? (
                    // ── โหมดค้นหาข้ามหมวด ──
                    isSearchingGlobal ? (
                      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-bold">กำลังค้นหา...</span>
                      </div>
                    ) : globalSearchResults.length === 0 ? (
                      <p className="text-sm font-bold text-slate-400 text-center py-16">ไม่พบอุปกรณ์</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {globalSearchResults.map((p) => {
                          const alreadyAdded = selectedStockItems.find(i => i.productId === p.ProductID);
                          return (
                            <button
                              key={p.ProductID}
                              type="button"
                              onClick={() => addStockItem(p)}
                              disabled={p.CurrentStock <= 0}
                              className="flex flex-col text-left bg-white border border-slate-200 hover:border-purple-400 rounded-2xl overflow-hidden transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed relative"
                            >
                              {alreadyAdded && (
                                <span className="absolute top-2 right-2 z-10 bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                                  ×{alreadyAdded.qty}
                                </span>
                              )}
                              <div className="w-full aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                                {p.ImageURL ? (
                                  <img src={encodeURI(`${STOCK_HOST}${p.ImageURL}`)} alt={p.ProductName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                                ) : (
                                  <Laptop className="w-8 h-8 text-slate-300" />
                                )}
                              </div>
                              <div className="p-2.5">
                                <p className="text-xs font-bold text-slate-700 truncate">{p.ProductName}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  คงเหลือ {p.CurrentStock}
                                  {p.LastPrice != null ? ` • ฿${Number(p.LastPrice).toLocaleString('th-TH')}` : ''}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    // ── โหมดเลือกประเภท (ค่า default) ──
                    isLoadingDeviceTypes ? (
                      <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs font-bold">กำลังโหลด...</span>
                      </div>
                    ) : stockDeviceTypes.length === 0 ? (
                      <p className="text-sm font-bold text-slate-400 text-center py-16">ไม่พบประเภทอุปกรณ์</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {stockDeviceTypes.map((t) => (
                          <button
                            key={t.TypeId}
                            type="button"
                            onClick={() => selectDeviceType(t)}
                            className="flex flex-col items-center justify-center gap-2 bg-white border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 rounded-2xl p-5 transition-colors shadow-sm"
                          >
                            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                              <Laptop className="w-5 h-5 text-purple-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-700 text-center">{t.Label}</span>
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={productSearchInModal}
                    onChange={(e) => setProductSearchInModal(e.target.value)}
                    placeholder={`ค้นหาใน ${selectedDeviceType?.Label}...`}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-700 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all mb-4"
                  />

                  {isLoadingStockProducts ? (
                    <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                      <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold">กำลังโหลด...</span>
                    </div>
                  ) : visibleStockProducts.length === 0 ? (
                    <p className="text-sm font-bold text-slate-400 text-center py-16">ไม่พบอุปกรณ์ในหมวดนี้</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {visibleStockProducts.map((p) => {
                        const alreadyAdded = selectedStockItems.find(i => i.productId === p.ProductID);
                        return (
                          <button
                            key={p.ProductID}
                            type="button"
                            onClick={() => addStockItem(p)}
                            disabled={p.CurrentStock <= 0}
                            className="flex flex-col text-left bg-white border border-slate-200 hover:border-purple-400 rounded-2xl overflow-hidden transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed relative"
                          >
                            {alreadyAdded && (
                              <span className="absolute top-2 right-2 z-10 bg-purple-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                                ×{alreadyAdded.qty}
                              </span>
                            )}
                            <div className="w-full aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                              {p.ImageURL ? (
                                <img src={encodeURI(`${STOCK_HOST}${p.ImageURL}`)} alt={p.ProductName}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; }} />
                              ) : (
                                <Laptop className="w-8 h-8 text-slate-300" />
                              )}
                            </div>
                            <div className="p-2.5">
                              <p className="text-xs font-bold text-slate-700 truncate">{p.ProductName}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                คงเหลือ {p.CurrentStock}
                                {p.LastPrice != null ? ` • ฿${Number(p.LastPrice).toLocaleString('th-TH')}` : ''}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-500">
                {selectedStockItems.length > 0 ? `เลือกแล้ว ${selectedStockItems.length} รายการ` : 'ยังไม่ได้เลือกอุปกรณ์'}
              </span>
              <button type="button" onClick={closeStockPicker}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/30 active:scale-95 transition-all">
                เสร็จแล้ว
              </button>
            </div>
          </div>

          {/* Asset serial/code entry - overlays on top when an Asset-type item was just picked */}
          {assetPickerProduct && (
            <div className="fixed inset-0 z-[97] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setAssetPickerProduct(null)}></div>
              <div className="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl z-[98] p-6 animate-modal-pop">
                <p className="text-sm font-black text-slate-800 mb-1">{assetPickerProduct.ProductName}</p>
                <p className="text-xs font-medium text-slate-400 mb-4">ต้องระบุ Serial Number และรหัสครุภัณฑ์ก่อนเพิ่ม</p>
                <div className="space-y-2.5">
                  <input type="text" value={assetSerialInput} onChange={(e) => setAssetSerialInput(e.target.value)}
                    placeholder="Serial Number"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-amber-500 focus:bg-white transition-all" />
                  <input type="text" value={assetCodeInput} onChange={(e) => setAssetCodeInput(e.target.value)}
                    placeholder="รหัสครุภัณฑ์ (เช่น CO24-001-05)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-amber-500 focus:bg-white transition-all" />
                </div>
                <div className="flex gap-2 justify-end mt-5">
                  <button type="button" onClick={() => setAssetPickerProduct(null)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">ยกเลิก</button>
                  <button type="button" onClick={confirmAddAssetItem}
                    disabled={!assetSerialInput.trim() || !assetCodeInput.trim()}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl disabled:opacity-40 transition-colors">เพิ่มอุปกรณ์</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={closeConfirm}></div>
          <div className="relative bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-white/50 overflow-hidden z-[110] animate-modal-pop p-6 text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-rose-50/50">
              <AlertCircle className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{pendingAction.title}</h3>
            <p className="text-sm font-medium text-slate-500 mb-8 px-4 leading-relaxed">{pendingAction.message}</p>

            <div className="flex gap-3 w-full">
              <button onClick={closeConfirm} className="flex-1 py-3 rounded-xl text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button
                disabled={isProcessingAction}
                onClick={executePendingAction}
                className="flex-1 py-3 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isProcessingAction ? 'กำลังดำเนินการ...' : pendingAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {isModalOpen && (
        <OpenTicketModal
          user={user}
          isSubmittingTicket={isSubmittingTicket}
          onClose={() => setIsModalOpen(false)}
          onSubmit={async (payload) => {
            if (isSubmittingRef.current) return;
            isSubmittingRef.current = true;
            setIsSubmittingTicket(true);
            try {
              await ticketAPI.createTicket(payload);
              showNotification('Request submitted successfully!', 'success');
              setIsModalOpen(false);
              fetchRequests();
            } catch (error) {
              showNotification('Failed to submit request', 'error');
            } finally {
              isSubmittingRef.current = false;
              setIsSubmittingTicket(false);
            }
          }}
        />
      )}
    </div>
  );
}