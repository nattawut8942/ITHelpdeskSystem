// frontend/src/pages/MasterDataPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import MobileNavbar from '../components/MobileNavbar';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronRight, GripVertical, Database } from 'lucide-react';
import { API_BASE } from '../config/api';

const SECTIONS = [
  { key: 'problem_types', label: 'Problem Types', hasParent: false, parentKey: null, parentLabel: null },
  { key: 'problem_subtypes', label: 'Problem Subtypes', hasParent: true, parentKey: 'problem_types', parentLabel: 'Problem Types' },
  { key: 'locations', label: 'Locations', hasParent: false, parentKey: null, parentLabel: null },
  { key: 'sub_locations', label: 'Sub-Locations', hasParent: true, parentKey: 'locations', parentLabel: 'Locations' },
  { key: 'device_types', label: 'Device Types', hasParent: false, parentKey: null, parentLabel: null },
];

const token = () => localStorage.getItem('authToken');

async function apiCall(method, path, body) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch { /* ไม่มี body เช่น 404/401/403 */ }
    if (!res.ok) return { success: false, message: json?.message || `HTTP ${res.status}` };
    return json ?? { success: false, message: 'Empty response' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

export default function MasterDataPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isITStaff = user?.cost_center === '7510';
  const [mobileOpen, setMobileOpen] = useState(false);

  const [data, setData] = useState({});
  const [activeSection, setActiveSection] = useState('problem_types');
  const [editItem, setEditItem] = useState(null);
  const [addForm, setAddForm] = useState({ name: '', icon: '', parent_id: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [notification, setNotification] = useState(null);
  const [expandedParents, setExpandedParents] = useState({});
  const [drag, setDrag] = useState(null);     // { id, group }
  const [overId, setOverId] = useState(null);

  useEffect(() => {
    if (!isITStaff) { navigate('/'); return; }
    fetchAll();
  }, [isITStaff]);

  const fetchAll = async () => {
    const res = await apiCall('GET', '/master/all');
    if (res.success) {
      setData({
        problem_types: res.data.problemTypes,
        problem_subtypes: res.data.problemSubtypes,
        locations: res.data.locations,
        sub_locations: res.data.subLocations,
        device_types: res.data.deviceTypes,
      });
    }
  };

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const section = SECTIONS.find(s => s.key === activeSection);
  const items = data[activeSection] || [];
  const parentItems = section.hasParent ? (data[section.parentKey] || []) : [];

  const handleAdd = async () => {
    if (!addForm.name.trim()) return;
    const payload = { name: addForm.name, icon: addForm.icon };
    if (section.hasParent) payload.parent_id = parseInt(addForm.parent_id);
    const res = await apiCall('POST', `/master/${activeSection}`, payload);
    if (res.success) { notify('เพิ่มรายการสำเร็จ'); fetchAll(); setAddForm({ name: '', icon: '', parent_id: '' }); setShowAdd(false); }
    else notify(res.message || 'เกิดข้อผิดพลาด', 'error');
  };

  const handleEdit = async () => {
    if (!editItem?.name?.trim()) return;
    const res = await apiCall('PUT', `/master/${activeSection}/${editItem.id}`, { name: editItem.name, icon: editItem.icon });
    if (res.success) { notify('อัปเดตข้อมูลสำเร็จ'); fetchAll(); setEditItem(null); }
    else notify(res.message || 'เกิดข้อผิดพลาด', 'error');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('คุณต้องการลบรายการนี้ใช่หรือไม่? ข้อมูลที่เกี่ยวข้องอาจได้รับผลกระทบ')) return;
    const res = await apiCall('DELETE', `/master/${activeSection}/${id}`);
    if (res.success) { notify('ลบรายการสำเร็จ'); fetchAll(); }
    else notify(res.message || 'เกิดข้อผิดพลาด', 'error');
  };

  // ย้าย fromId ไปตำแหน่งของ toId ภายในกลุ่มเดียวกัน
  const handleReorder = async (groupItems, fromId, toId) => {
    const ids = groupItems.map(i => i.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);

    // อัปเดตหน้าจอทันที (optimistic)
    setData(d => {
      const list = d[activeSection] || [];
      const byId = new Map(list.map(i => [i.id, i]));
      const inGroup = new Set(ids);
      let k = 0;
      return { ...d, [activeSection]: list.map(i => (inGroup.has(i.id) ? byId.get(ids[k++]) : i)) };
    });

    const res = await apiCall('PUT', `/master/${activeSection}/reorder`, { ids });
    if (!res.success) {
      notify(res.message || 'จัดเรียงไม่สำเร็จ', 'error');
      fetchAll();   // ย้อนกลับเป็นข้อมูลจริงจาก server
    }
  };

  const groupedItems = section.hasParent
    ? parentItems.map(p => ({
      parent: p,
      children: items.filter(i => {
        const f = section.key === 'problem_subtypes' ? 'type_id' : 'location_id';
        return i[f] === p.id;
      })
    }))
    : null;

  const dnd = { drag, setDrag, overId, setOverId, onReorder: handleReorder };

  if (!isITStaff) return null;
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col md:flex-row overflow-hidden">

      {/* Mobile Navbar */}
      <MobileNavbar user={user} onMenuClick={() => setMobileOpen(true)} />

      {/* Sidebar */}
      <Sidebar user={user} isITStaff={isITStaff} logout={logout} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-[calc(100dvh-56px)] md:h-screen overflow-hidden p-0 md:p-6">
        <div className="bg-white rounded shadow-sm flex flex-col h-full overflow-hidden border border-slate-200 relative">

          {/* Notification Toast */}
          {notification && (
            <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
              <div className={`flex items-center gap-3 px-5 py-3 rounded shadow-lg border text-xs font-bold ${notification.type === 'error'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                {notification.type === 'error' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                <span>{notification.msg}</span>
              </div>
            </div>
          )}

          {/* Header */}
          <header className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center z-10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-slate-200 text-slate-700 flex items-center justify-center border border-slate-300">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">Master Data</h1>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">จัดการตัวเลือกของระบบ</p>
              </div>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">

            {/* Left Nav Menu */}
            <div className="w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col gap-1 shrink-0 overflow-y-auto custom-scrollbar">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">Data Categories</p>
              {SECTIONS.map(s => {
                const isActive = activeSection === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => { setActiveSection(s.key); setShowAdd(false); setEditItem(null); }}
                    className={`group w-full flex items-center justify-between px-3 py-2.5 rounded text-xs font-semibold transition-colors border ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                  >
                    <span>{s.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${isActive ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                      {(data[s.key] || []).length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 relative">
              <div className="w-full">

                <div className="flex justify-between items-end mb-5 pb-3 border-b border-slate-200">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{section.label}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">รายการทั้งหมดในหมวดหมู่นี้</p>
                  </div>
                  <button
                    onClick={() => { setShowAdd(!showAdd); setAddForm({ name: '', icon: '', parent_id: '' }); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition-all shadow-sm ${showAdd
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {showAdd ? 'ปิดหน้าต่าง' : 'เพิ่มรายการใหม่'}
                  </button>
                </div>

                {/* Add Form */}
                {showAdd && (
                  <div className="bg-white border border-slate-200 shadow-sm rounded p-5 mb-6">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3">
                      สร้าง {section.label}
                    </h3>
                    <div className="flex flex-wrap gap-3 items-end">
                      {section.hasParent && (
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{section.parentLabel} <span className="text-rose-500">*</span></label>
                          <select
                            value={addForm.parent_id}
                            onChange={e => setAddForm(f => ({ ...f, parent_id: e.target.value }))}
                            className={inputCls + " min-w-[200px]"}
                          >
                            <option value="">-- เลือกรายการหลัก --</option>
                            {parentItems.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">ชื่อรายการ <span className="text-rose-500">*</span></label>
                        <input
                          value={addForm.name}
                          onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleAdd()}
                          placeholder="ระบุชื่อที่ต้องการเพิ่ม..."
                          className={inputCls}
                        />
                      </div>

                      {!section.hasParent && (
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide text-center">Icon</label>
                          <input
                            value={addForm.icon}
                            onChange={e => setAddForm(f => ({ ...f, icon: e.target.value }))}
                            placeholder="💻"
                            className={inputCls + " w-16 text-center text-sm"}
                          />
                        </div>
                      )}

                      <button onClick={handleAdd} className="bg-blue-600 text-white px-5 py-2.5 rounded text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
                        บันทึกข้อมูล
                      </button>
                    </div>
                  </div>
                )}

                {/* Items List Table */}
                <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">

                  {/* Table Header */}
                  <div className="grid grid-cols-12 px-5 py-3 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    <div className="col-span-1">ID</div>
                    {section.hasParent && <div className="col-span-3">{section.parentLabel}</div>}
                    <div className={section.hasParent ? 'col-span-6' : 'col-span-7'}>Name</div>
                    {!section.hasParent && <div className="col-span-2 text-center">Icon</div>}
                    <div className="col-span-2 text-right">Actions</div>
                  </div>

                  {/* Table Body */}
                  <div className="divide-y divide-slate-100">
                    {section.hasParent ? (
                      groupedItems?.map(({ parent, children }) => (
                        <div key={parent.id} className="group/parent">
                          <div
                            className="flex items-center gap-2 px-5 py-2.5 bg-slate-50/70 hover:bg-slate-100 transition-colors cursor-pointer border-b border-slate-100"
                            onClick={() => setExpandedParents(p => ({ ...p, [parent.id]: !p[parent.id] }))}
                          >
                            <div className="w-4 h-4 rounded bg-white border border-slate-300 flex items-center justify-center text-slate-500">
                              {expandedParents[parent.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            </div>
                            <span className="text-xs font-bold text-slate-800">{parent.icon} {parent.name}</span>
                            <span className="ml-auto text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{children.length} รายการ</span>
                          </div>

                          <div className={`overflow-hidden transition-all duration-300 ${expandedParents[parent.id] === false ? 'max-h-0' : 'max-h-[2000px]'}`}>
                            {children.length > 0 ? children.map(item => (
                              <ItemRow
                                key={item.id}
                                item={item}
                                section={section}
                                editItem={editItem}
                                setEditItem={setEditItem}
                                handleEdit={handleEdit}
                                handleDelete={handleDelete}
                                groupKey={`p${parent.id}`}
                                groupItems={children}
                                dnd={dnd}
                                indent
                              />
                            )) : (
                              <div className="px-12 py-3 text-xs text-slate-400 bg-white">ไม่มีข้อมูลย่อย</div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      items.map(item => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          section={section}
                          editItem={editItem}
                          setEditItem={setEditItem}
                          handleEdit={handleEdit}
                          handleDelete={handleDelete}
                          groupKey="root"
                          groupItems={items}
                          dnd={dnd}
                        />
                      ))
                    )}
                  </div>

                  {/* Empty State */}
                  {items.length === 0 && (
                    <div className="px-5 py-12 text-center text-slate-400 bg-white">
                      <p className="text-xs font-semibold">ยังไม่มีข้อมูลในหมวดหมู่นี้</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Sub-component สำหรับแถวข้อมูล (ลากวางเพื่อเรียงลำดับ)
function ItemRow({ item, section, editItem, setEditItem, handleEdit, handleDelete, groupKey, groupItems, dnd, indent }) {
  const isEditing = editItem?.id === item.id;
  const { drag, setDrag, overId, setOverId, onReorder } = dnd;

  const isDragging = drag?.id === item.id;
  const sameGroup = drag && drag.group === groupKey;
  const showLine = sameGroup && overId === item.id && drag.id !== item.id;
  const fromIdx = sameGroup ? groupItems.findIndex(i => i.id === drag.id) : -1;
  const myIdx = groupItems.findIndex(i => i.id === item.id);
  const lineCls = showLine ? (fromIdx < myIdx ? 'border-b-2 border-b-blue-500' : 'border-t-2 border-t-blue-500') : '';

  return (
    <div
      draggable={!isEditing}
      onDragStart={e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(item.id));
        setDrag({ id: item.id, group: groupKey });
      }}
      onDragOver={e => {
        if (!sameGroup) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (overId !== item.id) setOverId(item.id);
      }}
      onDrop={e => {
        e.preventDefault();
        if (sameGroup) onReorder(groupItems, drag.id, item.id);
        setDrag(null);
        setOverId(null);
      }}
      onDragEnd={() => { setDrag(null); setOverId(null); }}
      className={`group flex grid grid-cols-12 px-5 py-2.5 items-center bg-white hover:bg-slate-50 transition-colors ${indent ? 'pl-10 bg-slate-50/20' : ''} ${isDragging ? 'opacity-40' : ''} ${lineCls}`}
    >
      <div className="col-span-1 flex items-center gap-1 text-xs font-mono text-slate-500">
        <GripVertical
          className={`w-3.5 h-3.5 shrink-0 ${isEditing ? 'text-slate-200' : 'text-slate-400 cursor-grab active:cursor-grabbing'}`}
          title="ลากเพื่อเรียงลำดับ"
        />
        #{item.id}
      </div>

      {section.hasParent && <div className="col-span-3" />}

      <div className={section.hasParent ? 'col-span-6' : 'col-span-7'}>
        {isEditing ? (
          <input
            value={editItem.name}
            onChange={e => setEditItem(ei => ({ ...ei, name: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleEdit()}
            className="border border-blue-500 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none w-full"
            autoFocus
          />
        ) : (
          <span className="text-xs font-semibold text-slate-800">{item.name}</span>
        )}
      </div>

      {!section.hasParent && (
        <div className="col-span-2 text-center">
          {isEditing ? (
            <input
              value={editItem.icon || ''}
              onChange={e => setEditItem(ei => ({ ...ei, icon: e.target.value }))}
              className="border border-blue-500 rounded px-2 py-1 text-xs focus:outline-none w-12 text-center mx-auto"
            />
          ) : (
            <span className="text-base bg-slate-50 w-8 h-8 inline-flex items-center justify-center rounded border border-slate-200">{item.icon || '—'}</span>
          )}
        </div>
      )}

      <div className="col-span-2 flex justify-end gap-1.5">
        {isEditing ? (
          <>
            <button onClick={handleEdit} className="p-1.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 transition-colors"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => setEditItem(null)} className="p-1.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"><X className="w-3.5 h-3.5" /></button>
          </>
        ) : (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
            <button onClick={() => setEditItem({ ...item })} className="p-1.5 text-slate-500 bg-white border border-slate-200 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-slate-500 bg-white border border-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Styling ตัวช่วยสำหรับ Input
const inputCls = "w-full bg-white border border-slate-300 rounded p-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-blue-500 outline-none transition-colors";