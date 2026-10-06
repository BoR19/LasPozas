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
  tariff: Tariff;
}

export default function Receipt({ reading, user, tariff }: ReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState<'sharing' | 'downloading' | null>(null);

  console.log("Receipt component rendered with:", { reading, user, tariff });

  if (!reading || !user || !tariff) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 max-w-md mx-auto text-center space-y-4">
        <h2 className="text-xl font-black text-red-600">Error al cargar el recibo</h2>
        <p className="text-zinc-600">No se pudieron cargar los datos necesarios.</p>
        <button 
          onClick={() => navigate(-1)}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all"
        >
          Volver
        </button>
      </div>
    );
  }

  const handlePrint = () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) {
      console.error('No se pudo encontrar el área de impresión');
      return;
    }

    // Abrir ventana nueva
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      alert('Por favor, habilita las ventanas emergentes para poder imprimir.');
      return;
    }

    // Obtener todos los estilos del documento actual
    const styles = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
        } catch (e) {
          return ''; // Ignorar hojas de estilo externas bloqueadas por CORS
        }
      })
      .join('\n');

    // Construir el documento de impresión
    printWindow.document.write(`
      <html>
        <head>
          <title>Recibo - ${user.name}</title>
          <style>
            ${styles}
            body { font-family: sans-serif; padding: 20px; background: white; }
            #print-area { display: block !important; width: 100% !important; max-width: 400px !important; margin: 0 auto !important; }
          </style>
        </head>
        <body>
          <div id="print-area">
            ${printArea.innerHTML}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Esperar un momento a que carguen los estilos y disparar impresión
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 500);
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
      alert('No se pudo compartir el recibo. Intente descargarlo.');
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
    <div className="relative space-y-6">
      <button 
        onClick={() => navigate(-1)}
        className="absolute -top-4 -right-4 z-[999] p-2 bg-zinc-900 text-white rounded-full hover:bg-zinc-700 transition-all shadow-lg active:scale-95"
      >
        <X className="w-5 h-5" />
      </button>

      <div 
        ref={receiptRef}
        id="print-area"
        className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 max-w-md mx-auto print:shadow-none print:border-none print:p-4 print:m-0 receipt-container"
      >
        <ReceiptHeader reading={reading} user={user} />
        <ReceiptInfo user={user} reading={reading} />
        <ReceiptTotals reading={reading} tariff={tariff} />
        <ReceiptFooter />
        
        {reading.previous_reading === 0 && (
          <div className="text-center mt-4 text-xs font-bold text-blue-600 uppercase tracking-widest">
            Pago por conexión al servicio
          </div>
        )}
        
        <div className="flex justify-center mt-4">
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
            reading.status === 'paid' ? 'bg-green-100 text-green-700' :
            reading.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            'bg-red-100 text-red-700'
          }`}>
            {reading.status === 'paid' ? '🟢 Pagado' : 
             reading.status === 'pending' ? '🟡 Pendiente' : '🔴 Vencido'}
          </span>
        </div>
      </div>

      <ReceiptActions 
        onPrint={handlePrint}
        onShare={share}
        onDownload={download}
        isProcessing={isProcessing}
      />
    </div>
  );
}
