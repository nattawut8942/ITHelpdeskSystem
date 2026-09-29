// frontend/src/components/OpenTicketModal.jsx
import React, { useState, useEffect } from 'react';
import { X, Paperclip, Loader2, ChevronDown } from 'lucide-react';
import { API_BASE } from '../config/api';

const token = () => localStorage.getItem('authToken');
const today = new Date().toISOString().split('T')[0];

export default function OpenTicketModal({ user, onClose, onSubmit }) {
    const [masterData, setMasterData] = useState(null);
    const [loadingMaster, setLoadingMaster] = useState(true);
    const [attachments, setAttachments] = useState([]);
    
    const [formData, setFormData] = useState({
        problemTypeId: '',
        problemSubtypeId: '',
        locationId: '',
        subLocationId: '',
        deviceTypeId: '',
        projectName: '',
        targetDate: today,
        deviceCount: 1,
        priority: 'Normal',
        requirements: '',
        phone_internal: '',
        phone_personal: '',
        problem_type_name: '',
        problem_subtype_name: '',
    });

    // Derived filtered lists
    const subtypes = masterData?.problemSubtypes.filter(s => s.type_id === parseInt(formData.problemTypeId)) || [];
    const subLocations = masterData?.subLocations.filter(s => s.location_id === parseInt(formData.locationId)) || [];

    useEffect(() => {
        const fetchMaster = async () => {
            try {
                const res = await fetch(`${API_BASE}/master/all`, {
                    headers: { Authorization: `Bearer ${token()}` }
                });
                const data = await res.json();
                if (data.success) setMasterData(data.data);
            } catch (e) { console.error(e); }
            finally { setLoadingMaster(false); }
        };
        fetchMaster();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const next = { ...prev, [name]: value };
            // Reset dependent fields on parent change
            if (name === 'problemTypeId') next.problemSubtypeId = '';
            if (name === 'locationId') next.subLocationId = '';
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Upload files ก่อน (ถ้ามี)
        let uploadedFiles = [];
        if (attachments.length > 0) {
            const formDataFiles = new FormData();
            attachments.forEach(f => formDataFiles.append('files', f));
            try {
                const uploadRes = await fetch(`${API_BASE}/upload/ticket-attachment`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token()}` },
                    body: formDataFiles,
                });
                const uploadData = await uploadRes.json();
                if (uploadData.success) uploadedFiles = uploadData.files;
            } catch (e) {
                console.error('Upload failed:', e);
            }
        }

        const selectedType = masterData?.problemTypes.find(t => t.id === parseInt(formData.problemTypeId));
        const selectedSubtype = masterData?.problemSubtypes.find(s => s.id === parseInt(formData.problemSubtypeId));
        const selectedLoc = masterData?.locations.find(l => l.id === parseInt(formData.locationId));
        const selectedSubLoc = masterData?.subLocations.find(s => s.id === parseInt(formData.subLocationId));
        const selectedDevice = masterData?.deviceTypes.find(d => d.id === parseInt(formData.deviceTypeId));

        const payload = {
            request_type: selectedSubtype?.name || selectedType?.name || 'Other',
            problem_type_id: selectedType?.id || null,
            problem_subtype_id: selectedSubtype?.id || null,
            problem_type_name: selectedType?.name || '',
            problem_subtype_name: selectedSubtype?.name || '',
            project_name: formData.projectName,
            device_type: selectedDevice?.name || 'Not Applicable (N/A)',
            device_count: parseInt(formData.deviceCount, 10) || 1,
            location: [selectedLoc?.name, selectedSubLoc?.name].filter(Boolean).join(' › '),
            priority: formData.priority,
            target_date: formData.targetDate || new Date().toISOString().split('T')[0],
            notes: formData.requirements,
            attachments: uploadedFiles,
            phone_internal: formData.phone_internal,
            phone_personal: formData.phone_personal,
            emp_pic_url: user?.empPic || '',
        };
        onSubmit(payload);
    };

    // ฟังก์ชันจัดการสีของ Priority แบบทางการ
    const getPriorityStyle = (level, isSelected) => {
        if (!isSelected) {
            return 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50';
        }
        switch(level) {
            case 'Normal': return 'bg-emerald-600 border-emerald-600 text-white';
            case 'Medium': return 'bg-amber-500 border-amber-500 text-white';
            case 'High': return 'bg-orange-500 border-orange-500 text-white';
            case 'Critical': return 'bg-rose-600 border-rose-600 text-white';
            default: return 'bg-slate-700 border-slate-700 text-white';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade">
            <div className="bg-white rounded w-full max-w-4xl shadow-xl overflow-hidden flex flex-col max-h-[95vh] animate-modal-pop border border-slate-300">

                {/* Header (Sticky) */}
                <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 sticky top-0 z-20 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Create New Ticket</h2>
                        <p className="text-xs text-slate-500 mt-1">กรอกรายละเอียดเพื่อให้ IT ดำเนินการแก้ไขปัญหา</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-2 rounded transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* User Info Micro-Cards */}
                <div className="px-6 pt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-slate-200 bg-slate-50 p-3 rounded flex items-center gap-4">
                        {user?.empPic ? (
                            <img src={user.empPic} alt={user?.name} className="h-20 w-18 rounded object-cover border border-slate-300 bg-white" />
                        ) : (
                            <div className="h-10 w-10 rounded bg-slate-200 flex items-center justify-center text-slate-500 font-bold border border-slate-300">
                                {user?.name?.charAt(0) || 'U'}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Requester</p>
                            <p className="text-sm font-bold text-slate-800 truncate">{user?.name || 'Unknown'}</p>
                        </div>
                    </div>
                    <div className="border border-slate-200 bg-slate-50 p-3 rounded flex flex-col justify-center">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Department</p>
                        <p className="text-sm font-bold text-slate-800 truncate">{user?.sect_long || user?.sect || '-'}</p>
                    </div>
                    <div className="border border-slate-200 bg-slate-50 p-3 rounded flex flex-col justify-center">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">Contact</p>
                        <p className="text-xs font-semibold text-slate-600 truncate">{user?.email || 'No email'}</p>
                    </div>
                </div>

                {loadingMaster ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-sm font-medium">กำลังเตรียมข้อมูล...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 custom-scrollbar">
                        <div className="p-6 space-y-6">
                            
                            {/* Section 1 */}
                            <div className="space-y-4">
                                <SectionHeader num="1" label="ประเภทปัญหา (Problem Details)" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SelectWrapper label="ประเภทปัญหาหลัก" required>
                                        <select name="problemTypeId" value={formData.problemTypeId} onChange={handleChange} required className={selectCls}>
                                            <option value="">-- เลือกประเภทปัญหาหลัก --</option>
                                            {masterData?.problemTypes.map(t => (
                                                <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                                            ))}
                                        </select>
                                    </SelectWrapper>
                                    
                                    <SelectWrapper label="ประเภทย่อย">
                                        <select name="problemSubtypeId" value={formData.problemSubtypeId} onChange={handleChange} disabled={!formData.problemTypeId || subtypes.length === 0} className={selectCls}>
                                            <option value="">-- เลือกประเภทย่อย --</option>
                                            {subtypes.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </SelectWrapper>
                                </div>

                                <div>
                                    <Label>หัวข้อ / รายละเอียดปัญหาแบบย่อ <Req /></Label>
                                    <input
                                        name="projectName" value={formData.projectName} onChange={handleChange} required
                                        placeholder="ตัวอย่าง: คอมพิวเตอร์เปิดไม่ติด, ไม่สามารถพิมพ์เอกสารได้"
                                        className={inputCls}
                                    />
                                </div>
                            </div>

                            {/* Section 2 */}
                            <div className="space-y-4 pt-2">
                                <SectionHeader num="2" label="สถานที่และอุปกรณ์ (Location & Equipment)" />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <SelectWrapper label="สถานที่หลัก (Location)" required>
                                        <select name="locationId" value={formData.locationId} onChange={handleChange} required className={selectCls}>
                                            <option value="">-- เลือกสถานที่หลัก --</option>
                                            {masterData?.locations.map(l => (
                                                <option key={l.id} value={l.id}>{l.name}</option>
                                            ))}
                                        </select>
                                    </SelectWrapper>
                                    
                                    <SelectWrapper label="สถานที่ย่อย (Sub-Location)">
                                        <select name="subLocationId" value={formData.subLocationId} onChange={handleChange} disabled={!formData.locationId || subLocations.length === 0} className={selectCls}>
                                            <option value="">-- เลือกสถานที่ย่อย --</option>
                                            {subLocations.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </SelectWrapper>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2">
                                        <SelectWrapper label="ประเภทอุปกรณ์ (Device Type)">
                                            <select name="deviceTypeId" value={formData.deviceTypeId} onChange={handleChange} className={selectCls}>
                                                <option value="">-- เลือกประเภทอุปกรณ์ --</option>
                                                {masterData?.deviceTypes.map(d => (
                                                    <option key={d.id} value={d.id}>{d.icon} {d.name}</option>
                                                ))}
                                            </select>
                                        </SelectWrapper>
                                    </div>
                                    <div>
                                        <Label>จำนวน (Qty)</Label>
                                        <input type="number" name="deviceCount" value={formData.deviceCount} onChange={handleChange} min="1" className={inputCls} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label>เบอร์โทรศัพท์ภายใน (Internal Phone)</Label>
                                        <input
                                            name="phone_internal" value={formData.phone_internal} onChange={handleChange}
                                            placeholder="ตัวอย่าง: 1234" className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <Label>เบอร์ติดต่อ (Personal Phone - ไม่บังคับ )</Label>
                                        <input
                                            name="phone_personal" value={formData.phone_personal} onChange={handleChange}
                                            placeholder="ตัวอย่าง: 081-xxx-xxxx " className={inputCls}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 3 */}
                            <div className="space-y-4 pt-2">
                                <SectionHeader num="3" label="ความเร่งด่วนและกำหนดเวลา (Priority & Deadline)" />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <Label>ระดับความเร่งด่วน (Priority)</Label>
                                        <div className="flex gap-2 mt-2">
                                            {['Normal', 'Medium', 'High', 'Critical'].map(level => {
                                                const isSelected = formData.priority === level;
                                                return (
                                                    <label key={level} className={`flex-1 cursor-pointer text-center py-2 px-1 border rounded text-xs font-bold tracking-wide transition-colors ${getPriorityStyle(level, isSelected)}`}>
                                                        <input type="radio" name="priority" value={level} checked={isSelected} onChange={handleChange} className="hidden" />
                                                        {level}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div>
                                        <Label>วันที่ต้องการให้แล้วเสร็จ (Target Date)</Label>
                                        <input
                                            type="date"
                                            name="targetDate"
                                            value={formData.targetDate}
                                            onChange={handleChange}
                                            className={inputCls}
                                        />
                                        <p className="mt-1.5 text-[10px] text-slate-500">ค่าเริ่มต้นคือวันปัจจุบัน สามารถเปลี่ยนแปลงได้หากไม่เร่งด่วน</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 4 */}
                            <div className="space-y-4 pt-2">
                                <SectionHeader num="4" label="รายละเอียดเพิ่มเติมและไฟล์แนบ (Notes & Attachments)" />
                                <div>
                                    <textarea rows="3" name="requirements" value={formData.requirements} onChange={handleChange}
                                        className={`${inputCls} resize-none`}
                                        placeholder="ระบุรายละเอียดเพิ่มเติม, ข้อมูลเครื่อง, หรือซอฟต์แวร์ที่เกี่ยวข้อง..." />
                                </div>

                                <div>
                                    <Label>ไฟล์แนบ (Attachments - ไม่บังคับ)</Label>
                                    <div
                                        className="border border-dashed border-slate-300 rounded p-6 bg-slate-50 hover:bg-slate-100 hover:border-blue-400 cursor-pointer transition-colors text-center"
                                        onClick={() => document.getElementById('file-input').click()}
                                    >
                                        <input
                                            id="file-input" type="file" multiple accept=".jpg,.jpeg,.png,.gif,.pdf,.svg" className="hidden"
                                            onChange={(e) => {
                                                const files = Array.from(e.target.files);
                                                setAttachments(files);
                                            }}
                                        />
                                        <Paperclip className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                                        <p className="text-sm font-semibold text-slate-600">คลิกที่นี่เพื่อแนบไฟล์</p>
                                        <p className="text-xs mt-1 text-slate-500">รองรับไฟล์ JPG, PNG, PDF (ขนาดไม่เกิน 5MB)</p>
                                        
                                        {attachments.length > 0 && (
                                            <div className="mt-4 space-y-2 text-left" onClick={(e) => e.stopPropagation()}>
                                                {attachments.map((f, i) => (
                                                    <div key={i} className="flex items-center gap-3 text-xs bg-white px-3 py-2 rounded border border-slate-200">
                                                        <Paperclip className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                        <span className="flex-1 truncate font-medium text-slate-700">{f.name}</span>
                                                        <span className="text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions (Sticky Bottom) */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 sticky bottom-0 bg-slate-50 z-20">
                            <button type="button" onClick={onClose} className="px-5 py-2 rounded border border-slate-300 font-bold text-xs text-slate-600 hover:bg-slate-100 transition-colors">
                                ยกเลิก
                            </button>
                            <button type="submit" className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs transition-colors shadow-sm flex items-center gap-2">
                                บันทึก Ticket
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// UI Components & Styles - เปลี่ยนให้เป็นทางการ
const inputCls = "w-full bg-white border border-slate-300 rounded p-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors";
const selectCls = `${inputCls} appearance-none cursor-pointer disabled:opacity-50 disabled:bg-slate-50 pr-10`;

const Label = ({ children }) => <label className="block text-xs font-bold text-slate-700 mb-1.5">{children}</label>;
const Req = () => <span className="text-rose-500 ml-0.5">*</span>;

const SectionHeader = ({ num, label }) => (
    <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
        <div className="w-6 h-6 rounded bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
            {num}
        </div>
        <h3 className="text-sm font-bold text-slate-800">{label}</h3>
    </div>
);

// Wrapper สำหรับ Select เพื่อใส่ไอคอนลูกศร
const SelectWrapper = ({ label, required, children }) => (
    <div>
        <Label>{label} {required && <Req />}</Label>
        <div className="relative">
            {children}
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
            </div>
        </div>
    </div>
);