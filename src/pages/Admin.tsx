import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Tariff, type UserCategory, type Staff, encodePassword, changePassword } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { formatDate, formatCurrency } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { Lock, Shield, UserPlus, Users, Trash2, DollarSign, Plus } from 'lucide-react';

export default function AdminPage() {
  const { isAdmin, user } = useAuth();
  const [isAddingTariff, setIsAddingTariff] = useState(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const [newTariff, setNewTariff] = useState({
    categoria: 'Residencial' as UserCategory,
    cargo_fijo_mensual: 0,
    costo_m3_base: 0,
    costo_m3_exceso: 0,
    tarifa_conexion: 0,
    porcentaje_alcantarillado: 20,
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: '2030-12-31'
  });

  const [newStaff, setNewStaff] = useState({
    username: '',
    password: '',
    role: 'lector' as 'admin' | 'lector',
    name: ''
  });

  const tariffs = useLiveQuery(() => db.tariffs.reverse().sortBy('fecha_inicio'));
  const staff = useLiveQuery(() => db.staff.toArray());

  const handleAddTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.tariffs.add({
      ...newTariff,
      fecha_inicio: new Date(newTariff.fecha_inicio).getTime(),
      fecha_fin: new Date(newTariff.fecha_fin).getTime(),
      uuid: uuidv4(),
      updated_at: Date.now(),
      version: 1
    });
    setIsAddingTariff(false);
    setNewTariff({
      categoria: 'Residencial',
      cargo_fijo_mensual: 0,
      costo_m3_base: 0,
      costo_m3_exceso: 0,
      tarifa_conexion: 0,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '2030-12-31'
    });
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    await db.staff.add({
      ...newStaff,
      password: encodePassword(newStaff.password),
      uuid: uuidv4(),
      updated_at: Date.now(),
      version: 1
    });
    setIsAddingStaff(false);
    setNewStaff({ username: '', password: '', role: 'lector', name: '' });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      const staffUser = await db.staff.where('username').equals(user?.username || '').first();
      if (!staffUser) throw new Error('Usuario no encontrado');
      
      await changePassword(staffUser.id!, passwordData.currentPassword, passwordData.newPassword);
      setPasswordSuccess('Contraseña actualizada correctamente');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    }
  };

  const [isConfirming, setIsConfirming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: 'tariff' | 'staff' } | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'tariff') {
        await db.tariffs.delete(deleteTarget.id);
      } else {
        await db.staff.delete(deleteTarget.id);
      }
      // UI refresh is handled by useLiveQuery
    } catch (err) {
      console.error('Error al eliminar:', err);
      alert('No se pudo eliminar');
    } finally {
      setDeleteTarget(null);
      setIsConfirming(false);
    }
  };

  const confirmDelete = (id: number, type: 'tariff' | 'staff') => {
    setDeleteTarget({ id, type });
    setIsConfirming(true);
  };

  if (!isAdmin) return <div className="p-8 text-center font-bold text-red-500 text-xl">Acceso Denegado</div>;

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Configuración</h1>
          <p className="text-zinc-500 font-medium">Gestión de tarifas, personal y seguridad</p>
        </div>
      </div>

      {/* Security Management */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-zinc-400" />
          <h2 className="text-xl font-black text-zinc-900 tracking-tight">Seguridad</h2>
        </div>
        <button 
          onClick={() => setIsChangingPassword(true)}
          className="flex items-center gap-2 bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all"
        >
          <Lock className="w-4 h-4" /> Cambiar Contraseña
        </button>
      </section>

      {/* Staff Management */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-zinc-400" />
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">Personal (Lectores y Admins)</h2>
          </div>
          <button 
            onClick={() => setIsAddingStaff(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
          >
            <UserPlus className="w-4 h-4" /> Nuevo Personal
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff?.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-3xl border border-zinc-200 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  s.role === 'admin' ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                )}>
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-zinc-900">{s.name}</p>
                  <p className="text-xs text-zinc-400 font-medium tracking-wide uppercase">{s.role} • @{s.username}</p>
                </div>
              </div>
              {s.username !== '@dmin&' && (
                <button 
                  onClick={() => confirmDelete(s.id!, 'staff')}
                  className="p-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Tariff Management */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-zinc-400" />
            <h2 className="text-xl font-black text-zinc-900 tracking-tight">Estructura Tarifaria</h2>
          </div>
          <button 
            onClick={() => setIsAddingTariff(true)}
            className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all"
          >
            <Plus className="w-4 h-4" /> Nueva Tarifa
          </button>
        </div>

        <div className="space-y-4">
          {tariffs?.map(tariff => (
            <div 
              key={tariff.id}
              className="bg-white p-6 rounded-3xl border border-zinc-200 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-black text-zinc-900">{tariff.categoria}</p>
                  <p className="text-xs text-zinc-500 font-medium">
                    {formatDate(tariff.fecha_inicio)} → {formatDate(tariff.fecha_fin)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1 lg:max-w-2xl">
                <div className="text-right">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Cargo Fijo</p>
                  <p className="font-bold text-zinc-900">{formatCurrency(tariff.cargo_fijo_mensual)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Conexión</p>
                  <p className="font-bold text-zinc-900">{formatCurrency(tariff.tarifa_conexion)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Base (0-20m³)</p>
                  <p className="font-bold text-zinc-900">{formatCurrency(tariff.costo_m3_base)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Exceso (&gt;20m³)</p>
                  <p className="font-bold text-zinc-900">{formatCurrency(tariff.costo_m3_exceso)}</p>
                </div>
              </div>

              <button 
                onClick={() => confirmDelete(tariff.id!, 'tariff')}
                className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Modals */}
      {isChangingPassword && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Cambiar Contraseña</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Contraseña Actual</label>
                <input required type="password" value={passwordData.currentPassword} onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nueva Contraseña</label>
                <input required type="password" value={passwordData.newPassword} onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Confirmar Nueva Contraseña</label>
                <input required type="password" value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
              </div>
              {passwordError && <p className="text-red-500 text-sm font-bold">{passwordError}</p>}
              {passwordSuccess && <p className="text-green-500 text-sm font-bold">{passwordSuccess}</p>}
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsChangingPassword(false)} className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100">Actualizar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingStaff && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Nuevo Personal</h2>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nombre Completo</label>
                <input required type="text" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Usuario</label>
                <input required type="text" value={newStaff.username} onChange={e => setNewStaff({...newStaff, username: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Contraseña</label>
                <input required type="password" value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Rol</label>
                <select value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value as any})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500">
                  <option value="lector">Lector</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsAddingStaff(false)} className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingTariff && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Configurar Tarifa</h2>
            <form onSubmit={handleAddTariff} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Categoría</label>
                  <select value={newTariff.categoria} onChange={e => setNewTariff({...newTariff, categoria: e.target.value as UserCategory})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500">
                    <option value="Residencial">Residencial</option>
                    <option value="Residencial Social">Residencial Social</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Cargo Fijo (Bs)</label>
                  <input required type="number" step="0.01" value={newTariff.cargo_fijo_mensual} onChange={e => setNewTariff({...newTariff, cargo_fijo_mensual: Number(e.target.value)})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Tarifa Conexión (Bs)</label>
                  <input required type="number" step="0.01" value={newTariff.tarifa_conexion} onChange={e => setNewTariff({...newTariff, tarifa_conexion: Number(e.target.value)})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Base (0-20m³)</label>
                  <input required type="number" step="0.01" value={newTariff.costo_m3_base} onChange={e => setNewTariff({...newTariff, costo_m3_base: Number(e.target.value)})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Exceso (&gt;20m³)</label>
                  <input required type="number" step="0.01" value={newTariff.costo_m3_exceso} onChange={e => setNewTariff({...newTariff, costo_m3_exceso: Number(e.target.value)})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Alcantarillado (%)</label>
                  <input required type="number" min="0" max="100" value={newTariff.porcentaje_alcantarillado} onChange={e => setNewTariff({...newTariff, porcentaje_alcantarillado: Number(e.target.value)})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Fecha Inicio</label>
                  <input required type="date" value={newTariff.fecha_inicio} onChange={e => setNewTariff({...newTariff, fecha_inicio: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Fecha Fin</label>
                  <input required type="date" value={newTariff.fecha_fin} onChange={e => setNewTariff({...newTariff, fecha_fin: e.target.value})} className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsAddingTariff(false)} className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 shadow-lg shadow-zinc-100">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal isOpen={isConfirming} onClose={() => setIsConfirming(false)} onConfirm={handleDelete} />
    </div>
  );
}
