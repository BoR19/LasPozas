import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Reading } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { getActiveTariff, calculateBill } from '../services/billingService';
import { formatDate, formatCurrency } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import { ArrowLeft, Camera, Plus, History, Receipt as ReceiptIcon, Trash2, CheckCircle2, Clock, AlertCircle, Tag, RefreshCw } from 'lucide-react';
import CameraOCR from '../components/CameraOCR';
import Receipt from '../components/Receipt/Receipt';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleDelete = async () => {
    if (!isAdmin || !id) return;
    try {
      await db.readings.where('user_id').equals(id).delete();
      await db.users.delete(id);
      navigate('/users');
    } catch (err) {
      console.error('Error al eliminar:', err);
      alert('No se pudo eliminar');
    } finally {
      setIsConfirming(false);
    }
  };
  const [showCamera, setShowCamera] = useState(false);
  const [lecturaActual, setLecturaActual] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (location.state?.startReading) {
      setIsReading(true);
      // Clear state so it doesn't reopen on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const user = useLiveQuery(() => id ? db.users.get(id) : undefined, [id]);
  const readings = useLiveQuery(
    () => id ? db.readings.where('user_id').equals(id).reverse().sortBy('date') : [],
    [id]
  );
  const latestReading = readings?.[0];

  const handleSaveReading = async () => {
    if (!user || !lecturaActual || isSaving) return;
    
    setIsSaving(true);
    setSaveError(null);

    try {
      const current = Number(lecturaActual);
      if (isNaN(current)) {
        throw new Error('La lectura debe ser un número válido.');
      }

      if (current < (latestReading?.current_reading || 0)) {
        throw new Error('La lectura actual no puede ser menor a la anterior.');
      }

      const consumption = current - (latestReading?.current_reading || 0);
      const tariff = await getActiveTariff(user.category);
      
      if (!tariff) {
        throw new Error(`No hay una tarifa activa configurada para la categoría ${user.category}.`);
      }

      const esPrimeraLectura = !latestReading || latestReading.current_reading === 0;
      const bill = calculateBill(consumption, tariff, esPrimeraLectura);

      await db.readings.add({
        user_id: user.id,
        previous_reading: latestReading?.current_reading || 0,
        current_reading: current,
        consumption,
        date: Date.now(),
        status: 'pending',
        bill_details: bill,
        imagen: capturedImage || undefined,
        uuid: uuidv4(),
        updated_at: Date.now(),
        version: 1
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setIsReading(false);
        setLecturaActual('');
        setSaveSuccess(false);
        setIsSaving(false);
      }, 1500);
    } catch (err) {
      console.error('Error saving reading:', err);
      setSaveError(err instanceof Error ? err.message : 'Error al guardar la lectura');
      setIsSaving(false);
    }
  };

  const markAsPaid = async (readingId: number) => {
    await db.readings.update(readingId, { status: 'paid' });
  };

  const deleteUser = async () => {
    if (!isAdmin || !id) return;
    if (confirm('¿Está seguro de eliminar este usuario y todo su historial?')) {
      await db.readings.where('user_id').equals(id).delete();
      await db.users.delete(id);
      navigate('/users');
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-zinc-500 font-bold hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        {isAdmin && (
          <button 
            onClick={() => setIsConfirming(true)}
            className="flex items-center gap-2 text-red-500 font-bold hover:text-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Eliminar Usuario
          </button>
        )}
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl border border-zinc-200 shadow-sm flex flex-col md:flex-row justify-between gap-6 md:gap-8">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">{user.name}</h1>
            <p className="text-zinc-500 font-medium">{user.address}</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="px-4 py-2 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">ID Medidor</p>
              <p className="font-bold text-zinc-900">{user.meter_id}</p>
            </div>
            <div className="px-4 py-2 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Categoría</p>
              <p className="font-bold text-zinc-900 flex items-center gap-1">
                <Tag className="w-3 h-3" /> {user.category}
              </p>
            </div>
            <div className="px-4 py-2 bg-zinc-50 rounded-xl border border-zinc-100">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Última Lectura</p>
              <p className="font-bold text-zinc-900">{latestReading?.current_reading || 0} m³</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <button 
            onClick={() => setIsReading(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-200"
          >
            <Plus className="w-5 h-5" />
            Nueva Lectura
          </button>
        </div>
      </div>

      {isReading && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Registrar Lectura</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Lectura Anterior</p>
                  <p className="text-xl font-black text-zinc-900">{latestReading?.current_reading || 0} m³</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Fecha</p>
                  <p className="font-bold text-zinc-700">{formatDate(latestReading?.date || Date.now())}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Lectura Actual (m³)</label>
                <div className="flex gap-2 items-stretch">
                  <input 
                    type="number"
                    value={lecturaActual}
                    onChange={e => setLecturaActual(e.target.value)}
                    placeholder="00000"
                    disabled={isSaving || saveSuccess}
                    className="flex-1 min-w-0 px-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xl sm:text-2xl font-black focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
                  />
                  <button 
                    onClick={() => setShowCamera(true)}
                    disabled={isSaving || saveSuccess}
                    className="px-4 sm:px-6 bg-zinc-900 text-white rounded-2xl hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-200 flex items-center justify-center disabled:opacity-50"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {saveError && (
                <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 animate-shake">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="font-bold text-sm">{saveError}</p>
                </div>
              )}

              {saveSuccess && (
                <div className="flex items-center gap-3 p-4 bg-green-50 text-green-600 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <p className="font-bold text-sm">Lectura guardada correctamente</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsReading(false)}
                  disabled={isSaving || saveSuccess}
                  className="flex-1 py-4 font-bold text-zinc-500 hover:bg-zinc-100 rounded-2xl transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveReading}
                  disabled={!lecturaActual || isSaving || saveSuccess}
                  className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Guardando...
                    </>
                  ) : saveSuccess ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Guardado
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <CameraOCR 
          onResult={(val, image) => {
            console.log("OCR Result received in UserDetail:", val);
            setLecturaActual(val);
            setCapturedImage(image);
            setShowCamera(false);
          }}
          onClose={() => setShowCamera(false)}
          recentImage={capturedImage}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-zinc-400" />
          <h2 className="text-xl font-black text-zinc-900 tracking-tight">Historial de Lecturas</h2>
        </div>

        <div className="space-y-4">
          {readings?.map(reading => (
            <div 
              key={reading.id}
              className="bg-white p-6 rounded-3xl border border-zinc-200 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-lg transition-all"
            >
              <div className="flex items-center gap-6">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  reading.status === 'paid' ? "bg-green-50 text-green-600" : "bg-orange-50 text-orange-600"
                )}>
                  {reading.status === 'paid' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-sm font-black text-zinc-900">{formatDate(reading.date)}</p>
                  <p className="text-xs text-zinc-500 font-medium">Consumo: {reading.consumption} m³ ({reading.previous_reading} → {reading.current_reading})</p>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                <div className="text-right">
                  <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Total</p>
                  <p className="text-lg font-black text-zinc-900">{formatCurrency(reading.bill_details?.total || 0)}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      console.log("Receipt button clicked for reading ID:", reading.id);
                      navigate(`/recibo/${reading.id}`);
                    }}
                    className="p-3 bg-zinc-50 text-zinc-600 rounded-xl hover:bg-zinc-100 transition-all"
                    title="Ver Recibo"
                  >
                    <ReceiptIcon className="w-5 h-5" />
                  </button>
                  {reading.status !== 'paid' && (
                    <button 
                      onClick={() => markAsPaid(reading.id!)}
                      className="px-4 py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                    >
                      Pagar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal isOpen={isConfirming} onClose={() => setIsConfirming(false)} onConfirm={handleDelete} />
    </div>
  );
}
