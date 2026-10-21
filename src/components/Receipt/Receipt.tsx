import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Reading, type User, type Tariff } from '../../database/db';
import { formatDate } from '../../lib/utils';
import { X } from 'lucide-react';
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
        <ReceiptFooter />
        
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
        
        <div className="flex justify-center mt-4">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
            reading.status === 'paid' ? 'bg-green-100 text-green-700' :
            reading.status === 'pending' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {reading.status === 'paid' ? '🟢 Pagado' : 
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
