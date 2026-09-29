import React, { useState, useEffect } from 'react';
import { X, Laptop, Clock, MapPin, CheckCircle, Paperclip, User } from 'lucide-react';
import { API_BASE } from '../config/api';

const STOCK_HOST = 'http://dciweb.dci.daikin.co.jp:3002';

export default function TicketDetailModal({
  ticket,
  onClose,
  ticketHistory,
  user,
  isITStaff,
  readOnly = false,
  formatters,
  actions
}) {
  if (!ticket) return null;

  const [showHelperPanel, setShowHelperPanel] = useState(false);
  const [itStaffList, setItStaffList] = useState([]);

  useEffect(() => {
    if (showHelperPanel && itStaffList.length === 0) {
      fetch(`${API_BASE}/master/it-staff`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      })
        .then(r => r.json())
        .then(d => { if (d.success) setItStaffList(d.data); })
        .catch(console.error);
    }
  }, [showHelperPanel]);

  const {
    formatDateShort,
    formatElapsedTime,
    formatThaiDateTime,
    getStatusStyle,
    getPriorityStyle,
    getRequestTypeIcon,
    getDeviceTypeColor,
    displayStatusLabel
  } = formatters;

  const {
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
    setCommentModalOpen
  } = actions;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-sans">

        {/* Backdrop */}
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity animate-fade" onClick={onClose}></div>

        {/* Modal Container */}
        <div className="relative bg-[#f8fafc] rounded-lg w-full max-w-5xl shadow-2xl z-50 flex flex-col max-h-[95vh] animate-modal-pop overflow-hidden border border-slate-300">

          {/* Header */}
          <div className="px-4 sm:px-8 py-4 sm:py-5 border-b border-slate-200 flex justify-between items-start gap-3 bg-white shrink-0 shadow-sm z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  {ticket.req_id}
                </span>
                <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border
                  ${getDeviceTypeColor(ticket.request_type).bg}
                  ${getDeviceTypeColor(ticket.request_type).text}
                  ${getDeviceTypeColor(ticket.request_type).border}`}>
                  {getRequestTypeIcon(ticket.request_type)} {ticket.request_type}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 leading-tight">{ticket.project_name}</h2>
            </div>
            <button onClick={onClose} className="p-2 bg-white border border-slate-200 hover:bg-slate-100 hover:text-rose-500 rounded-md transition-colors text-slate-500 shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 sm:gap-8">

              {/* LEFT COLUMN */}
              <div className="md:col-span-3 space-y-6">

                {/* Status & Priority Cards */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-sm">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Current Status</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${getStatusStyle(ticket.status)}`}>
                      {displayStatusLabel(ticket.status)}
                    </span>
                  </div>
                  <div className="flex-1 bg-white p-4 sm:p-5 rounded-md border border-slate-200 shadow-sm">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Priority Level</p>
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${getPriorityStyle(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </div>
                </div>

                {/* Users (Requester & In Charge) */}
                <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Requester */}
                  <div className="flex gap-4 items-center">
                    <img
                      src={ticket.emp_pic_url || `http://dcidmc.dci.daikin.co.jp/PICTURE/${ticket.empCode_created}.jpg`}
                      alt={ticket.requester_name}
                      className="h-20 w-20 sm:w-16 sm:h-16 rounded-md object-cover border border-slate-200 shadow-sm shrink-0 bg-slate-50"
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.requester_name)}&background=e2e8f0&color=334155`; }}
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-0.5">Requester</p>
                      <p className="font-bold text-slate-800 text-base leading-tight truncate">{ticket.requester_name}</p>
                      <p className="text-xs font-medium text-slate-500 mt-1 truncate">
                        {ticket.requester_email || 'No email'} • CC: <span className="font-semibold text-slate-700">{ticket.cost_center}</span>
                      </p>
                      {ticket.requester_sect && (
                        <p className="text-[11px] font-medium text-slate-400 mt-0.5">SECT: <span className="font-semibold text-slate-600">{ticket.requester_sect}</span></p>
                      )}
                    </div>
                  </div>

                  {/* In Charge */}
                  <div className="flex gap-4 items-center md:justify-end md:text-right">
                    {ticket.empCode_assigned ? (
                      <>
                        <div className="md:order-2">
                          <img
                            src={`http://dcidmc.dci.daikin.co.jp/PICTURE/${ticket.empCode_assigned}.jpg`}
                            alt={ticket.assigned_name}
                            className="h-20 w-20 sm:w-16 sm:h-16 rounded-md object-cover border border-slate-200 shadow-sm shrink-0 bg-emerald-50"
                            onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.assigned_name || ticket.empCode_assigned)}&background=dcfce7&color=166534`; }}
                          />
                        </div>
                        <div className="md:order-1 min-w-0">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">In Charge</p>
                          <p className="font-bold text-slate-800 text-base leading-tight truncate">{ticket.assigned_name || ticket.empCode_assigned}</p>
                          <p className="text-xs font-medium text-slate-500 mt-1 truncate">
                            {ticket.assigned_email || '-'}
                            {ticket.assigned_cost_center ? ` • CC: ${ticket.assigned_cost_center}` : ''}
                          </p>
                          {ticket.assigned_sect && (
                            <p className="text-[11px] font-medium text-slate-400 mt-0.5">SECT: <span className="font-semibold text-slate-600">{ticket.assigned_sect}</span></p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-md border border-dashed border-slate-300 flex items-center justify-center bg-slate-50 text-slate-400 shrink-0">
                          <User className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">In Charge</p>
                          <p className="font-bold text-slate-700 text-sm leading-tight">ยังไม่มีผู้รับผิดชอบ</p>
                          <p className="text-[11px] font-medium text-slate-500 mt-1">Pending assignment</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Team Helpers */}
                {ticket.helpers && ticket.helpers.length > 0 && (
                  <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-6">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">
                      Team helpers ({ticket.helpers.length})
                    </p>
                    <div className="space-y-3">
                      {ticket.helpers.map((h) => (
                        <div key={h.empCode} className="flex items-center gap-3 p-2 border border-slate-100 rounded-md bg-slate-50/50">
                          <img
                            src={`http://dcidmc.dci.daikin.co.jp/PICTURE/${h.empCode}.jpg`}
                            alt={h.name}
                            className="h-20 w-20 sm:w-16 sm:h-16 rounded-md object-cover border border-slate-200 bg-white"
                            onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(h.name)}&background=f8fafc&color=475569`; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{h.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{h.empCode}</p>
                          </div>
                          <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded shrink-0">
                            Helper
                          </span>
                          {/* ปุ่มลบ — เฉพาะ IT Staff */}
                          {isITStaff && ticket?.empCode_assigned === user?.empcode && actions.handleRemoveHelper && (
                            <button
                              onClick={() => actions.handleRemoveHelper(h.empCode)}
                              className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded-md transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stock Items Used */}
                {ticket.stockItems && ticket.stockItems.length > 0 && (
                  <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-6">
                    <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        อุปกรณ์ที่เบิกใช้ ({ticket.stockItems.length})
                      </p>
                      {ticket.stockItems.some(i => i.unit_price != null) && (
                        <p className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                          Total: ฿{ticket.stockItems.reduce((sum, i) => sum + (i.unit_price || 0) * i.qty, 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {ticket.stockItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-md transition-colors">
                          {item.image_url ? (
                            <img
                              src={encodeURI(`${STOCK_HOST}${item.image_url}`)}
                              alt={item.product_name}
                              className="w-10 h-10 rounded-md object-cover border border-slate-200 shrink-0 bg-white"
                              onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <div className={`w-10 h-10 rounded-md bg-slate-100 border border-slate-200 items-center justify-center shrink-0 ${item.image_url ? 'hidden' : 'flex'}`}>
                            <Laptop className="w-4 h-4 text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">{item.product_name}</p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {item.device_type}
                              {item.serial_number ? ` • S/N: ${item.serial_number}` : ''}
                              {item.fixed_asset_code ? ` • ${item.fixed_asset_code}` : ''}
                              {item.unit_price != null ? ` • ฿${Number(item.unit_price).toLocaleString('th-TH', { minimumFractionDigits: 2 })}/unit` : ''}
                            </p>
                          </div>
                          <span className="text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1 rounded shrink-0">
                            Qty: {item.qty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Laptop className="w-3.5 h-3.5" /> Equipment</p>
                    <p className="font-semibold text-slate-800 text-sm">{ticket.device_count}x {ticket.device_type}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Target Date</p>
                    <p className="font-semibold text-slate-800 text-sm">{formatDateShort(ticket.target_date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">📞 Internal Phone</p>
                    <p className="font-semibold text-slate-800 text-sm">{ticket.phone_internal || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">📱 Personal Phone</p>
                    <p className="font-semibold text-slate-800 text-sm">{ticket.phone_personal || '-'}</p>
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</p>
                    <p className="font-semibold text-slate-800 text-sm">{ticket.location}</p>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-6">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Requirements / Notes</p>
                  <div className="bg-slate-50 p-4 rounded-md text-sm font-medium text-slate-700 leading-relaxed border border-slate-200 whitespace-pre-wrap">
                    {ticket.notes || 'No additional notes provided.'}
                  </div>
                </div>

                {/* Resolution */}
                {ticket.root_cause && (
                  <div className="bg-white rounded-md p-4 sm:p-6 border border-emerald-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Resolution Details</p>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">Root Cause (สาเหตุ)</p>
                        <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{ticket.root_cause}</p>
                      </div>
                      <div className="h-px bg-slate-200 w-full"></div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-500 mb-1">Solution (วิธีแก้ไข)</p>
                        <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">{ticket.solution}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {ticket.attachments && (() => {
                  try {
                    const files = typeof ticket.attachments === 'string' ? JSON.parse(ticket.attachments) : ticket.attachments;
                    if (!files?.length) return null;
                    return (
                      <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-6">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-4">📎 Attachments ({files.length})</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {files.map((f, i) => {
                            const isImage = /\.(jpg|jpeg|png|gif|svg)$/i.test(f.filename);
                            return isImage ? (
                              <a key={i} href={`${API_BASE.replace('/api', '')}${f.url}`} target="_blank" rel="noopener noreferrer" className="group block">
                                <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-50 aspect-video">
                                  <img src={`${API_BASE.replace('/api', '')}${f.url}`} alt={f.originalname} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                </div>
                                <p className="text-[11px] font-medium text-slate-500 truncate mt-1.5 px-1" title={f.originalname}>{f.originalname}</p>
                              </a>
                            ) : (
                              <a key={i} href={`${API_BASE.replace('/api', '')}${f.url}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center aspect-video bg-slate-50 rounded-md border border-slate-200 hover:bg-slate-100 transition-colors p-3 group">
                                <Paperclip className="w-5 h-5 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
                                <p className="text-[11px] font-medium text-slate-500 group-hover:text-blue-600 truncate w-full text-center" title={f.originalname}>{f.originalname}</p>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    );
                  } catch { return null; }
                })()}

                {/* Comments */}
                <div className="bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comments Log</p>
                    {!readOnly && (
                      <button onClick={() => { setCommentModalOpen(true); setCommentText(''); }} className="text-[11px] bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-md font-semibold hover:bg-slate-50 transition-colors shadow-sm">
                        + Add Comment
                      </button>
                    )}
                  </div>
                  {ticket.comments && ticket.comments.length > 0 ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                      {ticket.comments.map((c) => (
                        <div key={c.id} className="flex gap-3 items-start animate-fade">
                          <img
                            src={`http://dcidmc.dci.daikin.co.jp/PICTURE/${c.empCode}.jpg`}
                            alt={c.empCode}
                            className="h-20 w-20 sm:w-16 sm:h-16 rounded-md object-cover border border-slate-200 shrink-0 bg-white"
                            onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${c.empCode}&background=f1f5f9&color=475569`; }}
                          />
                          <div className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-md p-3 sm:p-4">
                            <div className="flex items-center justify-between mb-1">
                              {/* ให้สลับเอา c.commenter_name ขึ้นก่อน เพื่อแสดงชื่อแทนรหัสพนักงาน */}
                              <span className="text-xs font-bold text-slate-700">{c.commenter_name || c.name || c.empCode}</span>
                              <span className="text-[10px] font-medium text-slate-400">{formatThaiDateTime(c.created_at)}</span>
                            </div>
                            <p className="text-sm font-medium text-slate-700 whitespace-pre-line leading-relaxed">{c.comment}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-400 text-center py-6 border border-dashed border-slate-200 rounded-md bg-slate-50">No comments yet.</p>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN (Timeline) */}
              <div className="md:col-span-2">
                <div className="sticky top-0 bg-white rounded-md border border-slate-200 shadow-sm p-4 sm:p-6">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-6">Activity Timeline</p>
                  <div className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                    {ticketHistory.length === 0 ? (
                      <div className="relative pl-5">
                        <span className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-slate-100 border-4 border-white shadow-sm"></span>
                        <p className="text-sm font-bold text-slate-700">Ticket Opened</p>
                        <p className="text-[11px] font-medium text-slate-500 mt-0.5">{formatThaiDateTime(ticket.created_at)}</p>
                      </div>
                    ) : (
                      ticketHistory.map((log, idx) => (
                        <div key={log.id} className="relative pl-5 group">
                          <span className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm transition-transform
                            ${log.action_type === 'Comment' ? 'bg-amber-400' :
                              log.action_type === 'Created' ? 'bg-slate-300' :
                                log.action_type === 'Closed' ? 'bg-emerald-500' :
                                  log.action_type === 'In Progress' ? 'bg-blue-500' :
                                    log.action_type === 'Status Update' ? (
                                      log.details?.includes('Closed') ? 'bg-emerald-500' :
                                        log.details?.includes('Rejected') ? 'bg-rose-500' :
                                          log.details?.includes('Cancelled') ? 'bg-slate-500' :
                                            log.details?.includes('In Progress') ? 'bg-blue-500' : 'bg-slate-400'
                                    ) :
                                      log.action_type === 'Rejected' ? 'bg-rose-500' :
                                        log.action_type === 'Cancelled' ? 'bg-slate-500' :
                                          log.action_type === 'Assigned' ? 'bg-indigo-500' : 'bg-slate-400'
                            }`}>
                          </span>
                          <div className="flex flex-col gap-1">
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{log.action_type}</p>
                            <p className="text-[11px] font-medium text-blue-600 mb-1">By {log.actor_name}</p>
                            <div className="text-[13px] font-medium text-slate-600 whitespace-pre-wrap bg-slate-50 p-2.5 rounded-md border border-slate-200">
                              {log.details}
                            </div>
                            <span className="text-[10px] font-medium text-slate-400 mt-1">{formatThaiDateTime(log.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Footer / Actions */}
          {!readOnly && (
            <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-slate-200 bg-white grid gap-3 sm:grid-cols-2 md:grid-cols-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
              <button onClick={() => openCommentModal('comment')} className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 rounded-md font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors shadow-sm">
                Add Comment
              </button>

              {isITStaff && ticket?.status !== 'Closed' && ticket?.status !== 'Rejected' && (
                <button onClick={() => openCommentModal('reject')} className="w-full py-2.5 bg-white border border-rose-300 text-rose-600 rounded-md font-semibold text-xs sm:text-sm hover:bg-rose-50 transition-colors shadow-sm">
                  Reject Ticket
                </button>
              )}

              {isITStaff && ticket?.status === 'Open' && (
                <button onClick={() => openConfirm({
                  title: 'Confirm Accept Ticket',
                  message: `ยืนยันการรับเคส ${ticket.req_id}? ระบบจะเปลี่ยนสถานะเป็น "กำลังดำเนินการ"`,
                  confirmLabel: 'Accept Ticket',
                  onConfirm: handleAcceptTicket
                })} className="w-full py-2.5 bg-blue-600 text-white border border-transparent rounded-md font-semibold text-xs sm:text-sm hover:bg-blue-700 transition-colors shadow-sm md:col-span-2">
                  Accept Ticket
                </button>
              )}

              {isITStaff && ticket?.status === 'In Progress' && ticket?.empCode_assigned === user?.empcode && (
                <button onClick={() => { setCommentMode('close'); setCommentText(''); setCommentModalOpen(true); }}
                  className="w-full py-2.5 bg-emerald-600 text-white border border-transparent rounded-md font-semibold text-xs sm:text-sm hover:bg-emerald-700 transition-colors shadow-sm md:col-span-2">
                  Close Ticket (Success)
                </button>
              )}

              {/* Add Helper */}
              {isITStaff && ticket?.status === 'In Progress' && ticket?.empCode_assigned === user?.empcode && (
                <button
                  onClick={() => setShowHelperPanel(true)}
                  className="w-full py-2.5 bg-white border border-slate-300 text-slate-700 rounded-md font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors shadow-sm">
                  + Add Helper
                </button>
              )}

              {/* Hold Ticket */}
              {isITStaff && ticket?.status === 'In Progress' && ticket?.empCode_assigned === user?.empcode && (
                <button
                  onClick={() => { setCommentMode('hold'); setCommentModalOpen(true); }}
                  className="w-full py-2.5 bg-white border border-amber-300 text-amber-700 rounded-md font-semibold text-xs sm:text-sm hover:bg-amber-50 transition-colors shadow-sm">
                  Hold (รออะไหล่)
                </button>
              )}

              {/* Resume Ticket */}
              {isITStaff && ticket?.status === 'On Hold' && ticket?.empCode_assigned === user?.empcode && (
                <button
                  onClick={() => openConfirm({
                    title: 'Resume Ticket',
                    message: `ยืนยันการกลับมาดำเนินการ ${ticket.req_id}?`,
                    confirmLabel: 'Resume',
                    onConfirm: handleResumeTicket
                  })}
                  className="w-full py-2.5 bg-blue-600 text-white border border-transparent rounded-md font-semibold text-xs sm:text-sm hover:bg-blue-700 transition-colors shadow-sm md:col-span-2">
                  Resume Ticket
                </button>
              )}

              {!isITStaff && ticket?.empCode_created === user?.empcode && ticket?.status === 'Open' && (
                <button onClick={() => openConfirm({
                  title: 'ยกเลิก Ticket',
                  message: `ยืนยันการยกเลิก ${ticket.req_id}?`,
                  confirmLabel: 'ยกเลิก Ticket',
                  onConfirm: handleCancelTicket
                })} className="w-full py-2.5 bg-white border border-slate-300 text-slate-600 rounded-md font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors shadow-sm md:col-span-2 md:col-start-3">
                  Cancel Request
                </button>
              )}

              {/* {isITStaff && (
                <button onClick={() => openConfirm({
                  title: 'Confirm Delete Ticket',
                  message: `คุณกำลังจะลบเคส ${ticket.req_id} อย่างถาวร ยืนยันหรือไม่?`,
                  confirmLabel: 'Delete Ticket',
                  onConfirm: handleDeleteTicket
                })} className="w-full py-2.5 bg-white border border-rose-200 text-rose-500 rounded-md font-semibold text-xs sm:text-sm hover:bg-rose-50 hover:border-rose-300 transition-colors shadow-sm md:col-span-4 mt-1">
                  Delete Ticket (Admin Only)
                </button>
              )} */}

            </div>
          )}
        </div>
      </div>

      {/* Helper Panel Modal */}
      {showHelperPanel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 font-sans">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowHelperPanel(false)} />
          <div className="relative bg-white rounded-lg w-full max-w-md shadow-2xl z-[70] p-6 animate-modal-pop border border-slate-200">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">เพิ่มผู้ช่วยเหลือ (Add Helper)</h3>
              <button onClick={() => setShowHelperPanel(false)} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
              {itStaffList.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium text-center py-8">Loading...</p>
              ) : (
                itStaffList
                  .filter(s => s.empCode !== ticket.empCode_assigned)
                  .filter(s => !ticket.helpers?.find(h => h.empCode === s.empCode))
                  .map(s => (
                    <div key={s.empCode} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-slate-50 border border-slate-200 cursor-pointer transition-colors group"
                      onClick={() => { handleAddHelper(s.empCode); setShowHelperPanel(false); }}>
                      <img src={`http://dcidmc.dci.daikin.co.jp/PICTURE/${s.empCode}.jpg`} alt={s.name}
                        className="h-20 w-20 sm:w-16 sm:h-16  rounded-md object-cover bg-slate-100 border border-slate-200"
                        onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=f8fafc&color=475569`; }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{s.name}</p>
                        <p className="text-[11px] font-medium text-slate-500">{s.empCode}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        + Add
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}