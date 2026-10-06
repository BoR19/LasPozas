import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database/db';
import { 
  Camera, 
  Search, 
  User as UserIcon, 
  AlertCircle, 
  ArrowRight, 
  Droplets, 
  Users, 
  Clock, 
  CreditCard,
  LayoutDashboard,
  History,
  ChevronRight,
  Activity,
  RefreshCw
} from 'lucide-react';
import { syncService } from '../services/syncService';
import { formatCurrency, formatDate } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';

export default function ReadingPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const stats = useLiveQuery(async () => {
    const usersCount = await db.users.count();
    const readings = await db.readings.toArray();
    const totalConsumption = readings.reduce((acc, r) => acc + r.consumption, 0);
    const totalRevenue = readings
      .filter(r => r.status === 'paid')
      .reduce((acc, r) => acc + (r.bill_details?.total || 0), 0);
    const pendingCount = readings.filter(r => r.status === 'pending').length;
    
    // Get last reading date
    const lastReading = await db.readings.orderBy('date').reverse().first();

    return { 
      usersCount, 
      totalConsumption, 
      totalRevenue, 
      pendingCount,
      lastReadingDate: lastReading ? formatDate(lastReading.date) : 'N/A'
    };
  });

  const recentActivity = useLiveQuery(async () => {
    const readings = await db.readings.orderBy('date').reverse().limit(5).toArray();
    const activityWithUsers = await Promise.all(readings.map(async (r) => {
      const u = await db.users.get(r.user_id);
      return { ...r, userName: u?.name || 'Usuario desconocido' };
    }));
    return activityWithUsers;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 pt-4 md:pt-0">
      {/* Header Welcome Card */}
      <div className="relative overflow-hidden bg-blue-600 rounded-[2.5rem] p-6 md:p-8 text-white shadow-2xl shadow-blue-200">
        <div className="relative z-10 flex flex-col gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight">
              ¡Hola, {user?.name || 'Usuario'}!
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full backdrop-blur-md border border-white/10">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-widest">
                {isAdmin ? 'Administrador' : 'Lector'}
              </p>
            </div>
          </div>

          {/* Action Buttons inside Card */}
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/users')}
              className="w-full flex items-center justify-center gap-2 p-4 bg-white text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all active:scale-[0.98] shadow-lg"
            >
              <Camera className="w-5 h-5" />
              Nueva Lectura
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => navigate('/users')}
                className="flex items-center justify-center gap-2 p-4 bg-white/20 text-white rounded-2xl font-black hover:bg-white/30 transition-all active:scale-95 backdrop-blur-sm"
              >
                <Users className="w-5 h-5" />
                Usuarios
              </button>
              <button 
                onClick={() => navigate('/consultation')}
                className="flex items-center justify-center gap-2 p-4 bg-white/20 text-white rounded-2xl font-black hover:bg-white/30 transition-all active:scale-95 backdrop-blur-sm"
              >
                <History className="w-5 h-5" />
                Historial
              </button>
              <button 
                onClick={() => syncService.triggerSync()}
                className="col-span-2 flex items-center justify-center gap-2 p-4 bg-white/20 text-white rounded-2xl font-black hover:bg-white/30 transition-all active:scale-95 backdrop-blur-sm"
              >
                <RefreshCw className="w-5 h-5" />
                Sincronizar ahora
              </button>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-400/20 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            icon={<Users className="w-5 h-5" />}
            label="Total Usuarios"
            value={stats.usersCount.toString()}
            color="text-blue-600"
            bgColor="bg-blue-50"
          />
          <StatCard 
            icon={<Clock className="w-5 h-5" />}
            label="Última Lectura"
            value={stats.lastReadingDate}
            color="text-purple-600"
            bgColor="bg-purple-50"
          />
          <StatCard 
            icon={<Droplets className="w-5 h-5" />}
            label="Consumo Total"
            value={`${stats.totalConsumption}m³`}
            color="text-cyan-600"
            bgColor="bg-cyan-50"
          />
          <StatCard 
            icon={<AlertCircle className="w-5 h-5" />}
            label="Pendientes"
            value={stats.pendingCount.toString()}
            color="text-orange-600"
            bgColor="bg-orange-50"
          />
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-[2.5rem] border border-zinc-100 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-xl">
              <Activity className="w-5 h-5 text-zinc-600" />
            </div>
            <h2 className="text-xl font-black text-zinc-900">Actividad Reciente</h2>
          </div>
          <button 
            onClick={() => navigate('/consultation')}
            className="text-xs font-black text-blue-600 uppercase tracking-widest hover:text-blue-700 transition-colors"
          >
            Ver Todo
          </button>
        </div>
        <div className="p-4">
          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((activity) => (
                <div 
                  key={activity.id}
                  className="flex items-center justify-between p-4 hover:bg-zinc-50 rounded-2xl transition-colors group cursor-pointer"
                  onClick={() => navigate(`/users/${activity.user_id}`)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                      {activity.userName.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900">{activity.userName}</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{formatDate(activity.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-zinc-900">{activity.consumption}m³</p>
                    <p className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full inline-block",
                      activity.status === 'paid' ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"
                    )}>
                      {activity.status === 'paid' ? 'Pagado' : 'Pendiente'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
                <Search className="w-8 h-8 text-zinc-200" />
              </div>
              <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Sin lecturas registradas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, bgColor }: { icon: React.ReactNode, label: string, value: string, color: string, bgColor: string }) {
  return (
    <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-zinc-100 shadow-sm space-y-2 md:space-y-4">
      <div className={cn("w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center", bgColor, color)}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-[0.15em]">{label}</p>
        <p className="text-lg md:text-xl font-black text-zinc-900 tracking-tight">{value}</p>
      </div>
    </div>
  );
}
