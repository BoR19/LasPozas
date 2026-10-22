import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { type Reading, type User, type Tariff, type PaymentConfig, getPaymentConfig } from '../../database/db';
import { formatDate, formatCurrency } from '../../lib/utils';
import { Printer } from 'lucide-react';

interface TicketTermico80Props {
  reading: Reading;
  user: User;
  tariff?: Tariff | null;
  onClose?: () => void;
}

export default function TicketTermico80({
  reading,
  user,
  tariff,
  onClose
}: TicketTermico80Props) {
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [qrFieDataUrl, setQrFieDataUrl] = useState<string>('');
  const [qrAltokeDataUrl, setQrAltokeDataUrl] = useState<string>('');

  const detalle = reading.detalle || reading.bill_details?.detalle;
  const isPaid = reading.status === 'paid' || reading.estado_pago === 'pagado';
  const total = Number(detalle?.total ?? reading.bill_details?.total ?? 0);

  // Determinar si es reconexión o primera factura
  const isReconexion = Boolean(
    reading.tipo_factura === 'reconexion' ||
    detalle?.tipo_factura === 'reconexion' ||
    detalle?.es_reconexion ||
    reading.bill_details?.es_reconexion ||
    ((detalle?.reconexion ?? 0) > 0 && !detalle?.es_primera_factura)
  );

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
  const costoConexion = isPrimeraFactura
    ? Number(detalle?.costo_conexion ?? detalle?.conexion ?? reading.bill_details?.costo_conexion ?? reading.bill_details?.conexion ?? tariff?.tarifa_conexion ?? 0)
    : 0;
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

  useEffect(() => {
    async function initQRs() {
      try {
        const cfg = await getPaymentConfig();
        setPaymentConfig(cfg);

        // Si hay imagen configurada para FIE, úsala; sino genera QR dinámico monocromático
        if (cfg.qr_fie_url) {
          setQrFieDataUrl(cfg.qr_fie_url);
        } else {
          const fieText = `FIE|TOLOMOSITA|BS:${total.toFixed(2)}|FAC:${reading.factura_id || reading.id}`;
          const fieGen = await QRCode.toDataURL(fieText, { width: 140, margin: 0, color: { dark: '#000000', light: '#ffffff' } });
          setQrFieDataUrl(fieGen);
        }

        // Si hay imagen configurada para Altoke, úsala; sino genera QR dinámico monocromático
        if (cfg.qr_altoke_url) {
          setQrAltokeDataUrl(cfg.qr_altoke_url);
        } else {
          const altokeText = `ALTOKE|TOLOMOSITA|BS:${total.toFixed(2)}|FAC:${reading.factura_id || reading.id}`;
          const altokeGen = await QRCode.toDataURL(altokeText, { width: 140, margin: 0, color: { dark: '#000000', light: '#ffffff' } });
          setQrAltokeDataUrl(altokeGen);
        }
      } catch (err) {
        console.warn('Error cargando QRs térmicos:', err);
      }
    }

    initQRs();
  }, [total, reading]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center">
      {/* Botones de acción en pantalla (ocultos al imprimir) */}
      <div className="w-full max-w-[302px] mb-4 flex gap-2 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="flex-1 py-3 bg-black text-white font-mono font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-zinc-800 transition-all flex items-center justify-center gap-2"
        >
          <Printer className="w-4 h-4" /> Imprimir 80mm
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 bg-zinc-200 text-zinc-800 font-mono font-bold text-xs rounded-xl hover:bg-zinc-300 transition-all"
          >
            Cerrar
          </button>
        )}
      </div>

      {/* TICKET TÉRMICO 80mm (Estrictamente max-width 302px, font Courier / monospace, 100% negro) */}
      <div
        id="ticket-termico-80"
        className="w-[302px] max-w-[302px] bg-white text-black font-mono text-[11px] leading-tight p-3 border border-zinc-300 shadow-lg print:border-none print:shadow-none print:p-0 print:m-0"
        style={{ fontFamily: '"Courier New", Courier, monospace', color: '#000000' }}
      >
        {/* Cabecera */}
        <div className="text-center space-y-0.5">
          <p className="font-black text-xs uppercase">COMITÉ DE AGUA POTABLE</p>
          <p className="font-black text-sm uppercase">TOLOMOSITA OESTE</p>
          <p className="text-[10px]">TARIJA - BOLIVIA</p>
          <p className="text-[9px]">Servicio Comunitario de Agua</p>
        </div>

        <div className="my-1.5 text-center">
          --------------------------------
        </div>

        {/* Datos de Factura */}
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>N° FACTURA:</span>
            <span className="font-bold">FAC-{reading.factura_id || reading.id || '0000'}</span>
          </div>
          <div className="flex justify-between">
            <span>FECHA:</span>
            <span>{formatDate(reading.date || Date.now())}</span>
          </div>
          <div className="flex justify-between">
            <span>ESTADO:</span>
            <span className="font-bold uppercase">
              {isPaid ? 'PAGADO' : 'PENDIENTE'}
            </span>
          </div>
        </div>

        <div className="my-1.5 text-center">
          --------------------------------
        </div>

        {/* Datos del Cliente */}
        <div className="space-y-0.5">
          <p className="font-black uppercase">CLIENTE: {user.name}</p>
          <div className="flex justify-between">
            <span>MEDIDOR:</span>
            <span className="font-bold">{user.meter_id}</span>
          </div>
          <div className="flex justify-between">
            <span>CATEGORÍA:</span>
            <span>{user.category || 'Residencial'}</span>
          </div>
          {user.address && (
            <div className="flex justify-between">
              <span>ZONA:</span>
              <span className="truncate max-w-[180px]">{user.address}</span>
            </div>
          )}
        </div>

        <div className="my-1.5 text-center">
          --------------------------------
        </div>

        {/* Lecturas y Consumo */}
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Lectura Ant:</span>
            <span>{reading.previous_reading ?? 0} m³</span>
          </div>
          <div className="flex justify-between">
            <span>Lectura Act:</span>
            <span>{reading.current_reading ?? 0} m³</span>
          </div>
          <div className="flex justify-between font-black">
            <span>CONSUMO TOTAL:</span>
            <span>{consumoM3} m³</span>
          </div>
        </div>

        <div className="my-1.5 text-center">
          --------------------------------
        </div>

        {/* Detalle de Cobro */}
        <div className="space-y-1">
          <p className="font-black text-[10px] uppercase">DETALLE DE COBRO</p>
          
          <div className="flex justify-between">
            <span>Cargo Fijo</span>
            <span>Bs {cargoFijo.toFixed(2)}</span>
          </div>

          {isPrimeraFactura && (
            <div className="flex justify-between font-bold">
              <span>Conexión (Única vez)</span>
              <span>Bs {costoConexion.toFixed(2)}</span>
            </div>
          )}

          {isReconexion && (
            <div className="flex justify-between font-bold">
              <span>Reconexión (50%)</span>
              <span>Bs {costoReconexion.toFixed(2)}</span>
            </div>
          )}

          {!isReconexion && (
            <>
              <div className="flex justify-between">
                <span>Base ({consumoBase}m³ a Bs {tarifaBase.toFixed(2)})</span>
                <span>Bs {montoBase.toFixed(2)}</span>
              </div>
              {consumoExceso > 0 && (
                <div className="flex justify-between">
                  <span>Exceso ({consumoExceso}m³ a Bs {tarifaExceso.toFixed(2)})</span>
                  <span>Bs {montoExceso.toFixed(2)}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="my-2 text-center font-bold">
          ================================
        </div>

        {/* TOTAL A PAGAR (GRANDE) */}
        <div className="text-center py-1">
          <p className="text-[10px] font-black uppercase tracking-widest">
            {isPaid ? 'TOTAL CANCELADO' : 'TOTAL A PAGAR'}
          </p>
          <p className="text-2xl font-black tracking-tight" style={{ fontWeight: 900 }}>
            Bs {total.toFixed(2)}
          </p>
        </div>

        <div className="my-2 text-center font-bold">
          ================================
        </div>

        {/* Sello CANCELADO o Sección de 2 QRs */}
        {isPaid ? (
          <div className="my-3 py-2 border-2 border-black text-center space-y-0.5">
            <p className="text-base font-black tracking-widest">
              *** CANCELADO ***
            </p>
            <p className="text-[10px] font-bold uppercase">
              MÉTODO: {reading.metodo_pago ? reading.metodo_pago.replace('_', ' ').toUpperCase() : 'EFECTIVO'}
            </p>
            {reading.fecha_pago && (
              <p className="text-[9px]">
                {formatDate(reading.fecha_pago)}
              </p>
            )}
          </div>
        ) : (
          <div className="my-2 space-y-2 text-center">
            <p className="font-black text-[10px] uppercase">
              PAGO RÁPIDO CON CÓDIGOS QR
            </p>

            {/* Dos QRs Lado a Lado (FIE y ALTOKE) */}
            <div className="flex items-center justify-center gap-3 pt-1">
              {/* QR FIE */}
              <div className="flex flex-col items-center">
                <div className="w-[115px] h-[115px] p-1 border border-black flex items-center justify-center bg-white">
                  {qrFieDataUrl ? (
                    <img src={qrFieDataUrl} alt="QR FIE" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[8px]">QR FIE</span>
                  )}
                </div>
                <span className="font-bold text-[9px] mt-0.5">BANCO FIE</span>
              </div>

              {/* QR ALTOKE */}
              <div className="flex flex-col items-center">
                <div className="w-[115px] h-[115px] p-1 border border-black flex items-center justify-center bg-white">
                  {qrAltokeDataUrl ? (
                    <img src={qrAltokeDataUrl} alt="QR ALTOKE" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[8px]">QR ALTOKE</span>
                  )}
                </div>
                <span className="font-bold text-[9px] mt-0.5">ALTOKE</span>
              </div>
            </div>

            {/* MONTO A PAGAR GRANDE */}
            <div className="pt-1">
              <span className="text-[9px] font-bold uppercase block">
                MONTO A PAGAR:
              </span>
              <span className="text-base font-black">
                Bs {total.toFixed(2)}
              </span>
            </div>

            {paymentConfig?.titular && (
              <p className="text-[9px] font-medium leading-tight px-1">
                Titular: {paymentConfig.titular}
              </p>
            )}
          </div>
        )}

        <div className="my-1.5 text-center">
          --------------------------------
        </div>

        {/* Pie de ticket */}
        <div className="text-center text-[9px] space-y-0.5 pb-2">
          <p className="font-bold uppercase">¡Gracias por su pago puntual!</p>
          <p>Conserve este ticket como constancia</p>
          <p className="text-[8px] text-zinc-600">Tolomosita Oeste - Agua Potable</p>
        </div>
      </div>
    </div>
  );
}
