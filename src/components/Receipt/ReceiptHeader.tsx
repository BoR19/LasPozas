import React from 'react';
import { Droplets } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import { type Reading, type User } from '../../database/db';

interface ReceiptHeaderProps {
  reading: Reading;
  user: User;
}

export default function ReceiptHeader({ reading, user }: ReceiptHeaderProps) {
  return (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="p-3 bg-blue-600 rounded-2xl text-white mb-3 print:bg-black">
        <Droplets className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">COMPROBANTE DE PAGO</h2>
      <p className="text-sm text-zinc-500 font-medium">Tolomosita Oeste - AquaLectura</p>
      
      <div className="w-full flex justify-between items-center mt-6 border-t border-zinc-100 pt-4">
        <div className="text-left">
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Fecha</p>
          <p className="text-sm font-bold text-zinc-900">{formatDate(reading.date)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Nº Factura</p>
          <p className="text-sm font-bold text-zinc-900">{reading.uuid.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>
    </div>
  );
}
