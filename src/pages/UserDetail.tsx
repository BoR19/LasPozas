import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Reading, type Invoice, type User, type UserStatus } from '../database/db';
import { syncService } from '../services/syncService';
import { v4 as uuidv4 } from 'uuid';
import { getActiveTariff, calculateBill, generarFacturaReconexion } from '../services/billingService';
import { formatDate, formatCurrency, generateId } from '../lib/utils';
import { 
  ArrowLeft, 
  Camera, 
  Plus, 
  History, 
  Receipt as ReceiptIcon, 
  Trash2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Tag, 
  RefreshCw, 
  DollarSign,
  MoreVertical,
  PauseCircle,
  Play,
  UserX,
  AlertTriangle,
  X,
  Check,
  RotateCcw
} from 'lucide-react';
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

  // Estados de suspensión y baja temporal
  const [showMenu, setShowMenu] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showBajaModal, setShowBajaModal] = useState(false);
  const [motivoSuspension, setMotivoSuspension] = useState<'Viaje' | 'Mora' | 'Solicitud cliente' | 'Fuga' | 'Otro'>('Viaje');
  const [otroDetalle, setOtroDetalle] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [showCamera, setShowCamera] = useState(false);
  const [lecturaActual, setLecturaActual] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<Blob | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (location.state?.startReading) {
      setIsReading(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const user = useLiveQuery(() => id ? db.users.get(id) : undefined, [id]);
  const readings = useLiveQuery(
    () => id ? db.readings.where('user_id').equals(id).reverse().sortBy('date') : [],
    [id]
  );
  const latestReading = readings?.[0];

  const userStatus: UserStatus = user?.estado || 'activo';
  const isSuspended = userStatus === 'suspendido';
  const isBaja = userStatus === 'baja';
  const isActivo = userStatus === 'activo';

  // Suspender temporalmente (con motivo y fecha)
  const handleSuspender = async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const finalMotivo = motivoSuspension === 'Otro' && otroDetalle.trim()
        ? `Otro: ${otroDetalle.trim()}`
        : motivoSuspension;

      const now = Date.now();
      const updatedUser: User = {
        ...user,
        estado: 'suspendido',
        motivo_suspension: finalMotivo,
        fecha_suspension: now,
        updated_at: now,
        version: (user.version || 1) + 1
      };

      await db.users.update(user.id, updatedUser);
      await syncService.addToQueue('user', updatedUser);

      setShowSuspendModal(false);
      setActionNotice({ type: 'success', text: `Servicio suspendido temporalmente por motivo: ${finalMotivo}` });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error('Error al suspender servicio:', err);
      setActionNotice({ type: 'error', text: 'No se pudo suspender el servicio' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Reactivar servicio a Activo
  const handleReactivar = async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const now = Date.now();
      const updatedUser: User = {
        ...user,
        estado: 'activo',
        fecha_reactivacion: now,
        updated_at: now,
        version: (user.version || 1) + 1
      };

      // 1. Guardar y encolar usuario reactivado
      await db.users.update(user.id, updatedUser);
      await syncService.addToQueue('user', updatedUser);

      // 2. Regla 6: Generar factura automática de tipo reconexión = Cargo Fijo + Reconexión
      const reconResult = await generarFacturaReconexion(updatedUser, now);

      setActionNotice({ 
        type: 'success', 
        text: `¡Servicio reactivado! Se generó factura de reconexión por ${formatCurrency(reconResult.total)} (Cargo Fijo + 50% Reconexión).` 
      });
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      console.error('Error al reactivar servicio:', err);
      setActionNotice({ type: 'error', text: 'No se pudo reactivar el servicio' });
    } finally {
      setIsActionLoading(false);
    }
  };

  // Dar de baja definitiva (NUNCA borrar documento de Firestore)
  const handleDarDeBaja = async () => {
    if (!user || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const now = Date.now();
      const updatedUser: User = {
        ...user,
        estado: 'baja',
        motivo_suspension: 'Baja definitiva',
        fecha_suspension: now,
        updated_at: now,
        version: (user.version || 1) + 1
      };

      await db.users.update(user.id, updatedUser);
      await syncService.addToQueue('user', updatedUser);

      setShowBajaModal(false);
      setActionNotice({ type: 'info', text: 'Cliente dado de baja definitiva. Documento e historial conservados.' });
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err) {
      console.error('Error al dar de baja:', err);
      setActionNotice({ type: 'error', text: 'No se pudo dar de baja el servicio' });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveReading = async () => {
    if (!user || !lecturaActual || isSaving) return;
    
    // Filtro de facturación: No generar facturas ni lecturas para no activos
    if (user.estado && user.estado !== 'activo') {
      setSaveError(`El usuario está ${user.estado}. Debe reactivar el servicio para registrar lecturas.`);
      return;
    }

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
      
      const hasPriorReadings = (readings && readings.length > 0) || (latestReading !== undefined);
      const esPrimeraLectura = !hasPriorReadings;
      const bill = calculateBill(consumption, tariff, esPrimeraLectura, false);

      const facturaId = generateId('FAC-');
      const facturaUuid = uuidv4();
      const readingUuid = uuidv4();
      const now = Date.now();

      const readingData: Reading = {
        user_id: user.id,
        medidor_id: user.meter_id,
        factura_id: facturaId,
        previous_reading: latestReading?.current_reading || 0,
        current_reading: current,
        consumption,
        date: now,
        status: 'pending' as const,
        detalle: bill.detalle,
        bill_details: bill,
        imagen: capturedImage || undefined,
        uuid: readingUuid,
        updated_at: now,
        version: 1
      };

      const readingId = (await db.readings.add(readingData)) as number;

      const facturaDoc: Invoice = {
        factura_id: facturaId,
        total: bill.total,
        consumo: consumption,
        estado: 'pendiente',
        usuario_id: user.id,
        user_id: user.id,
        medidor_id: user.meter_id,
        lectura_id: readingId,
        fecha: now,
        date: now,
        nombre: user.name,
        zona: user.address,
        categoria: user.category,
        lectura_anterior: latestReading?.current_reading || 0,
        lectura_actual: current,
        es_primera_factura: esPrimeraLectura,
        detalle: bill.detalle,
        bill_details: bill,
        uuid: facturaUuid,
        updated_at: now,
        version: 1
      };
      const createdFacId = (await db.facturas.add(facturaDoc)) as number;

      await syncService.addToQueue('reading', { ...readingData, id: readingId });
      await syncService.addToQueue('factura', { ...facturaDoc, id: createdFacId });

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
    await db.readings.update(readingId, { status: 'paid', updated_at: Date.now() });
    const updated = await db.readings.get(readingId);
    if (updated) {
      await syncService.addToQueue('reading', updated);
    }
    const relatedFactura = await db.facturas.where('lectura_id').equals(readingId).first();
    if (relatedFactura && relatedFactura.id) {
      await db.facturas.update(relatedFactura.id, { estado: 'pagado', updated_at: Date.now() });
      const updatedFact = await db.facturas.get(relatedFactura.id);
      if (updatedFact) {
        await syncService.addToQueue('factura', updatedFact);
      }
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 pb-20">
      {/* Barra superior de navegación */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-zinc-500 font-bold hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Clientes
        </button>

        {/* Estado badge en cabecera */}
        <div className="flex items-center gap-2">
          {isActivo && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Activo
            </span>
          )}
          {isSuspended && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Suspendido
            </span>
          )}
          {isBaja && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 border border-rose-300 rounded-full text-xs font-black uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Baja Definitiva
            </span>
          )}
        </div>
      </div>

      {/* Banner de notificación si hay acción */}
      {actionNotice && (
        <div className={cn(
          "p-4 rounded-2xl flex items-center justify-between animate-in fade-in slide-in-from-top-2 border shadow-sm text-sm font-bold",
          actionNotice.type === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
          actionNotice.type === 'info' ? "bg-zinc-100 text-zinc-800 border-zinc-200" :
          "bg-rose-50 text-rose-800 border-rose-200"
        )}>
          <div className="flex items-center gap-2">
            {actionNotice.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-zinc-600" />}
            <span>{actionNotice.text}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tarjeta Principal del Cliente */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-black text-zinc-900 tracking-tight">{user.name}</h1>
              {isActivo && (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold">
                  🟢 Activo
                </span>
              )}
              {isSuspended && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-xs font-bold">
                  🟡 Suspendido
                </span>
              )}
              {isBaja && (
                <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 rounded-md text-xs font-bold">
                  🔴 Baja
                </span>
              )}
            </div>
            <p className="text-zinc-500 font-medium text-sm">{user.address}</p>

            <div className="flex flex-wrap gap-3 pt-1">
              <div className="px-3.5 py-1.5 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">ID Medidor</p>
                <p className="font-black font-mono text-zinc-900 text-sm">{user.meter_id}</p>
              </div>
              <div className="px-3.5 py-1.5 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Categoría</p>
                <p className="font-bold text-zinc-900 flex items-center gap-1 text-sm">
                  <Tag className="w-3 h-3 text-zinc-400" /> {user.category}
                </p>
              </div>
              <div className="px-3.5 py-1.5 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Última Lectura</p>
                <p className="font-bold font-mono text-zinc-900 text-sm">{latestReading?.current_reading || 0} m³</p>
              </div>
            </div>
          </div>

          {/* Botones de acción principales + Menú de 3 puntos */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {isSuspended ? (
              <button 
                onClick={handleReactivar}
                disabled={isActionLoading}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-xl shadow-emerald-200 text-sm sm:text-base disabled:opacity-50"
              >
                <Play className="w-5 h-5 fill-current" />
                Reactivar Servicio
              </button>
            ) : isBaja ? (
              <button 
                onClick={handleReactivar}
                disabled={isActionLoading}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-zinc-900 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all active:scale-95 shadow-xl text-sm sm:text-base disabled:opacity-50"
              >
                <RotateCcw className="w-5 h-5" />
                Reactivar Servicio
              </button>
            ) : (
              <button 
                onClick={() => setIsReading(true)}
                className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-blue-600 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-200 text-sm sm:text-base"
              >
                <Plus className="w-5 h-5" />
                Nueva Lectura
              </button>
            )}

            {/* Botón de 3 puntos ... con desplegable */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setShowMenu(prev => !prev)}
                className="p-3.5 md:p-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-2xl transition-all active:scale-95 border border-zinc-200/80 shadow-sm flex items-center justify-center"
                title="Opciones de servicio"
                aria-label="Opciones del cliente"
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-zinc-100 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-zinc-100 mb-1">
                    <p className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Gestión de Servicio</p>
                    <p className="text-xs font-bold text-zinc-700 truncate">{user.name}</p>
                  </div>

                  {!isSuspended && !isBaja && (
                    <button
                      onClick={() => { setShowMenu(false); setShowSuspendModal(true); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs sm:text-sm font-bold text-amber-800 hover:bg-amber-50 rounded-xl transition-colors"
                    >
                      <PauseCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Suspender Temporalmente
                    </button>
                  )}

                  {(isSuspended || isBaja) && (
                    <button
                      onClick={() => { setShowMenu(false); handleReactivar(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs sm:text-sm font-bold text-emerald-800 hover:bg-emerald-50 rounded-xl transition-colors"
                    >
                      <Play className="w-4 h-4 text-emerald-600 flex-shrink-0 fill-current" />
                      Reactivar Servicio
                    </button>
                  )}

                  {!isBaja && (
                    <button
                      onClick={() => { setShowMenu(false); setShowBajaModal(true); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs sm:text-sm font-bold text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <UserX className="w-4 h-4 text-rose-500 flex-shrink-0" />
                      Dar de Baja Definitiva
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notificaciones contextuales de suspensión / baja */}
        {isSuspended && (
          <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
            <div className="flex items-start sm:items-center gap-3">
              <PauseCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="text-sm font-black">Servicio Suspendido Temporalmente</p>
                <p className="text-xs text-amber-800/90">
                  Motivo: <span className="font-bold">{user.motivo_suspension || 'No registrado'}</span> • Fecha: <span className="font-bold">{formatDate(user.fecha_suspension || Date.now())}</span>
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Las lecturas y facturas automáticas no se generarán mientras el servicio esté suspendido.
                </p>
              </div>
            </div>
            <button
              onClick={handleReactivar}
              disabled={isActionLoading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap self-end sm:self-center"
            >
              Reactivar Ahora
            </button>
          </div>
        )}

        {isBaja && (
          <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-900">
            <div className="flex items-start sm:items-center gap-3">
              <UserX className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5 sm:mt-0" />
              <div>
                <p className="text-sm font-black">Cliente en Estado de Baja Definitiva</p>
                <p className="text-xs text-rose-800/90">
                  Fecha de baja: <span className="font-bold">{formatDate(user.fecha_suspension || Date.now())}</span>
                </p>
                <p className="text-[11px] text-rose-700 mt-0.5">
                  Los registros de medidor y lecturas anteriores se conservan permanentemente en el sistema.
                </p>
              </div>
            </div>
            <button
              onClick={handleReactivar}
              disabled={isActionLoading}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap self-end sm:self-center"
            >
              Restablecer Cuenta
            </button>
          </div>
        )}
      </div>

      {/* Modal de Suspender Temporalmente */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center flex-shrink-0">
                <PauseCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900">Suspender Servicio</h3>
                <p className="text-xs text-zinc-500 font-medium">Desactivación temporal antes de la baja</p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed bg-zinc-50 p-3.5 rounded-2xl border border-zinc-100">
              El servicio para <span className="font-bold text-zinc-900">{user.name}</span> quedará en pausa. No se le generarán lecturas ni facturas automáticas mientras permanezca suspendido.
            </p>

            <div className="space-y-3">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block">
                Seleccione el Motivo de Suspensión
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['Viaje', 'Mora', 'Solicitud cliente', 'Fuga', 'Otro'] as const).map((motivo) => {
                  const isSelected = motivoSuspension === motivo;
                  return (
                    <button
                      key={motivo}
                      type="button"
                      onClick={() => setMotivoSuspension(motivo)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all text-left",
                        isSelected 
                          ? "bg-amber-500 text-white border-amber-600 shadow-md shadow-amber-200" 
                          : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"
                      )}
                    >
                      <span>{motivo}</span>
                      {isSelected && <Check className="w-4 h-4 ml-1 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {motivoSuspension === 'Otro' && (
                <div className="pt-2 space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Especificar Detalle
                  </label>
                  <input
                    type="text"
                    value={otroDetalle}
                    onChange={(e) => setOtroDetalle(e.target.value)}
                    placeholder="Ej. Construcción en predio..."
                    className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-100">
              <span>Fecha de suspensión:</span>
              <span className="font-bold text-zinc-900">{formatDate(Date.now())}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSuspendModal(false)}
                disabled={isActionLoading}
                className="flex-1 py-3 text-zinc-600 font-bold hover:bg-zinc-100 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSuspender}
                disabled={isActionLoading}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-200 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
                Confirmar Suspensión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Dar de Baja Definitiva */}
      {showBajaModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-2xl flex items-center justify-center flex-shrink-0">
                <UserX className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-zinc-900">Dar de Baja Definitiva</h3>
                <p className="text-xs text-zinc-500 font-medium">Baja del registro del servicio de agua</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2 text-xs text-rose-900">
              <p className="font-black">Importante sobre la baja:</p>
              <p className="leading-relaxed">
                El cliente <span className="font-bold">{user.name}</span> (Medidor: <span className="font-bold font-mono">{user.meter_id}</span>) pasará al estado de <span className="font-bold">Baja Definitiva</span>.
              </p>
              <p className="text-rose-700 font-medium">
                🔒 De acuerdo con las políticas del sistema, <span className="font-bold">NUNCA se borra el documento de Firestore</span>; se mantendrá archivado con todo su historial de lecturas y facturas.
              </p>
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-100">
              <span>Fecha efectiva de baja:</span>
              <span className="font-bold text-zinc-900">{formatDate(Date.now())}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBajaModal(false)}
                disabled={isActionLoading}
                className="flex-1 py-3 text-zinc-600 font-bold hover:bg-zinc-100 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDarDeBaja}
                disabled={isActionLoading}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-rose-200 text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isActionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                Confirmar Baja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Registrar Lectura */}
      {isReading && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-2xl font-black text-zinc-900 mb-6">Registrar Lectura</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Lectura Anterior</p>
                  <p className="text-xl font-black text-zinc-900 font-mono">{latestReading?.current_reading || 0} m³</p>
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
                    className="flex-1 min-w-0 px-4 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xl sm:text-2xl font-black focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50 font-mono"
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

      {/* Historial de Lecturas */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-zinc-400" />
          <h2 className="text-xl font-black text-zinc-900 tracking-tight">Historial de Lecturas</h2>
        </div>

        <div className="space-y-4">
          {readings && readings.length > 0 ? (
            readings.map(reading => (
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
                    <p className="text-xs text-zinc-500 font-medium font-mono">Consumo: {reading.consumption} m³ ({reading.previous_reading} → {reading.current_reading})</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="text-right">
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Total</p>
                    <p className="text-lg font-black text-zinc-900 font-mono">{formatCurrency(reading.bill_details?.total || 0)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const targetFacturaId = reading.factura_id || reading.id;
                        console.log("Imprimir recibo/factura clickeado para ID:", targetFacturaId);
                        navigate(`/recibo/${targetFacturaId}`);
                      }}
                      className="p-3 bg-zinc-50 text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all border border-zinc-200/80 shadow-sm flex items-center gap-1.5 active:scale-95"
                      title="Imprimir Factura / Ver Recibo"
                    >
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                      <ReceiptIcon className="w-4 h-4 text-zinc-400" />
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
            ))
          ) : (
            <div className="bg-white p-12 rounded-3xl border border-zinc-200 text-center text-zinc-400 font-medium">
              Sin lecturas registradas para este usuario.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
