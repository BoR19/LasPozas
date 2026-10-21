import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import SyncIndicator from './SyncIndicator';

interface MobileTopBarProps {
  onOpenDrawer: () => void;
}

export default function MobileTopBar({ onOpenDrawer }: MobileTopBarProps) {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 flex items-center justify-between px-4 z-40 shadow-xs">
      {/* Brand */}
      <div 
        onClick={() => navigate('/')} 
        className="flex items-center gap-2.5 cursor-pointer active:opacity-80 transition-opacity"
        role="button"
        tabIndex={0}
        aria-label="Ir a inicio"
      >
        <div className="p-2 bg-blue-600 rounded-xl text-white shadow-xs shadow-blue-200 shrink-0">
          <Droplets className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-black text-zinc-900 text-base leading-tight tracking-tight">AquaLectura</h1>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Tolomosita Oeste</p>
        </div>
      </div>

      {/* Right Controls: Sync status + Profile info + Single Hamburger Menu button */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Connectivity Badge */}
        <SyncIndicator showText={false} className="sm:hidden" />
        <SyncIndicator showText={true} className="hidden sm:inline-flex" />

        {/* User Role Badge */}
        {user && (
          <div className="hidden xs:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 rounded-lg text-xs font-semibold text-zinc-700">
            <span className="truncate max-w-[85px] sm:max-w-[120px]">{user.name.split(' ')[0]}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider ${
              isAdmin 
                ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}>
              {isAdmin ? 'Admin' : 'Lector'}
            </span>
          </div>
        )}

        {/* Single Hamburger Menu Button */}
        <button
          onClick={onOpenDrawer}
          className="p-2 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all active:scale-95 cursor-pointer border border-zinc-200/60"
          aria-label="Abrir menú de navegación"
          title="Menú y opciones"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
