import React from 'react';
import { formatCurrency } from '../../lib/utils';
import { type Reading, type Tariff } from '../../database/db';

interface ReceiptTableProps {
  reading: Reading;
  tariff: Tariff;
}

export default function ReceiptTable({ reading, tariff }: ReceiptTableProps) {
  const detalle = reading.detalle || reading.bill_details?.detalle;

  // Determinar si es factura de reconexión
  const isReconexion = Boolean(
    reading.tipo_factura === 'reconexion' ||
    detalle?.tipo_factura === 'reconexion' ||
    detalle?.es_reconexion ||
    reading.bill_details?.es_reconexion ||
    ((detalle?.reconexion ?? 0) > 0 && !detalle?.es_primera_factura)
  );

  // Determinar con certeza si esPrimeraFactura (solo si NO es reconexión)
  const isPrimeraFactura = !isReconexion && (
    detalle?.es_primera_factura !== undefined
      ? Boolean(detalle.es_primera_factura)
      : reading.bill_details?.es_primera_factura !== undefined
      ? Boolean(reading.bill_details.es_primera_factura)
      : Boolean(
          ((detalle?.conexion ?? 0) > 0 || (detalle?.costo_conexion ?? 0) > 0) ||
          ((reading.previous_reading ?? 0) === 0 && (reading.consumption ?? 0) === 0)
        )
  );

  const cargoFijo = Number(detalle?.cargo_fijo ?? reading.bill_details?.fixed_charge ?? tariff?.cargo_fijo_mensual ?? 0);
  
  // Costo por Conexión: SOLO se muestra y se cobra si esPrimeraFactura == true
  const costoConexion = isPrimeraFactura
    ? Number(detalle?.costo_conexion ?? detalle?.conexion ?? reading.bill_details?.costo_conexion ?? reading.bill_details?.conexion ?? tariff?.tarifa_conexion ?? 0)
    : 0;

  // Costo por Reconexión: SOLO si es factura por reconexión (50% de la conexión)
  const costoReconexion = isReconexion
    ? Number(detalle?.costo_reconexion ?? detalle?.reconexion ?? reading.bill_details?.costo_reconexion ?? reading.bill_details?.reconexion ?? tariff?.tarifa_reconexion ?? Math.round((tariff?.tarifa_conexion || 0) * 0.5 * 100) / 100)
    : 0;

  const consumoM3 = Number(detalle?.consumo_m3 ?? reading.consumption ?? 0);
  
  const tarifaBase = Number(detalle?.tarifa_aplicada?.base ?? tariff?.costo_m3_base ?? 0);
  const tarifaExceso = Number(detalle?.tarifa_aplicada?.exceso ?? tariff?.costo_m3_exceso ?? 0);

  const consumoBase = Number(detalle?.consumo_base ?? (consumoM3 <= 20 ? consumoM3 : 20));
  const montoBase = Number(detalle?.monto_base ?? Math.round(consumoBase * tarifaBase * 100) / 100);

  const consumoExceso = Number(detalle?.consumo_exceso ?? (consumoM3 > 20 ? consumoM3 - 20 : 0));
  const montoExceso = Number(detalle?.monto_exceso ?? Math.round(consumoExceso * tarifaExceso * 100) / 100);

  // Total a pagar:
  // - Si es reconexión: Cargo Fijo + Reconexión
  // - Si es primera factura: Cargo Fijo + Conexión (+ consumo si hubiese)
  // - Si es normal: Cargo Fijo + Base + Exceso
  const totalPagar = isReconexion
    ? Number(detalle?.total ?? (cargoFijo + costoReconexion))
    : isPrimeraFactura
    ? Number(detalle?.total ?? (cargoFijo + costoConexion + montoBase + montoExceso))
    : Number(detalle?.total ?? (cargoFijo + montoBase + montoExceso));

  return (
    <div className="w-full my-6">
      <div className="flex items-center justify-between border-b border-zinc-200 pb-2 mb-3">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
          Detalle
        </span>
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
          Subtotal
        </span>
      </div>

      <div className="divide-y divide-zinc-100 text-xs sm:text-sm">
        {/* Línea 1: Cargo Fijo */}
        <div className="flex items-center justify-between py-2.5">
          <div className="flex-1 pr-4">
            <p className="font-bold text-zinc-900">Cargo Fijo</p>
            <p className="text-[10px] text-zinc-400 font-medium">Cuota fija de servicio mensual</p>
          </div>
          <div className="text-right">
            <span className="font-bold text-zinc-900 font-mono">{formatCurrency(cargoFijo)}</span>
          </div>
        </div>

        {/* Factura normal o primera factura: Líneas de Consumo Base y Exceso */}
        {!isReconexion && (
          <>
            <div className="flex items-center justify-between py-2.5">
              <div className="flex-1 pr-4">
                <p className="font-bold text-zinc-900">Base (0 - 20 m³)</p>
                <p className="text-[10px] text-zinc-400 font-medium">
                  {consumoBase} m³ × {formatCurrency(tarifaBase)}/m³
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-zinc-900 font-mono">{formatCurrency(montoBase)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <div className="flex-1 pr-4">
                <p className="font-bold text-zinc-900">Exceso (&gt; 20 m³)</p>
                <p className="text-[10px] text-zinc-400 font-medium">
                  {consumoExceso} m³ × {formatCurrency(tarifaExceso)}/m³
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-zinc-900 font-mono">{formatCurrency(montoExceso)}</span>
              </div>
            </div>
          </>
        )}

        {/* Costo por Conexión - SOLO SE MUESTRA SI esPrimeraFactura == true */}
        {isPrimeraFactura && (
          <div className="flex items-center justify-between py-2.5 bg-blue-50/70 -mx-3 px-3 rounded-xl border border-blue-100 my-1">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-1.5">
                <p className="font-black text-blue-950">Costo por Conexión</p>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                  Única vez
                </span>
              </div>
              <p className="text-[10px] text-blue-700/80 font-medium">Derecho e instalación de conexión</p>
            </div>
            <div className="text-right">
              <span className="font-black text-blue-900 font-mono text-sm sm:text-base">
                {formatCurrency(costoConexion)}
              </span>
            </div>
          </div>
        )}

        {/* Costo por Reconexión - SOLO SE MUESTRA SI isReconexion == true */}
        {isReconexion && (
          <div className="flex items-center justify-between py-2.5 bg-amber-50/80 -mx-3 px-3 rounded-xl border border-amber-200 my-1">
            <div className="flex-1 pr-4">
              <div className="flex items-center gap-1.5">
                <p className="font-black text-amber-950">Costo por Reconexión</p>
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-bold">
                  50% Conexión
                </span>
              </div>
              <p className="text-[10px] text-amber-800/80 font-medium">Restablecimiento del servicio tras suspensión</p>
            </div>
            <div className="text-right">
              <span className="font-black text-amber-900 font-mono text-sm sm:text-base">
                {formatCurrency(costoReconexion)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* TOTAL A PAGAR */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t-2 border-zinc-900">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-black text-zinc-400 block">
            {isReconexion
              ? 'Total (Cargo Fijo + Reconexión)'
              : isPrimeraFactura
              ? 'Total (Cargo Fijo + Conexión)'
              : 'Total a Pagar'}
          </span>
          <span className="text-sm font-black text-zinc-900 tracking-tight">TOTAL A PAGAR</span>
        </div>
        <div className="text-right">
          <span className="text-2xl sm:text-3xl font-black text-blue-600 font-mono tracking-tight">
            {formatCurrency(totalPagar)}
          </span>
        </div>
      </div>
    </div>
  );
}
