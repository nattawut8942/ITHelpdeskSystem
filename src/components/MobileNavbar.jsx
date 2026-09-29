import React from 'react';
import { Menu, User, Bell } from 'lucide-react';
import logodaikin from '../../public/icon-daikin (Custom).png';

export default function MobileNavbar({ user, onMenuClick }) {
  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 text-indigo-300"
          aria-label="Open navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-2">
          <div className="bg-white p-1 rounded-lg">
            <img src={logodaikin} alt="DAIKIN" className="w-5 h-5 object-contain" />
          </div>
          <span className="text-sm font-black tracking-tight">
            IT HELP<span className="text-red-500">|</span><span className="text-indigo-400">DESK</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs font-bold text-white truncate max-w-[100px]">{user?.name?.split(' ')[0] || 'User'}</p>
          <p className="text-[9px] text-indigo-400 font-bold tracking-tight">
            {user?.cost_center === '7510' ? 'IT STAFF' : 'USER'}
          </p>
        </div>

        <div className="w-8 h-8 rounded-xl overflow-hidden border border-indigo-400/30 bg-indigo-950 flex items-center justify-center">
          {user?.empPic ? (
            <img 
              src={user.empPic} 
              alt={user.name} 
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <span className="text-indigo-200 font-bold text-xs">
              {user?.name?.charAt(0) || 'U'}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
