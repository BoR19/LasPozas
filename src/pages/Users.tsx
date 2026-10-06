import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type UserCategory } from '../database/db';
import { generateId } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Search, User as UserIcon, MapPin, Hash, ArrowRight, ChevronRight, Tag, Camera, Edit2, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await db.users.delete(deleteTarget);
      // UI refresh is handled by useLiveQuery
    } catch (err) {
      console.error('Error al eliminar:', err);
      alert('No se pudo eliminar');
    } finally {
      setDeleteTarget(null);
      setIsConfirming(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteTarget(id);
    setIsConfirming(true);
  };

  const [newUser, setNewUser] = useState<{ name: string; address: string; initialReading: number; category: UserCategory }>({ 
    name: '', 
    address: '', 
    initialReading: 0,
    category: 'Residencial'
  });

  const users = useLiveQuery(
    () => db.users
      .filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.meter_id.includes(searchTerm))
      .toArray(),
    [searchTerm]
  );

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = generateId('USR-');
    const meterId = generateId('MET-');
    
    await db.users.add({
      id: userId,
      name: newUser.name,
      address: newUser.address,
      meter_id: meterId,
      category: newUser.category,
      createdAt: Date.now(),
      uuid: uuidv4(),
      updated_at: Date.now(),
      version: 1
    });

    // Initial reading entry
    await db.readings.add({
      user_id: userId,
      previous_reading: 0,
      current_reading: newUser.initialReading,
      consumption: 0,
      date: Date.now(),
      status: 'paid',
      uuid: uuidv4(),
      updated_at: Date.now(),
      version: 1
    });

    setIsAdding(false);
    setNewUser({ name: '', address: '', initialReading: 0, category: 'Residencial' });
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    await db.users.update(editingUser.id, {
      name: editingUser.name,
      address: editingUser.address,
      category: editingUser.category,
      meter_id: editingUser.meter_id
    });

    setIsEditing(false);
    setEditingUser(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Usuarios</h1>
          <p className="text-zinc-500 font-medium">Gestión de clientes y medidores</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-200"
          >
            <Plus className="w-5 h-5" />
            Nuevo Usuario
          </button>
        )}
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
        <input 
          type="text"
          placeholder="Buscar por nombre o ID de medidor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
        />
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Registrar Usuario</h2>
            <form onSubmit={handleAddUser} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nombre Completo</label>
                <input 
                  required
                  type="text"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Dirección</label>
                <input 
                  required
                  type="text"
                  value={newUser.address}
                  onChange={e => setNewUser({...newUser, address: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Categoría</label>
                  <select 
                    value={newUser.category}
                    onChange={e => setNewUser({...newUser, category: e.target.value as UserCategory})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="Residencial">Residencial</option>
                    <option value="Residencial Social">Residencial Social</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Lectura Inicial (m³)</label>
                  <input 
                    required
                    type="number"
                    value={newUser.initialReading}
                    onChange={e => setNewUser({...newUser, initialReading: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditing && editingUser && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Editar Usuario</h2>
            <form onSubmit={handleEditUser} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Nombre Completo</label>
                <input 
                  required
                  type="text"
                  value={editingUser.name}
                  onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Dirección</label>
                <input 
                  required
                  type="text"
                  value={editingUser.address}
                  onChange={e => setEditingUser({...editingUser, address: e.target.value})}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Categoría</label>
                  <select 
                    value={editingUser.category}
                    onChange={e => setEditingUser({...editingUser, category: e.target.value as UserCategory})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="Residencial">Residencial</option>
                    <option value="Residencial Social">Residencial Social</option>
                    <option value="Comercial">Comercial</option>
                    <option value="Industrial">Industrial</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">ID Medidor</label>
                  <input 
                    required
                    type="text"
                    value={editingUser.meter_id}
                    onChange={e => setEditingUser({...editingUser, meter_id: e.target.value})}
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => { setIsEditing(false); setEditingUser(null); }}
                  className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users?.map(user => (
          <div 
            key={user.id}
            className="group bg-white p-6 rounded-3xl border border-zinc-200 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <Link to={`/users/${user.id}`} className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">{user.name}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                    <Hash className="w-3 h-3" /> {user.meter_id}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-black uppercase tracking-widest">
                    <Tag className="w-3 h-3" /> {user.category}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 font-medium mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {user.address}
                </p>
              </div>
            </Link>
            
            <div className="flex items-center gap-2">
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setEditingUser(user); setIsEditing(true); }}
                    className="p-2.5 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => confirmDelete(user.id!)}
                    className="p-2.5 bg-red-50 text-red-400 rounded-xl hover:bg-red-100 hover:text-red-600 transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
              <button 
                onClick={() => navigate(`/users/${user.id}`, { state: { startReading: true } })}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all active:scale-95"
              >
                <Camera className="w-4 h-4" />
                Lectura
              </button>
              <Link 
                to={`/users/${user.id}`}
                className="p-2.5 bg-zinc-50 text-zinc-400 rounded-xl hover:bg-zinc-100 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
      <ConfirmModal isOpen={isConfirming} onClose={() => setIsConfirming(false)} onConfirm={handleDelete} />
    </div>
  );
}
