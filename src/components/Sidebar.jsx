import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Computer, LogOut, LayoutDashboard, Ticket, User, BarChart2, Database, ChevronRight, Monitor, X } from 'lucide-react';
import logodaikin from '../../public/icon-daikin (Custom).png';

export default function Sidebar({ user, isITStaff, logout, mobileOpen, setMobileOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = new URLSearchParams(location.search).get('view') || 'all';

  const isActive = (path, view = null) => {
    if (view) return location.pathname === path && currentView === view;
    return location.pathname === path;
  };

  const handleMenuClick = (path) => {
    navigate(path);
    if (setMobileOpen) setMobileOpen(false); // Close mobile drawer
  };

  // Helper สำหรับสร้างปุ่มเมนูที่ปรับปรุงแล้ว (สไตล์ Modern & Formal ลดความโค้งมน)
  const MenuButton = ({ onClick, icon: Icon, label, active, adminBadge }) => (
    <button
      onClick={onClick}
      className={`w-full group flex items-center gap-3 px-3 py-2.5 transition-colors duration-200 mb-1 relative border-l-4 ${
        active
          ? 'bg-blue-600/10 text-white border-blue-500'
          : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      {/* ไอคอน */}
      <Icon className={`w-4 h-4 xl:w-5 xl:h-5 transition-colors duration-200 ${
        active ? 'text-blue-500' : 'group-hover:text-slate-300'
      }`} />

      {/* ข้อความ */}
      <span className={`font-semibold text-[13px] xl:text-sm tracking-wide whitespace-nowrap truncate block w-full text-left ${
        active ? 'text-white' : ''
      }`}>
        {label}
      </span>

      {/* Admin Badge */}
      {adminBadge && !active && (
        <span className="ml-auto text-[9px] bg-slate-800 text-white px-1.5 py-0.5 rounded-sm font-bold uppercase border border-slate-700">
          Admin
        </span>
      )}

      {/* ลูกศรขวาเมื่อ Active */}
      {active && <ChevronRight className="ml-auto w-3.5 h-3.5 xl:w-4 xl:h-4 text-blue-500" />}
    </button>
  );

  return (
    <>
      {/* Mobile Backdrop overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside 
        className={`w-64 xl:w-72 bg-[#0f172a] border-r border-slate-800 h-screen h-[100dvh] flex flex-col z-50 transition-transform duration-300
          ${mobileOpen 
            ? 'fixed inset-y-0 left-0 translate-x-0 shadow-2xl' 
            : 'hidden md:flex -translate-x-full md:translate-x-0'}
        `}
      >
        {/* Header Section (Flat & Formal) */}
        <div className="h-16 xl:h-20 flex items-center justify-between px-4 xl:px-6 bg-[#0b1120] border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-sm shadow-sm flex items-center justify-center border border-slate-200">
              <img src={logodaikin} alt="DAIKIN Logo" className="w-5 h-5 xl:w-6 xl:h-6 object-contain" />
            </div>
            <span className="text-lg xl:text-xl font-bold text-white tracking-tight flex items-center">
              IT HELP<span className="text-blue-500 mx-1 font-black">|</span><span className="text-blue-600 font-black">DESK</span>
            </span>
          </div>

          {/* Mobile Close Button */}
          {mobileOpen && (
            <button 
              onClick={() => setMobileOpen(false)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-sm md:hidden transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* User Profile Section (Corporate Structure) */}
        <div className="p-4 xl:p-6 border-b border-slate-800 bg-gradient-to-b from-[#121b2f] to-[#0f172a] shrink-0">
          <div className="flex items-start gap-3 xl:gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-20 rounded-sm overflow-hidden border-2 border-[#121b2f] ring-2 ring-slate-700 hover:ring-blue-500 transition-colors duration-300 bg-slate-800 flex items-center justify-center">
                {user?.empPic ? (
                  <img src={user.empPic} alt={user?.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  <span className="text-slate-400 font-bold text-2xl xl:text-3xl">{user?.name?.charAt(0) || 'U'}</span>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-green-500 w-3.5 h-3.5 xl:w-4 xl:h-4 rounded-full border-2 border-[#0f172a]"></div>
            </div>

            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-white font-bold text-[13px] xl:text-sm truncate uppercase tracking-wide">
                {user?.name || 'User Name'}
              </p>
              <p className="text-slate-400 text-[10px] xl:text-[11px] truncate mb-1.5">
                {user?.email || 'no-email@company.com'}
              </p>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] xl:text-[10px] font-bold tracking-wider border ${
                isITStaff 
                  // ? 'bg-blue-900/40 text-blue-400 border-blue-800/50'  // STAFF ICON 
                  ? 'bg-blue-900/40 text-blue-400 border-blue-800/50'  // STAFF ICON 
                  : 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50' //USER ICON
              }`}>
                {isITStaff ? 'IT STAFF' : 'USER'}
              </span>
            </div>
          </div>

          {/* ปรับ grid โดยเพิ่ม gap-x-2 เพื่อเว้นช่องว่างแนวนอน */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-y-2 gap-x-3 text-left">
            {/* ใส่ col-span-2 ให้ Section เพื่อให้มันอยู่เต็มบรรทัดบน */}
            <div className="col-span-2">
              <p className="text-slate-500 font-bold uppercase text-[9px] xl:text-[10px] tracking-widest mb-0.5">Section</p>
              <p className="text-slate-200 font-semibold text-[11px] xl:text-xs truncate pr-2" title={user?.sect_long || user?.sect || 'Department'}>
                {user?.sect_long || user?.sect || 'DEPARTMENT'}
              </p>
            </div>
            {/* Position และ Cost Center จะถูกแบ่งคนละ 50% ในบรรทัดเดียวกันอัตโนมัติ */}
            <div>
              <p className="text-slate-500 font-bold uppercase text-[9px] xl:text-[10px] tracking-widest mb-0.5">Position</p>
              <p className="text-slate-200 font-semibold text-[11px] xl:text-xs truncate">
                {user?.Position || 'POSITION'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 font-bold uppercase text-[9px] xl:text-[10px] tracking-widest mb-0.5">Cost Center</p>
              <p className="text-slate-200 font-semibold text-[11px] xl:text-xs truncate">
                {user?.cost_center || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          
          <div className="px-4 mb-4">
            <h3 className="px-3 text-[9px] xl:text-[10px] font-bold text-white uppercase tracking-[0.2em] mb-2">
              General
            </h3>
            <nav className="space-y-0.5">
              <MenuButton
                label="Dashboard"
                icon={LayoutDashboard}
                active={isActive('/dashboard')}
                onClick={() => handleMenuClick('/dashboard')}
              />
              <MenuButton
                label="All Tickets"
                icon={Ticket}
                active={isActive('/') && currentView === 'all'}
                onClick={() => handleMenuClick('/?view=all')}
              />
              <MenuButton
                label="My Tickets"
                icon={User}
                active={isActive('/') && currentView === 'mine'}
                onClick={() => handleMenuClick('/?view=mine')}
              />
            </nav>
          </div>

          {isITStaff && (
            <div className="px-4 mb-4">
              <h3 className="px-3 text-[9px] xl:text-[10px] font-bold text-white uppercase tracking-[0.2em] mb-2">
                Admin Tools
              </h3>
              <nav className="space-y-0.5">
                <MenuButton
                  label="Reports"
                  icon={BarChart2}
                  active={isActive('/report')}
                  onClick={() => handleMenuClick('/report')}
                />
                <MenuButton
                  label="Master Data"
                  icon={Database}
                  active={isActive('/master')}
                  onClick={() => handleMenuClick('/master')}
                  adminBadge={true}
                />
              </nav>
            </div>
          )}
        </div>

        {/* Bottom Section / Logout */}
        <div className="p-4 border-t border-slate-800 bg-[#0b1120] shrink-0">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mb-3 xl:mb-4 text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>

          <div className="text-center flex flex-col items-center justify-center">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">
              Developed By
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-sm border border-slate-700/50">
              NATTHAWUT.Y
            </span>
          </div>
        </div>
        
      </aside>

      {/* Global Style for Custom Scrollbar (สามารถนำไปใส่ใน index.css หรือ global css ของโปรเจกต์ได้) */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569; 
        }
      `}</style>
    </>
  );
}

