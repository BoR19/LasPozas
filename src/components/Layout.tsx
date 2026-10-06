import React, { ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Users, Droplets, Settings, Search, Camera, LogOut, Home, FileText, User as UserIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import MobileTopBar from './MobileTopBar';
import SyncIndicator from './SyncIndicator';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: Home, label: 'Inicio' },
    { to: '/users', icon: Users, label: 'Usuarios' },
    { to: '/consultation', icon: FileText, label: 'Historial' },
    ...(isAdmin ? [{ to: '/admin', icon: Settings, label: 'Configuración' }] : [])
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col pb-32 md:pb-0 md:pl-64">
      <SyncIndicator />
      <MobileTopBar />
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r border-zinc-200 bg-white z-30">
        <div className="flex items-center gap-3 p-6 border-b border-zinc-100">
          <div className="p-2 bg-blue-600 rounded-xl text-white">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-zinc-900 leading-tight">Tolomosita Oeste</h1>
            <p className="text-xs text-zinc-500 font-medium tracking-wide uppercase">AquaLectura</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all",
                isActive 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                  : "text-zinc-500 hover:bg-zinc-100"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-600 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Tab Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        {/* Floating Button */}
        <div className="absolute left-1/2 -top-8 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={() => navigate('/users')}
            className={cn(
              "w-16 h-16 bg-blue-600 rounded-full flex flex-col items-center justify-center text-white shadow-[0_8px_25px_rgba(37,99,235,0.4)] active:scale-90 transition-all border-4 border-zinc-50",
              location.pathname === '/users' && "bg-blue-700"
            )}
          >
            <Camera className="w-7 h-7" />
            <span className="text-[8px] font-black uppercase tracking-tighter mt-0.5">Lectura</span>
          </button>
        </div>

        {/* Tab Bar */}
        <nav className="bg-white border-t border-zinc-200 px-2 pt-2 pb-6 flex justify-between items-center pointer-events-auto rounded-t-[2.5rem] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] safe-bottom">
          <div className="flex flex-1 justify-around items-center">
            <NavLink
              to="/"
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-90 min-w-0",
                isActive ? "text-blue-600" : "text-zinc-400"
              )}
            >
              <Home className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-tight">Inicio</span>
            </NavLink>

            <NavLink
              to="/users"
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-90 min-w-0",
                isActive ? "text-blue-600" : "text-zinc-400"
              )}
            >
              <Users className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-tight">Usuarios</span>
            </NavLink>
          </div>

          {/* Spacer for Floating Button */}
          <div className="w-20" />

          <div className="flex flex-1 justify-around items-center">
            <NavLink
              to="/consultation"
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-90 min-w-0",
                isActive ? "text-blue-600" : "text-zinc-400"
              )}
            >
              <FileText className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-tight">Historial</span>
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => cn(
                  "flex flex-col items-center gap-1 p-2 rounded-xl transition-all active:scale-90 min-w-0",
                  isActive ? "text-blue-600" : "text-zinc-400"
                )}
              >
                <Settings className="w-5 h-5" />
                <span className="text-[9px] font-black uppercase tracking-tight">Ajustes</span>
              </NavLink>
            )}

            <button 
              onClick={handleLogout}
              className="flex flex-col items-center gap-1 p-2 text-zinc-400 active:scale-90 min-w-0"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase tracking-tight">Salir</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-12 w-full max-w-full overflow-x-hidden">
        <div className="max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
