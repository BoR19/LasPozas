import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type UserCategory, type User, type UserStatus } from '../database/db';
import { syncService } from '../services/syncService';
import { registrarUsuario, generarFacturaReconexion } from '../services/billingService';
import ConfirmModal from '../components/ConfirmModal';
import { 
  Plus, 
  Search, 
  User as UserIcon, 
  MapPin, 
  Hash, 
  Tag, 
  Camera, 
  Edit2, 
  UserX, 
  ChevronRight,
  Play,
  PauseCircle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'activo' | 'suspendido' | 'baja'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isConfirmingBaja, setIsConfirmingBaja] = useState(false);
  const [bajaTarget, setBajaTarget] = useState<string | null>(null);

  const [newUser, setNewUser] = useState<{ 
    name: string; 
    address: string; 
    initialReading: number; 
    category: UserCategory 
  }>({ 
    name: '', 
    address: '', 
    initialReading: 0,
    category: 'Residencial'
  });

  const allUsers = useLiveQuery(() => db.users.toArray(), []);

  // Conteos por estado
  const totalCount = allUsers?.length || 0;
  const activosCount = allUsers?.filter(u => !u.estado || u.estado === 'activo').length || 0;
  const suspendidosCount = allUsers?.filter(u => u.estado === 'suspendido').length || 0;
  const bajasCount = allUsers?.filter(u => u.estado === 'baja').length || 0;

  // Filtrado por búsqueda y estado
  const filteredUsers = allUsers?.filter(user => {
    const status: UserStatus = user.estado || 'activo';

    if (statusFilter === 'activo' && status !== 'activo') return false;
    if (statusFilter === 'suspendido' && status !== 'suspendido') return false;
    if (statusFilter === 'baja' && status !== 'baja') return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchName = user.name.toLowerCase().includes(term);
      const matchMeter = user.meter_id.toLowerCase().includes(term);
      const matchAddress = (user.address || '').toLowerCase().includes(term);
      if (!matchName && !matchMeter && !matchAddress) return false;
    }

    return true;
  });

  // Dar de baja (sin borrar de Firestore)
  const handleConfirmBaja = async () => {
    if (!bajaTarget) return;

    try {
      const userToBaja = await db.users.get(bajaTarget);
      if (userToBaja) {
        const now = Date.now();
        const updatedUser: User = {
          ...userToBaja,
          estado: 'baja',
          motivo_suspension: 'Baja definitiva',
          fecha_suspension: now,
          updated_at: now,
          version: (userToBaja.version || 1) + 1
        };

        await db.users.update(bajaTarget, updatedUser);
        await syncService.addToQueue('user', updatedUser);
      }
    } catch (err) {
      console.error('Error al dar de baja:', err);
      alert('No se pudo procesar la baja');
    } finally {
      setBajaTarget(null);
      setIsConfirmingBaja(false);
    }
  };

  const confirmBaja = (id: string) => {
    setBajaTarget(id);
    setIsConfirmingBaja(true);
  };

  // Reactivar usuario rápidamente a Activo
  const handleQuickReactivate = async (user: User) => {
    try {
      const now = Date.now();
      const updatedUser: User = {
        ...user,
        estado: 'activo',
        fecha_reactivacion: now,
        updated_at: now,
        version: (user.version || 1) + 1
      };

      await db.users.update(user.id, updatedUser);
      await syncService.addToQueue('user', updatedUser);

      // Regla 6: Factura automática tipo reconexión = Cargo Fijo + Reconexión
      await generarFacturaReconexion(updatedUser, now);
    } catch (err) {
      console.error('Error al reactivar:', err);
      alert('Error al reactivar usuario');
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim()) return;

    try {
      const result = await registrarUsuario({
        name: newUser.name,
        address: newUser.address,
        category: newUser.category,
        initialReading: newUser.initialReading
      });

      setIsAdding(false);
      setNewUser({ name: '', address: '', initialReading: 0, category: 'Residencial' });
      navigate(`/users/${result.userId}`);
    } catch (err) {
      console.error('Error al registrar usuario:', err);
      alert('Error al registrar usuario');
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updatedUser = {
      ...editingUser,
      name: editingUser.name.trim(),
      address: editingUser.address.trim(),
      category: editingUser.category,
      meter_id: editingUser.meter_id.trim(),
      updated_at: Date.now(),
      version: (editingUser.version || 1) + 1
    };

    await db.users.update(editingUser.id, updatedUser);
    await syncService.addToQueue('user', updatedUser);

    setIsEditing(false);
    setEditingUser(null);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Clientes</h1>
          <p className="text-zinc-500 font-medium text-sm">Gestión del padrón de usuarios, estados y medidores</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200 text-sm"
          >
            <Plus className="w-5 h-5" />
            Nuevo Usuario
          </button>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="space-y-3">
        {/* Filtros de Estado */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-zinc-100 rounded-2xl w-fit">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              statusFilter === 'all'
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            )}
          >
            Todos ({totalCount})
          </button>

          {/* Filtro específico para ver solo Activos */}
          <button
            onClick={() => setStatusFilter('activo')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              statusFilter === 'activo'
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-zinc-600 hover:text-emerald-700"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Solo Activos ({activosCount})
          </button>

          <button
            onClick={() => setStatusFilter('suspendido')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              statusFilter === 'suspendido'
                ? "bg-white text-amber-700 shadow-sm"
                : "text-zinc-600 hover:text-amber-700"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Suspendidos ({suspendidosCount})
          </button>

          <button
            onClick={() => setStatusFilter('baja')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              statusFilter === 'baja'
                ? "bg-white text-rose-700 shadow-sm"
                : "text-zinc-600 hover:text-rose-700"
            )}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Bajas ({bajasCount})
          </button>
        </div>

        {/* Input de Búsqueda */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text"
            placeholder="Buscar por nombre, dirección o ID de medidor (MET-XXXX)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm text-sm"
          />
        </div>
      </div>

      {/* Listado de Tarjetas de Clientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredUsers && filteredUsers.length > 0 ? (
          filteredUsers.map(user => {
            const status: UserStatus = user.estado || 'activo';
            const isActivo = status === 'activo';
            const isSuspendido = status === 'suspendido';
            const isBaja = status === 'baja';

            return (
              <div 
                key={user.id}
                className={cn(
                  "group bg-white p-5 sm:p-6 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                  isSuspendido ? "border-amber-200 hover:border-amber-400 bg-amber-50/20" :
                  isBaja ? "border-rose-200 hover:border-rose-400 bg-rose-50/20 opacity-90" :
                  "border-zinc-200 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5"
                )}
              >
                <Link to={`/users/${user.id}`} className="flex items-start gap-4 flex-1">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all mt-0.5",
                    isActivo ? "bg-emerald-50 text-emerald-600" :
                    isSuspendido ? "bg-amber-100 text-amber-700" :
                    "bg-rose-100 text-rose-700"
                  )}>
                    <UserIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-zinc-900 group-hover:text-blue-600 transition-colors text-base truncate">
                        {user.name}
                      </h3>

                      {/* ETIQUETAS DE COLOR REQUERIDAS: verde Activo, amarillo Suspendido, rojo Baja */}
                      {isActivo && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/90">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      )}
                      {isSuspendido && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Suspendido
                        </span>
                      )}
                      {isBaja && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          Baja
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-bold font-mono">
                        <Hash className="w-3 h-3 text-zinc-400" /> {user.meter_id}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500 font-medium">
                        <Tag className="w-3 h-3 text-zinc-400" /> {user.category}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-500 font-medium flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-zinc-400 flex-shrink-0" /> {user.address || 'Tolomosita Oeste'}
                    </p>

                    {/* Nota de motivo si está suspendido */}
                    {isSuspendido && user.motivo_suspension && (
                      <p className="text-[11px] text-amber-800 font-semibold bg-amber-100/60 px-2 py-0.5 rounded-md inline-block">
                        Motivo: {user.motivo_suspension}
                      </p>
                    )}
                  </div>
                </Link>
                
                {/* Acciones de Tarjeta */}
                <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100">
                  {isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={() => { setEditingUser(user); setIsEditing(true); }}
                        className="p-2 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all"
                        title="Editar datos del cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {!isBaja && (
                        <button 
                          onClick={() => confirmBaja(user.id)}
                          className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 hover:text-rose-700 transition-all"
                          title="Dar de baja definitiva (sin borrar documento)"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Botón dinámico según estado */}
                  {isActivo && (
                    <button 
                      onClick={() => navigate(`/users/${user.id}`, { state: { startReading: true } })}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Lectura
                    </button>
                  )}

                  {isSuspendido && (
                    <button 
                      onClick={() => handleQuickReactivate(user)}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all active:scale-95 shadow-sm"
                      title="Reactivar servicio del cliente"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Reactivar
                    </button>
                  )}

                  <Link 
                    to={`/users/${user.id}`}
                    className="p-2 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-zinc-100 transition-all"
                    title="Ver ficha completa"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white rounded-3xl border border-zinc-200 p-12 text-center space-y-3">
            <UserIcon className="w-10 h-10 mx-auto text-zinc-300" />
            <p className="text-zinc-500 font-bold text-sm">
              No se encontraron usuarios {statusFilter !== 'all' ? `con estado "${statusFilter}"` : ''}.
            </p>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
              >
                Ver todos los usuarios
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Registrar Usuario */}
      {isAdding && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Registrar Usuario</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nombre Completo</label>
                <input 
                  required
                  type="text"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Dirección / Zona</label>
                <input 
                  required
                  type="text"
                  value={newUser.address}
                  onChange={e => setNewUser({...newUser, address: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Categoría</label>
                  <select 
                    value={newUser.category}
                    onChange={e => setNewUser({...newUser, category: e.target.value as UserCategory})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm font-medium"
                  >
                    <option value="Residencial">Residencial</option>
                    <option value="Residencial Social">Residencial Social</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Lectura Inicial (m³)</label>
                  <input 
                    required
                    type="number"
                    value={newUser.initialReading}
                    onChange={e => setNewUser({...newUser, initialReading: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm font-bold font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 text-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Usuario */}
      {isEditing && editingUser && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Editar Usuario</h2>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nombre Completo</label>
                <input 
                  required
                  type="text"
                  value={editingUser.name}
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Dirección</label>
                <input 
                  required
                  type="text"
                  value={editingUser.address}
                  onChange={e => setEditingUser({...editingUser, address: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Categoría</label>
                  <select 
                    value={editingUser.category}
                    onChange={e => setEditingUser({...editingUser, category: e.target.value as UserCategory})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm font-medium"
                  >
                    <option value="Residencial">Residencial</option>
                    <option value="Residencial Social">Residencial Social</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">ID Medidor</label>
                  <input 
                    required
                    type="text"
                    value={editingUser.meter_id}
                    onChange={e => setEditingUser({...editingUser, meter_id: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all text-sm font-mono font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => { setIsEditing(false); setEditingUser(null); }}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all text-sm"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 text-sm"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmación de Baja Definitiva (sin borrar documento) */}
      <ConfirmModal 
        isOpen={isConfirmingBaja} 
        onClose={() => setIsConfirmingBaja(false)} 
        onConfirm={handleConfirmBaja}
        title="Dar de Baja Definitiva"
        message="¿Confirmas dar de baja definitiva a este cliente? El documento en Firestore y todos sus registros históricos se mantendrán guardados permanentemente (no se borrarán)."
        confirmText="Confirmar Baja"
      />
    </div>
  );
}
