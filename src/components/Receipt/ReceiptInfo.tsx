import React from 'react';
import { type User, type Reading } from '../../database/db';
import { formatDate } from '../../lib/utils';

interface ReceiptInfoProps {
  user: User;
  reading: Reading;
}

export default function ReceiptInfo({ user, reading }: ReceiptInfoProps) {
  return (
    <div className="grid grid-cols-2 gap-6 mb-8 border-y border-zinc-100 py-6">
      <div>
        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Usuario</p>
        <p className="text-sm font-bold text-zinc-900 leading-tight">{user.name}</p>
        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-2 mb-1">Dirección</p>
        <p className="text-sm font-bold text-zinc-900 leading-tight">{user.address || 'N/A'}</p>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mb-1">Medidor</p>
        <p className="text-sm font-bold text-zinc-900">{user.meter_id}</p>
        <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-2 mb-1">Categoría</p>
        <p className="text-sm font-bold text-zinc-900">{user.category}</p>
      </div>
    </div>
  );
}
