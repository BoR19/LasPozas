import React from 'react';
import { formatCurrency } from '../../lib/utils';
import { type Reading, type Tariff } from '../../database/db';

interface ReceiptTableProps {
  reading: Reading;
  tariff: Tariff;
}

export default function ReceiptTable({ reading, tariff }: ReceiptTableProps) {
  const renderRow = (concept: string, cant: string | number, price: string | number, total: number) => (
    <div className="flex items-center py-2 border-b border-zinc-100 last:border-0">
      <div className="flex-1 text-left text-sm font-medium text-zinc-900">{concept}</div>
      <div className="flex-[0_0_30%] text-center text-xs text-zinc-500">
        {cant} x {price}
      </div>
      <div className="flex-[0_0_20%] text-right text-sm font-bold text-zinc-900">
        {formatCurrency(total)}
      </div>
    </div>
  );

  return (
    <div className="w-full my-8">
      <div className="flex items-center pb-2 border-b border-zinc-200 text-zinc-400 uppercase text-[10px] font-bold tracking-widest">
        <div className="flex-1 text-left">Concepto</div>
        <div className="flex-[0_0_30%] text-center">Cant. Precio</div>
        <div className="flex-[0_0_20%] text-right">Total</div>
      </div>
      
      <div className="text-zinc-900 font-medium">
        {reading.previous_reading === 0 ? (
          renderRow('Conexión Inicial', '1', formatCurrency(tariff.tarifa_conexion), reading.bill_details?.total || 0)
        ) : (
          <>
            {renderRow('Cargo Fijo', '1', formatCurrency(tariff.cargo_fijo_mensual), reading.bill_details?.fixed_charge || 0)}
            {renderRow('Consumo Agua', `${reading.consumption} m³`, '...', reading.bill_details?.water_cost || 0)}
            {renderRow(`Alcantarillado (${tariff.porcentaje_alcantarillado ?? 20}%)`, '-', '-', reading.bill_details?.sewer_cost || 0)}
          </>
        )}
      </div>

      <div className="flex items-center pt-6 mt-4 border-t-2 border-zinc-900">
        <div className="flex-1 text-right font-black text-lg text-zinc-900 pr-4">TOTAL A PAGAR</div>
        <div className="flex-[0_0_20%] text-right font-black text-2xl text-blue-600">
          {formatCurrency(reading.bill_details?.total || 0)}
        </div>
      </div>
    </div>
  );
}
