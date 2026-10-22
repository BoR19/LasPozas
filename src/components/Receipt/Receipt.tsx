import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { type Reading, type User, type Tariff, type PaymentConfig, getPaymentConfig } from '../../database/db';
import { formatDate, formatCurrency } from '../../lib/utils';
import { X, CheckCircle2 } from 'lucide-react';
import { domToPng } from 'modern-screenshot';
import ReceiptHeader from './ReceiptHeader';
import ReceiptInfo from './ReceiptInfo';
import ReceiptTotals from './ReceiptTotals';
import ReceiptActions from './ReceiptActions';
import ReceiptFooter from './ReceiptFooter';

interface ReceiptProps {
  reading: Reading;
  user: User;
  tariff?: Tariff | null;
}

export default function Receipt({ reading, user, tariff }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState<'sharing' | 'downloading' | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [qrFieImg, setQrFieImg] = useState<string>('');
  const [qrAltokeImg, setQrAltokeImg] = useState<string>('');

  console.log("Receipt component rendered with:", { reading, user, tariff });

  if (!reading || !user) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 max-w-md mx-auto text-center space-y-4">
        <h2 className="text-xl font-black text-red-600">Error al cargar el recibo</h2>
        <p className="text-zinc-600">No se pudieron cargar los datos necesarios.</p>
        <button 
          onClick={() => navigate(-1)}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all text-sm"
        >
          Volver
        </button>
      </div>
    );
  }

  const isPaid = reading.status === 'paid' || reading.estado_pago === 'pagado';
  const totalPagar = Number(reading.detalle?.total ?? reading.bill_details?.total ?? 0);

  useEffect(() => {
    async function loadPaymentDetails() {
      try {
        const cfg = await getPaymentConfig();
        setPaymentConfig(cfg);

        if (cfg.qr_fie_url) {
          setQrFieImg(cfg.qr_fie_url);
        } else {
          const fieGen = await QRCode.toDataURL(
            `FIE|TOLOMOSITA|BS:${totalPagar.toFixed(2)}|FAC:${reading.factura_id || reading.id}`,
            { width: 180, margin: 1 }
          );
          setQrFieImg(fieGen);
        }

        if (cfg.qr_altoke_url) {
          setQrAltokeImg(cfg.qr_altoke_url);
        } else {
          const altokeGen = await QRCode.toDataURL(
            `ALTOKE|TOLOMOSITA|BS:${totalPagar.toFixed(2)}|FAC:${reading.factura_id || reading.id}`,
            { width: 180, margin: 1 }
          );
          setQrAltokeImg(altokeGen);
        }
      } catch (err) {
        console.warn('Error cargando QRs en comprobante:', err);
      }
    }

    loadPaymentDetails();
  }, [totalPagar, reading]);

  const safeTariff: Tariff = tariff || {
    id: 0,
    categoria: user.category || 'Residencial',
    cargo_fijo_mensual: 0,
    costo_m3_base: 0,
    costo_m3_exceso: 0,
    tarifa_conexion: 0,
    porcentaje_alcantarillado: 0,
    fecha_inicio: 0,
    fecha_fin: Date.now() + 315360000000,
    uuid: 'tarifa-default-cero',
    updated_at: Date.now(),
    version: 1
  };

  const isReconexion = Boolean(
    reading.tipo_factura === 'reconexion' ||
    reading.detalle?.tipo_factura === 'reconexion' ||
    reading.detalle?.es_reconexion ||
    reading.bill_details?.es_reconexion ||
    ((reading.detalle?.reconexion ?? 0) > 0 && !reading.detalle?.es_primera_factura)
  );

  const isPrimeraFactura = !isReconexion && (
    reading.detalle?.es_primera_factura !== undefined
      ? Boolean(reading.detalle.es_primera_factura)
      : reading.bill_details?.es_primera_factura !== undefined
      ? Boolean(reading.bill_details.es_primera_factura)
      : Boolean(
          ((reading.detalle?.conexion ?? 0) > 0 || (reading.detalle?.costo_conexion ?? 0) > 0) ||
          ((reading.previous_reading ?? 0) === 0 && (reading.consumption ?? 0) === 0)
        )
  );

  const handlePrint = () => {
    window.print();
  };

  const getReceiptImage = async () => {
    if (!receiptRef.current) throw new Error('No se pudo encontrar el recibo');
    return await domToPng(receiptRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
    });
  };

  const share = async () => {
    if (!receiptRef.current) return;
    setIsProcessing('sharing');

    try {
      const dataUrl = await getReceiptImage();
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      const file = new File([blob], `recibo-${user.name}-${formatDate(reading.date)}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Recibo AquaLectura',
          text: `Recibo de agua - ${user.name} - ${formatDate(reading.date)}`
        });
      } else {
        throw new Error('Compartir no soportado');
      }
    } catch (err) {
      console.error('Error sharing receipt:', err);
      // Fallback a descarga directa
      await download();
    } finally {
      setIsProcessing(null);
    }
  };

  const download = async () => {
    if (!receiptRef.current) return;
    setIsProcessing('downloading');

    try {
      const dataUrl = await getReceiptImage();
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `recibo-${user.name}-${formatDate(reading.date)}.png`;
      link.click();
    } catch (err) {
      console.error('Error downloading receipt:', err);
      alert('No se pudo descargar el recibo.');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="relative space-y-6 max-w-lg mx-auto">
      {/* Botón flotante para cerrar / volver */}
      <button 
        onClick={() => navigate(-1)}
        className="absolute -top-3 -right-3 z-[999] p-2 bg-zinc-900 text-white rounded-full hover:bg-zinc-700 transition-all shadow-lg active:scale-95 print:hidden"
        title="Cerrar recibo"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Tarjeta del Recibo (Área de Impresión) */}
      <div 
        ref={receiptRef}
        id="print-area"
        className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-zinc-100 max-w-md mx-auto print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full receipt-container"
      >
        <ReceiptHeader reading={reading} user={user} />
        <ReceiptInfo user={user} reading={reading} />
        <ReceiptTotals reading={reading} tariff={safeTariff} />
        
        {isReconexion && (
          <div className="text-center mt-4 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-xl text-[11px] font-black uppercase tracking-wider border border-amber-200 print:border-zinc-300">
            Reactivación de Servicio — Incluye Reconexión (50%)
          </div>
        )}

        {isPrimeraFactura && (
          <div className="text-center mt-4 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[11px] font-black uppercase tracking-wider border border-blue-100/60 print:border-zinc-300">
            Primera Factura — Incluye Conexión
          </div>
        )}

        {/* SECCIÓN PAGADO vs MÉTODO DE PAGO */}
        {isPaid ? (
          /* Sello PAGADO */
          <div className="mt-6 p-4 rounded-2xl border-2 border-dashed border-emerald-500 bg-emerald-50/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-left">
                <span className="text-emerald-900 font-black tracking-wider text-xs uppercase block">
                  COMPROBANTE PAGADO
                </span>
                <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
                  Método: {reading.metodo_pago ? reading.metodo_pago.replace('_', ' ').toUpperCase() : 'EFECTIVO'}
                  {reading.fecha_pago ? ` • ${formatDate(reading.fecha_pago)}` : ''}
                </p>
              </div>
            </div>
            <div className="px-3 py-1 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transform rotate-2 shadow-sm">
              PAGADO
            </div>
          </div>
        ) : (
          /* Sección MÉTODO DE PAGO con QRs */
          <div className="mt-6 pt-5 border-t border-zinc-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">
                MÉTODO DE PAGO
              </span>
              <span className="text-xs font-black text-blue-600 font-mono">
                {formatCurrency(totalPagar)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* QR Banco FIE */}
              <div className="bg-zinc-50 p-2.5 rounded-2xl border border-zinc-200/80 flex flex-col items-center text-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white p-1 rounded-xl border border-zinc-200 flex items-center justify-center overflow-hidden">
                  {qrFieImg ? (
                    <img src={qrFieImg} alt="QR Banco FIE" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[9px] text-zinc-400">QR FIE</span>
                  )}
                </div>
                <span className="text-[10px] font-black text-blue-700 uppercase mt-1.5 tracking-tight">
                  Banco FIE
                </span>
              </div>

              {/* QR Altoke */}
              <div className="bg-zinc-50 p-2.5 rounded-2xl border border-zinc-200/80 flex flex-col items-center text-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white p-1 rounded-xl border border-zinc-200 flex items-center justify-center overflow-hidden">
                  {qrAltokeImg ? (
                    <img src={qrAltokeImg} alt="QR Altoke" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[9px] text-zinc-400">QR Altoke</span>
                  )}
                </div>
                <span className="text-[10px] font-black text-amber-700 uppercase mt-1.5 tracking-tight">
                  Altoke
                </span>
              </div>
            </div>

            <div className="text-center text-[10px] text-zinc-500 leading-tight pt-1">
              <p className="font-bold text-zinc-700">{paymentConfig?.titular || 'Comité de Agua Potable Tolomosita Oeste'}</p>
              <p>{paymentConfig?.banco || 'Banco FIE S.A. / Altoke'}{paymentConfig?.cuenta ? ` • ${paymentConfig.cuenta}` : ''}</p>
            </div>
          </div>
        )}

        <ReceiptFooter />
        
        <div className="flex justify-center mt-4">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
            isPaid ? 'bg-green-100 text-green-700' :
            reading.status === 'pending' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {isPaid ? '🟢 Pagado' : 
             reading.status === 'pending' ? '🟡 Pendiente' : '🔴 Vencido'}
          </span>
        </div>
      </div>

      {/* Botones de acción (Ocultos en impresión) */}
      <div className="print:hidden">
        <ReceiptActions 
          onPrint={handlePrint}
          onShare={share}
          onDownload={download}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
}
