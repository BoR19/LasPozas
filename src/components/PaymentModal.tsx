import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { type PaymentConfig, getPaymentConfig } from '../database/db';
import { formatCurrency } from '../lib/utils';
import { 
  X, 
  DollarSign, 
  QrCode, 
  Banknote, 
  CheckCircle2, 
  Building2, 
  UserCheck, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (details: {
    metodo_pago: 'efectivo' | 'qr_fie' | 'qr_altoke';
    monto_recibido?: number;
    cambio?: number;
  }) => Promise<void>;
  invoiceData: {
    id: string | number;
    userName: string;
    meterId: string;
    total: number;
    factura_id?: string;
  };
}

export default function PaymentModal({
  isOpen,
  onClose,
  onConfirmPayment,
  invoiceData
}: PaymentModalProps) {
  const [activeTab, setActiveTab] = useState<'efectivo' | 'qr'>('efectivo');
  const [qrProvider, setQrProvider] = useState<'fie' | 'altoke'>('fie');
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);

  // Estados de Efectivo
  const total = Number(invoiceData.total || 0);
  const [montoRecibidoStr, setMontoRecibidoStr] = useState<string>(total.toFixed(2));
  const montoRecibidoNum = parseFloat(montoRecibidoStr) || 0;
  const cambio = Math.max(0, Math.round((montoRecibidoNum - total) * 100) / 100);
  const montoInsuficiente = montoRecibidoNum < total;

  // Estados de QR generados como respaldo
  const [generatedFieQR, setGeneratedFieQR] = useState<string>('');
  const [generatedAltokeQR, setGeneratedAltokeQR] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cargar configuración de pagos y generar QRs dinámicos de respaldo si es necesario
  useEffect(() => {
    if (!isOpen) return;

    setMontoRecibidoStr(total.toFixed(2));
    setErrorMsg(null);

    async function loadConfig() {
      try {
        const cfg = await getPaymentConfig();
        setPaymentConfig(cfg);

        // Generar QR de respaldo para Banco FIE
        const fiePayload = `PAGO-AGUA-TOLOMOSITA|BANCO-FIE|FAC:${invoiceData.factura_id || invoiceData.id}|MED:${invoiceData.meterId}|BS:${total.toFixed(2)}`;
        const fieDataUrl = await QRCode.toDataURL(fiePayload, { width: 260, margin: 1 });
        setGeneratedFieQR(fieDataUrl);

        // Generar QR de respaldo para Altoke
        const altokePayload = `ALTOKE-PAGO-AGUA|FAC:${invoiceData.factura_id || invoiceData.id}|USER:${invoiceData.userName}|BS:${total.toFixed(2)}`;
        const altokeDataUrl = await QRCode.toDataURL(altokePayload, { width: 260, margin: 1 });
        setGeneratedAltokeQR(altokeDataUrl);
      } catch (err) {
        console.warn('Error cargando configuración o generando QRs:', err);
      }
    }

    loadConfig();
  }, [isOpen, total, invoiceData]);

  if (!isOpen) return null;

  const handleCashPayment = async () => {
    if (montoInsuficiente) {
      setErrorMsg('El monto recibido no puede ser inferior al total de la factura.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirmPayment({
        metodo_pago: 'efectivo',
        monto_recibido: montoRecibidoNum,
        cambio: cambio
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar el cobro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQRPayment = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirmPayment({
        metodo_pago: qrProvider === 'fie' ? 'qr_fie' : 'qr_altoke',
        monto_recibido: total,
        cambio: 0
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al procesar el cobro');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Botones de monto rápido en efectivo
  const setExactAmount = () => setMontoRecibidoStr(total.toFixed(2));
  const addCash = (amount: number) => {
    const current = parseFloat(montoRecibidoStr) || total;
    setMontoRecibidoStr((current + amount).toFixed(2));
  };
  const roundToNext = (multiple: number) => {
    const rounded = Math.ceil(total / multiple) * multiple;
    setMontoRecibidoStr(rounded.toFixed(2));
  };

  const currentQRImage = qrProvider === 'fie'
    ? (paymentConfig?.qr_fie_url || generatedFieQR)
    : (paymentConfig?.qr_altoke_url || generatedAltokeQR);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera del modal */}
        <div className="p-5 sm:p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-zinc-900 leading-tight">Cobrar Factura de Agua</h3>
              <p className="text-xs text-zinc-500 font-medium">
                {invoiceData.userName} • Medidor: {invoiceData.meterId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumen del Monto a Cobrar */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-blue-200 block">
              Monto Total a Cobrar
            </span>
            <span className="text-2xl sm:text-3xl font-black font-mono">
              {formatCurrency(total)}
            </span>
          </div>
          <div className="text-right text-xs text-blue-100">
            <p className="font-semibold">{invoiceData.userName}</p>
            <p className="opacity-80">FAC-{invoiceData.factura_id || invoiceData.id}</p>
          </div>
        </div>

        {/* Selector de Pestañas: Efectivo vs QR Estático */}
        <div className="grid grid-cols-2 p-2 bg-zinc-100/90 gap-1.5 border-b border-zinc-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('efectivo')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'efectivo'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Banknote className="w-4 h-4 text-emerald-600" />
            Efectivo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'qr'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <QrCode className="w-4 h-4 text-blue-600" />
            QR Estático
          </button>
        </div>

        {/* Mensaje de Error */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Contenido según pestaña */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === 'efectivo' ? (
            /* ================== PESTAÑA EFECTIVO ================== */
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-600 uppercase tracking-wider block">
                  Monto Recibido del Cliente (Bs)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-zinc-400">
                    Bs
                  </span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={montoRecibidoStr}
                    onChange={(e) => setMontoRecibidoStr(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 border-2 border-zinc-200 rounded-2xl text-xl font-black font-mono text-zinc-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Botones de sugerencia rápida */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={setExactAmount}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl transition-all"
                >
                  Exacto (Bs {total.toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => addCash(10)}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl transition-all"
                >
                  +10 Bs
                </button>
                <button
                  type="button"
                  onClick={() => addCash(20)}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl transition-all"
                >
                  +20 Bs
                </button>
                <button
                  type="button"
                  onClick={() => addCash(50)}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl transition-all"
                >
                  +50 Bs
                </button>
                <button
                  type="button"
                  onClick={() => roundToNext(10)}
                  className="px-3 py-1.5 text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl transition-all"
                >
                  Redondear a 10
                </button>
              </div>

              {/* Cálculo del Cambio / Vuelto */}
              <div className={`p-4 rounded-2xl border transition-all ${
                montoInsuficiente 
                  ? 'bg-amber-50 border-amber-200 text-amber-900' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] uppercase font-black tracking-wider block opacity-75">
                      {montoInsuficiente ? 'Faltante para completar el pago' : 'Cambio a Devolver'}
                    </span>
                    <span className="text-2xl font-black font-mono">
                      {montoInsuficiente 
                        ? `Faltan Bs ${(total - montoRecibidoNum).toFixed(2)}`
                        : formatCurrency(cambio)
                      }
                    </span>
                  </div>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm ${
                    montoInsuficiente ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {montoInsuficiente ? '!' : '✓'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCashPayment}
                disabled={isSubmitting || montoInsuficiente}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                {isSubmitting ? 'Registrando Cobro...' : `Confirmar Pago en Efectivo (Bs ${total.toFixed(2)})`}
              </button>
            </div>
          ) : (
            /* ================== PESTAÑA QR ESTÁTICO ================== */
            <div className="space-y-4">
              {/* Sub-pestañas: Banco FIE vs Altoke */}
              <div className="flex p-1 bg-zinc-100 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setQrProvider('fie')}
                  className={`flex-1 py-2 rounded-lg transition-all ${
                    qrProvider === 'fie' 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Banco FIE
                </button>
                <button
                  type="button"
                  onClick={() => setQrProvider('altoke')}
                  className={`flex-1 py-2 rounded-lg transition-all ${
                    qrProvider === 'altoke' 
                      ? 'bg-amber-500 text-white shadow-sm' 
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Altoke
                </button>
              </div>

              {/* Contenedor del QR Grande y Monto */}
              <div className="flex flex-col items-center justify-center p-5 bg-zinc-50 rounded-2xl border border-zinc-200 text-center space-y-3">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-200">
                  {currentQRImage ? (
                    <img
                      src={currentQRImage}
                      alt={`QR ${qrProvider === 'fie' ? 'Banco FIE' : 'Altoke'}`}
                      className="w-56 h-56 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-56 h-56 flex items-center justify-center text-zinc-400">
                      Cargando QR...
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Monto a Transferir
                  </span>
                  <p className="text-2xl font-black text-blue-600 font-mono">
                    {formatCurrency(total)}
                  </p>
                </div>

                <div className="text-xs text-zinc-600 space-y-0.5 border-t border-zinc-200/80 pt-2 w-full">
                  <p className="font-bold text-zinc-800">
                    {paymentConfig?.titular || 'Comité de Agua Potable Tolomosita Oeste'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {qrProvider === 'fie' ? 'Banco FIE S.A.' : 'Billetera Móvil Altoke'}
                    {paymentConfig?.cuenta ? ` • ${paymentConfig.cuenta}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleQRPayment}
                disabled={isSubmitting}
                className={`w-full py-4 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 ${
                  qrProvider === 'fie'
                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
                    : 'bg-amber-600 hover:bg-amber-700 shadow-amber-100'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                {isSubmitting 
                  ? 'Registrando Cobro...' 
                  : `Confirmar Pago QR ${qrProvider === 'fie' ? 'Banco FIE' : 'Altoke'}`
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
