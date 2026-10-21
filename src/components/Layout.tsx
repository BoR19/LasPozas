import React, { ReactNode, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Users, 
  Droplets, 
  Settings, 
  FileText, 
  CreditCard, 
  Home, 
  Camera, 
  LogOut, 
  X, 
  User as UserIcon,
  ChevronRight,
  Database
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import MobileTopBar from './MobileTopBar';
import SyncIndicator from './SyncIndicator';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { logout, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleLogout = () => {
    setIsDrawerOpen(false);
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: Home, label: 'Inicio', description: 'Panel principal y estadísticas' },
    { to: '/users', icon: Users, label: 'Usuarios', description: 'Socios, medidores y categorías' },
    { to: '/facturacion', icon: CreditCard, label: 'Facturación', description: 'Emisión de avisos y cobros' },
    { to: '/consultation', icon: FileText, label: 'Historial', description: 'Consultas de consumo y deudas' },
    ...(isAdmin ? [{ 
      to: '/admin', 
      icon: Settings, 
      label: 'Configuración', 
      description: 'Tarifas, Personal y Seguridad',
      badge: 'Admin'
    }] : [])
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col pt-16 lg:pt-0 pb-24 lg:pb-0 lg:pl-64">
      {/* Mobile Top Header (has live sync status & single hamburger menu trigger) */}
      <MobileTopBar onOpenDrawer={() => setIsDrawerOpen(true)} />

      {/* Slide-out Mobile & Tablet Navigation Drawer */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-zinc-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 animate-slide-left">
            {/* Drawer Header with User Profile */}
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs shadow-blue-200 shrink-0">
                  {user?.name?.charAt(0) || <UserIcon className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-zinc-900 text-sm truncate">{user?.name || 'Usuario'}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                      isAdmin 
                        ? "bg-amber-100 text-amber-900 border border-amber-200" 
                        : "bg-blue-100 text-blue-900 border border-blue-200"
                    )}>
                      {isAdmin ? 'Administrador' : 'Lector'}
                    </span>
                    <span className="text-zinc-400 text-xs truncate">@{user?.username}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all cursor-pointer shrink-0"
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Action in Drawer */}
            <div className="p-3 border-b border-zinc-100 bg-white">
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate('/users');
                }}
                className="w-full flex items-center justify-between p-2.5 bg-blue-50 hover:bg-blue-100/80 text-blue-700 rounded-xl transition-all font-bold text-xs cursor-pointer border border-blue-100"
              >
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-600" />
                  <span>Tomar Nueva Lectura</span>
                </div>
                <ChevronRight className="w-4 h-4 text-blue-400" />
              </button>
            </div>

            {/* Drawer Navigation Links */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 px-3 py-1">
                Menú Principal
              </p>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsDrawerOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center justify-between p-3 rounded-2xl transition-all group",
                    isActive 
                      ? "bg-blue-600 text-white shadow-md shadow-blue-100 font-bold" 
                      : item.to === '/admin'
                        ? "bg-amber-50/80 text-amber-950 border border-amber-200 hover:bg-amber-100 font-bold"
                        : "text-zinc-700 hover:bg-zinc-100 font-semibold"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-xl transition-all",
                      item.to === '/admin' ? "bg-amber-500/15 text-amber-600" : ""
                    )}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm leading-tight">{item.label}</p>
                      <p className={cn(
                        "text-[11px] font-normal",
                        location.pathname === item.to ? "text-blue-100" : "text-zinc-400"
                      )}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] bg-amber-500 text-white font-black px-2 py-0.5 rounded uppercase tracking-wider">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Sync Info in Drawer */}
            <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-zinc-400" />
                <span className="text-[11px] text-zinc-500 font-medium">Estado de conexión:</span>
              </div>
              <SyncIndicator showText={true} />
            </div>

            {/* Drawer Footer with Logout */}
            <div className="p-4 border-t border-zinc-100 bg-white">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 text-red-600 font-bold text-sm rounded-2xl hover:bg-red-100 active:scale-98 transition-all cursor-pointer border border-red-100"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (visible on lg: >= 1024px) */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col border-r border-zinc-200 bg-white z-30">
        <div className="flex items-center gap-3 p-6 border-b border-zinc-100">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-xs shadow-blue-200">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-zinc-900 leading-tight">Tolomosita Oeste</h1>
            <p className="text-xs text-zinc-500 font-medium tracking-wide uppercase">AquaLectura</p>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 mt-4 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shadow-blue-200">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-zinc-900 truncate">{user?.name}</p>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded",
              isAdmin ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
            )}>
              {isAdmin ? 'Admin' : 'Lector'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 mt-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn(
                "flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all",
                isActive 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                  : item.to === '/admin'
                    ? "text-zinc-700 hover:bg-amber-50 hover:text-amber-900"
                    : "text-zinc-500 hover:bg-zinc-100"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[9px] bg-amber-500 text-white font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Desktop Footer: Connectivity & Logout */}
        <div className="p-4 border-t border-zinc-100 space-y-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs text-zinc-400 font-medium">Sincronización</span>
            <SyncIndicator showText={true} />
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-600 hover:bg-red-50 transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Symmetrical Mobile & Tablet Bottom Tab Navigation (visible on < lg screens) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
        {/* Floating Action Button (Lectura) */}
        <div className="absolute left-1/2 -top-7 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={() => navigate('/users')}
            className={cn(
              "w-14 h-14 bg-blue-600 rounded-full flex flex-col items-center justify-center text-white shadow-[0_8px_25px_rgba(37,99,235,0.4)] active:scale-90 transition-all border-4 border-zinc-50 cursor-pointer",
              location.pathname === '/users' && "bg-blue-700"
            )}
            title="Nueva Lectura"
            aria-label="Tomar Lectura"
          >
            <Camera className="w-6 h-6" />
            <span className="text-[8px] font-black uppercase tracking-tighter">Lectura</span>
          </button>
        </div>

        {/* Balanced Tab Bar: 2 items on Left, Center FAB Spacer, 2 items on Right */}
        <nav className="bg-white border-t border-zinc-200/80 px-4 pt-2 pb-5 flex justify-between items-center pointer-events-auto rounded-t-[2rem] shadow-[0_-10px_30px_rgba(0,0,0,0.06)]">
          {/* Left Side: Inicio & Usuarios */}
          <div className="flex flex-1 justify-around items-center">
            <NavLink
              to="/"
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all active:scale-90 min-w-[56px]",
                isActive ? "text-blue-600 font-black" : "text-zinc-400 font-medium hover:text-zinc-600"
              )}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-tight">Inicio</span>
            </NavLink>

            <NavLink
              to="/users"
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all active:scale-90 min-w-[56px]",
                isActive ? "text-blue-600 font-black" : "text-zinc-400 font-medium hover:text-zinc-600"
              )}
            >
              <Users className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-tight">Usuarios</span>
            </NavLink>
          </div>

          {/* Spacer for Floating Center Button */}
          <div className="w-14 shrink-0" />

          {/* Right Side: Facturas & Config (Admin) / Historial (Lector) */}
          <div className="flex flex-1 justify-around items-center">
            <NavLink
              to="/facturacion"
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all active:scale-90 min-w-[56px]",
                isActive ? "text-blue-600 font-black" : "text-zinc-400 font-medium hover:text-zinc-600"
              )}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-[10px] uppercase tracking-tight">Facturas</span>
            </NavLink>

            {isAdmin ? (
              <NavLink
                to="/admin"
                className={({ isActive }) => cn(
                  "flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all active:scale-90 min-w-[56px]",
                  isActive ? "text-amber-600 font-black" : "text-zinc-400 font-medium hover:text-zinc-600"
                )}
                title="Panel de Configuración (Tarifas, Personal y Seguridad)"
              >
                <Settings className="w-5 h-5" />
                <span className="text-[10px] uppercase tracking-tight font-black">Config</span>
              </NavLink>
            ) : (
              <NavLink
                to="/consultation"
                className={({ isActive }) => cn(
                  "flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all active:scale-90 min-w-[56px]",
                  isActive ? "text-blue-600 font-black" : "text-zinc-400 font-medium hover:text-zinc-600"
                )}
                title="Historial de Lecturas y Deudas"
              >
                <FileText className="w-5 h-5" />
                <span className="text-[10px] uppercase tracking-tight">Historial</span>
              </NavLink>
            )}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 lg:p-12 w-full max-w-full overflow-x-hidden">
        <div className="max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
