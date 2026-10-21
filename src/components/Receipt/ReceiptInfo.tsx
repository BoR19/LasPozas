import React from 'react';
import { type User, type Reading } from '../../database/db';

interface ReceiptInfoProps {
  user: User;
  reading: Reading;
}

export default function ReceiptInfo({ user, reading }: ReceiptInfoProps) {
  const zona = user.address?.trim() || 'Tolomosita Oeste';
  const meterId = user.meter_id?.trim() || reading.medidor_id || 'MET-S/N';

  return (
    <div className="grid grid-cols-2 gap-4 mb-6 border-y border-zinc-200/80 py-4 text-xs">
      <div className="space-y-3">
        <div>
          <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Nombre</span>
          <span className="font-black text-zinc-900 leading-tight block text-sm sm:text-base">{user.name || 'Sin nombre'}</span>
        </div>
        <div>
          <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Zona</span>
          <span className="font-semibold text-zinc-800 leading-tight block">{zona}</span>
        </div>
      </div>
      <div className="text-right space-y-3">
        <div>
          <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">ID Medidor</span>
          <span className="font-black font-mono text-zinc-900 block tracking-tight text-sm sm:text-base">{meterId}</span>
        </div>
        <div>
          <span className="block text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-0.5">Categoría</span>
          <span className="inline-block px-2.5 py-0.5 bg-zinc-100 rounded-md font-bold text-zinc-800 text-xs">
            {user.category || 'Residencial'}
          </span>
        </div>
      </div>
    </div>
  );
}
