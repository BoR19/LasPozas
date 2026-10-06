import React from 'react';
import { type Reading, type Tariff } from '../../database/db';
import ReceiptTable from './ReceiptTable';

interface ReceiptTotalsProps {
  reading: Reading;
  tariff: Tariff;
}

export default function ReceiptTotals({ reading, tariff }: ReceiptTotalsProps) {
  return (
    <div className="space-y-4 mb-8">
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-500 font-medium">Lectura Anterior</span>
          <span className="font-bold text-zinc-900">{reading.previous_reading} m³</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-zinc-500 font-medium">Lectura Actual</span>
          <span className="font-bold text-zinc-900">{reading.current_reading} m³</span>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-dashed border-zinc-200">
          <span className="text-zinc-900 font-bold">Consumo Total</span>
          <span className="text-blue-600 font-black text-lg">{reading.consumption} m³</span>
        </div>
      </div>

      <ReceiptTable reading={reading} tariff={tariff} />
    </div>
  );
}
