import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type PaymentConfig, getPaymentConfig } from '../database/db';
import { syncService } from '../services/syncService';
import { 
  ArrowLeft, 
  Upload, 
  QrCode, 
  CheckCircle2, 
  Trash2, 
  Building2, 
  UserCheck, 
  Save, 
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function ConfiguracionPagos() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const currentConfig = useLiveQuery(async () => {
    return await getPaymentConfig();
  }, []);

  const [formData, setFormData] = useState<PaymentConfig>({
    id: 'pagos',
    qr_fie_url: '',
    qr_altoke_url: '',
    titular: 'Comité de Agua Potable Tolomosita Oeste',
    banco: 'Banco FIE S.A. / Altoke',
    cuenta: '',
    uuid: 'config-pagos-tolomosita-oeste',
    updated_at: Date.now(),
    version: 1
  });

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentConfig) {
      setFormData(currentConfig);
    }
  }, [currentConfig]);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>, 
    target: 'qr_fie_url' | 'qr_altoke_url'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor selecciona un archivo de imagen válido (PNG, JPG, SVG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('La imagen no debe superar los 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormData(prev => ({
        ...prev,
        [target]: result
      }));
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (target: 'qr_fie_url' | 'qr_altoke_url') => {
    setFormData(prev => ({
      ...prev,
      [target]: ''
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    try {
      const now = Date.now();
      const updatedConfig: PaymentConfig = {
        ...formData,
        id: 'pagos',
        updated_at: now,
        version: (formData.version || 1) + 1
      };

      await db.configuracion.put(updatedConfig);
      await syncService.addToQueue('configuracion', updatedConfig);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error al guardar configuración de pagos:', err);
      setErrorMsg(err?.message || 'Error al guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-2 text-zinc-500 font-bold hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" /> Volver a Administración
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
          <QrCode className="w-8 h-8 text-blue-600" />
          Configuración de Métodos de Pago
        </h1>
        <p className="text-zinc-500 font-medium text-sm mt-1">
          Configura los códigos QR estáticos oficiales (Banco FIE y Altoke) y los datos del titular para cobro en comprobantes y tickets térmicos.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-bold animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ¡Configuración guardada correctamente y sincronizada con el sistema!
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-sm font-bold">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Datos Bancarios y Titular */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-zinc-200 shadow-sm space-y-6">
          <h2 className="text-lg font-black text-zinc-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-zinc-500" />
            Datos de la Cuenta y Titular
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                Nombre del Titular / Beneficiario
              </label>
              <div className="relative">
                <UserCheck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={formData.titular}
                  onChange={(e) => setFormData({ ...formData, titular: e.target.value })}
                  placeholder="Ej: Comité de Agua Potable Tolomosita Oeste"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-semibold text-zinc-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                Entidad Financiera / Banco
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={formData.banco}
                  onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                  placeholder="Ej: Banco FIE S.A. / Altoke"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-semibold text-zinc-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                Número de Cuenta o Referencia Adicional (Opcional)
              </label>
              <div className="relative">
                <CreditCard className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={formData.cuenta || ''}
                  onChange={(e) => setFormData({ ...formData, cuenta: e.target.value })}
                  placeholder="Ej: Cta. Ahorros N° 40-00123456"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-semibold text-zinc-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Carga de Imágenes de Códigos QR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QR 1: Banco FIE */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200 shadow-sm flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-black uppercase tracking-wider">
                  Opción 1
                </span>
                <span className="text-xs font-bold text-zinc-400">Banco FIE</span>
              </div>
              <h3 className="text-lg font-black text-zinc-900">QR Banco FIE</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Sube la imagen del código QR estático de cobranza de Banco FIE.
              </p>
            </div>

            {/* Vista previa o contenedor de subida */}
            <div className="flex flex-col items-center justify-center p-4 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 min-h-[220px]">
              {formData.qr_fie_url ? (
                <div className="flex flex-col items-center space-y-3">
                  <img
                    src={formData.qr_fie_url}
                    alt="QR Banco FIE"
                    className="w-44 h-44 object-contain bg-white p-2 rounded-xl border border-zinc-200 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage('qr_fie_url')}
                    className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Quitar imagen
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-zinc-700">Sin imagen subida</p>
                  <p className="text-[11px] text-zinc-400">Se generará un QR automático como respaldo</p>
                </div>
              )}
            </div>

            <div>
              <label className="block w-full text-center cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all shadow-md active:scale-[0.98]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'qr_fie_url')}
                  className="hidden"
                />
                {formData.qr_fie_url ? 'Cambiar Imagen QR FIE' : 'Subir Imagen QR FIE'}
              </label>
            </div>
          </div>

          {/* QR 2: Altoke */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-zinc-200 shadow-sm flex flex-col justify-between space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-black uppercase tracking-wider">
                  Opción 2
                </span>
                <span className="text-xs font-bold text-zinc-400">Billetera Altoke</span>
              </div>
              <h3 className="text-lg font-black text-zinc-900">QR Altoke</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Sube la imagen del código QR estático de billetera móvil Altoke.
              </p>
            </div>

            {/* Vista previa o contenedor de subida */}
            <div className="flex flex-col items-center justify-center p-4 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200 min-h-[220px]">
              {formData.qr_altoke_url ? (
                <div className="flex flex-col items-center space-y-3">
                  <img
                    src={formData.qr_altoke_url}
                    alt="QR Altoke"
                    className="w-44 h-44 object-contain bg-white p-2 rounded-xl border border-zinc-200 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage('qr_altoke_url')}
                    className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-bold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Quitar imagen
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-zinc-700">Sin imagen subida</p>
                  <p className="text-[11px] text-zinc-400">Se generará un QR automático como respaldo</p>
                </div>
              )}
            </div>

            <div>
              <label className="block w-full text-center cursor-pointer bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3 px-4 rounded-2xl text-xs transition-all shadow-md active:scale-[0.98]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'qr_altoke_url')}
                  className="hidden"
                />
                {formData.qr_altoke_url ? 'Cambiar Imagen QR Altoke' : 'Subir Imagen QR Altoke'}
              </label>
            </div>
          </div>
        </div>

        {/* Botón de Guardar */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-8 rounded-2xl text-sm shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar Configuración de Pagos'}
          </button>
        </div>
      </form>
    </div>
  );
}
