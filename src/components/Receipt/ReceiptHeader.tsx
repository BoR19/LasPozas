import React from 'react';
import { Droplets } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { type Reading, type User } from '../../database/db';

interface ReceiptHeaderProps {
  reading: Reading;
  user: User;
}

export default function ReceiptHeader({ reading, user }: ReceiptHeaderProps) {
  const invoiceNumber = reading.factura_id || (reading.uuid ? reading.uuid.slice(0, 8).toUpperCase() : 'FAC-0001');

  return (
    <div className="flex flex-col items-center text-center mb-6">
      <div className="p-3 bg-blue-600 rounded-2xl text-white mb-2 print:bg-zinc-900 print:text-white">
        <Droplets className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight print:text-black">
        COMPROBANTE DE PAGO
      </h2>
      <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider print:text-zinc-700">
        Comité de Agua Potable Tolomosita Oeste
      </p>
      
      <div className="w-full flex justify-between items-center mt-5 border-t border-dashed border-zinc-200 print:border-zinc-400 pt-3">
        <div className="text-left">
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest print:text-zinc-600">Fecha</p>
          <p className="text-xs sm:text-sm font-bold text-zinc-900 font-mono print:text-black">
            {formatDate(reading.date || Date.now())}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest print:text-zinc-600">Nº Factura</p>
          <p className="text-xs sm:text-sm font-bold text-zinc-900 font-mono print:text-black">
            {invoiceNumber}
          </p>
        </div>
      </div>
    </div>
  );
}
