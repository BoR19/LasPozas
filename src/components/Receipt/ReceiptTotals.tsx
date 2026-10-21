import React from 'react';
import { type Reading, type Tariff } from '../../database/db';
import ReceiptTable from './ReceiptTable';

interface ReceiptTotalsProps {
  reading: Reading;
  tariff: Tariff;
}

export default function ReceiptTotals({ reading, tariff }: ReceiptTotalsProps) {
  const prevReading = reading.previous_reading ?? 0;
  const currReading = reading.current_reading ?? 0;
  const consumo = reading.consumption ?? Math.max(0, currReading - prevReading);

  return (
    <div className="space-y-4 mb-4">
      {/* Caja de Métricas de Lecturas */}
      <div className="bg-zinc-50/80 rounded-2xl p-4 border border-zinc-100 space-y-2">
        <div className="flex justify-between items-center text-xs sm:text-sm">
          <span className="text-zinc-500 font-medium">Lectura Anterior</span>
          <span className="font-bold font-mono text-zinc-900">{prevReading} m³</span>
        </div>
        <div className="flex justify-between items-center text-xs sm:text-sm">
          <span className="text-zinc-500 font-medium">Lectura Actual</span>
          <span className="font-bold font-mono text-zinc-900">{currReading} m³</span>
        </div>
        <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-zinc-200">
          <span className="text-zinc-900 font-bold text-xs sm:text-sm">Consumo</span>
          <span className="text-blue-600 font-black font-mono text-base sm:text-lg">{consumo} m³</span>
        </div>
      </div>

      {/* Desglose Tarifario */}
      <ReceiptTable reading={reading} tariff={tariff} />
    </div>
  );
}
