import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Reading, type User } from '../database/db';
import { syncService } from '../services/syncService';
import { registrarPagoFactura } from '../services/billingService';
import { formatCurrency, formatDate } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import PaymentModal from '../components/PaymentModal';
import { 
  Download, 
  MessageSquare, 
  Search, 
  CheckCircle2, 
  Clock, 
  Filter, 
  Droplets, 
  CreditCard, 
  FileText, 
  DollarSign, 
  ChevronRight, 
  Printer 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface EnrichedInvoice extends Reading {
  userName: string;
  meterId: string;
  userCategory: string;
}

export default function FacturacionPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [payingReading, setPayingReading] = useState<EnrichedInvoice | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Fetch readings and match with users
  const invoices = useLiveQuery(async () => {
    const allReadings = await db.readings.reverse().sortBy('date');
    const allUsers = await db.users.toArray();
    const userMap = new Map<string, User>();
    allUsers.forEach(u => {
      if (u.id) userMap.set(u.id, u);
    });

    return allReadings.map(r => {
      const u = userMap.get(r.user_id);
      return {
        ...r,
        userName: u?.name || 'Usuario desconocido',
        meterId: u?.meter_id || 'N/A',
        userCategory: u?.category || 'Residencial'
      } as EnrichedInvoice;
    });
  }, []);

  // Filter invoices
  const filteredInvoices = invoices?.filter(item => {
    const matchesSearch = 
      item.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.meterId.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (statusFilter === 'pending') return item.status === 'pending';
    if (statusFilter === 'paid') return item.status === 'paid';
    return true;
  });

  // Calculate totals
  const totalAmount = invoices?.reduce((acc, curr) => acc + (curr.bill_details?.total || 0), 0) || 0;
  const paidAmount = invoices?.filter(i => i.status === 'paid').reduce((acc, curr) => acc + (curr.bill_details?.total || 0), 0) || 0;
  const pendingAmount = invoices?.filter(i => i.status === 'pending').reduce((acc, curr) => acc + (curr.bill_details?.total || 0), 0) || 0;

  const handleConfirmPaymentModal = async (details: {
    metodo_pago: 'efectivo' | 'qr_fie' | 'qr_altoke';
    monto_recibido?: number;
    cambio?: number;
  }) => {
    if (!payingReading) return;
    const facturaIdentifier = payingReading.factura_id || payingReading.id;
    if (!facturaIdentifier) return;

    await registrarPagoFactura({
      facturaId: facturaIdentifier,
      metodo_pago: details.metodo_pago,
      monto_recibido: details.monto_recibido,
      cambio: details.cambio
    });

    setPayingReading(null);
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Title & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Facturación</h1>
          <p className="text-zinc-500 font-medium">Historial de facturas y estados de pago</p>
        </div>

        {/* Quick summary cards */}
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <div>
              <p className="text-[10px] uppercase font-black text-emerald-600 tracking-wider">Cobrado</p>
              <p className="text-sm font-black text-emerald-700">{formatCurrency(paidAmount)}</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-amber-50 rounded-2xl border border-amber-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <div>
              <p className="text-[10px] uppercase font-black text-amber-600 tracking-wider">Pendiente</p>
              <p className="text-sm font-black text-amber-700">{formatCurrency(pendingAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
          <input 
            type="text"
            placeholder="Buscar por usuario o número de medidor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white border border-zinc-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 rounded-2xl">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-xs transition-all",
              statusFilter === 'all' 
                ? "bg-white text-zinc-900 shadow-sm" 
                : "text-zinc-500 hover:text-zinc-900"
            )}
          >
            Todas
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5",
              statusFilter === 'pending' 
                ? "bg-white text-amber-600 shadow-sm" 
                : "text-zinc-500 hover:text-amber-600"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Pendientes
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5",
              statusFilter === 'paid' 
                ? "bg-white text-emerald-600 shadow-sm" 
                : "text-zinc-500 hover:text-emerald-600"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Pagadas
          </button>
        </div>
      </div>

      {/* Invoices Table Card - Matching design from user image */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-100 text-[11px] font-black tracking-wider text-zinc-400 uppercase bg-zinc-50/50">
                <th className="py-4 px-6 font-bold">USUARIO</th>
                <th className="py-4 px-6 font-bold">CONSUMO</th>
                <th className="py-4 px-6 font-bold">MONTO</th>
                <th className="py-4 px-6 font-bold">ESTADO</th>
                <th className="py-4 px-6 font-bold text-right md:text-left">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredInvoices && filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => {
                  const isPaid = inv.status === 'paid';
                  const total = inv.bill_details?.total || 0;

                  return (
                    <tr 
                      key={inv.id || inv.uuid} 
                      className="hover:bg-zinc-50/70 transition-colors group"
                    >
                      {/* Usuario */}
                      <td className="py-4 px-6">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-zinc-900 leading-snug">
                              {inv.userName}
                            </p>
                            {inv.tipo_factura === 'reconexion' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                Reconexión
                              </span>
                            )}
                            {inv.es_primera_factura && inv.tipo_factura !== 'reconexion' && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-100 text-blue-800 border border-blue-200">
                                Conexión
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 font-medium mt-0.5">
                            {formatDate(inv.date)} • Medidor: {inv.meterId}
                          </p>
                        </div>
                      </td>

                      {/* Consumo */}
                      <td className="py-4 px-6">
                        <span className="text-sm text-zinc-700 font-medium">
                          {inv.consumption} m³
                        </span>
                      </td>

                      {/* Monto */}
                      <td className="py-4 px-6">
                        <span className="text-sm font-black text-zinc-900">
                          {total.toFixed(2)} Bs
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="py-4 px-6">
                        {isPaid ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#ecfdf5] text-[#059669]">
                            Pagada
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#fef9c3] text-[#ca8a04]">
                            Pendiente
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5 justify-end md:justify-start">
                          {/* Ver Comprobante Digital */}
                          <button
                            onClick={() => navigate(`/recibo/${inv.factura_id || inv.id}`)}
                            title="Ver Comprobante Digital"
                            className="px-2.5 py-1.5 text-zinc-600 hover:text-blue-600 hover:bg-blue-50 border border-zinc-200 rounded-xl transition-all active:scale-95 text-xs font-bold flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5 text-blue-600" />
                            <span className="hidden xl:inline">Comprobante</span>
                          </button>

                          {/* Imprimir Ticket 80mm */}
                          <button
                            onClick={() => navigate(`/recibo/${inv.factura_id || inv.id}?mode=ticket`)}
                            title="Imprimir Ticket Térmico 80mm"
                            className="px-2.5 py-1.5 text-zinc-600 hover:text-emerald-700 hover:bg-emerald-50 border border-zinc-200 rounded-xl transition-all active:scale-95 text-xs font-bold flex items-center gap-1"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden xl:inline">Ticket 80mm</span>
                          </button>

                          {/* Botón Cobrar (solo para facturas pendientes) */}
                          {!isPaid && (
                            <button
                              onClick={() => setPayingReading(inv)}
                              className="ml-1 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-blue-200 transition-all active:scale-95 flex items-center gap-1"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              Cobrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-zinc-400 font-medium">
                    <FileText className="w-10 h-10 mx-auto text-zinc-300 mb-3" />
                    No se encontraron facturas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cobro Completo (Efectivo con vuelto / QR Banco FIE / QR Altoke) */}
      {payingReading && (
        <PaymentModal
          isOpen={!!payingReading}
          onClose={() => setPayingReading(null)}
          onConfirmPayment={handleConfirmPaymentModal}
          invoiceData={{
            id: payingReading.id || '',
            factura_id: payingReading.factura_id,
            userName: payingReading.userName,
            meterId: payingReading.meterId,
            total: payingReading.bill_details?.total || 0
          }}
        />
      )}
    </div>
  );
}
