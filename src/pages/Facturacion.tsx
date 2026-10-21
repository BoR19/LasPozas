import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Reading, type User } from '../database/db';
import { syncService } from '../services/syncService';
import { formatCurrency, formatDate } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
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

  const handleCobrar = async (invoice: EnrichedInvoice) => {
    if (!invoice.id) return;
    setIsProcessingPayment(true);
    try {
      await db.readings.update(invoice.id, { 
        status: 'paid', 
        updated_at: Date.now() 
      });

      const updated = await db.readings.get(invoice.id);
      if (updated) {
        await syncService.addToQueue('reading', updated);
      }

      const fact = await db.facturas.where('lectura_id').equals(invoice.id).first();
      if (fact && fact.id) {
        await db.facturas.update(fact.id, { estado: 'pagado', updated_at: Date.now() });
        const updatedFact = await db.facturas.get(fact.id);
        if (updatedFact) {
          await syncService.addToQueue('factura', updatedFact);
        }
      }

      setPayingReading(null);
    } catch (error) {
      console.error('Error al cobrar factura:', error);
      alert('Error al registrar el cobro.');
    } finally {
      setIsProcessingPayment(false);
    }
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
                        <div className="flex items-center gap-2 justify-end md:justify-start">
                          {/* Descargar / Ver recibo */}
                          <button
                            onClick={() => navigate(`/recibo/${inv.factura_id || inv.id}`)}
                            title="Descargar o imprimir recibo"
                            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all active:scale-95"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Detalle del recibo */}
                          <button
                            onClick={() => navigate(`/recibo/${inv.factura_id || inv.id}`)}
                            title="Ver detalles de la factura"
                            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all active:scale-95"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>

                          {/* Botón Cobrar (solo para pendientes) */}
                          {!isPaid && (
                            <button
                              onClick={() => setPayingReading(inv)}
                              className="ml-1 px-4 py-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800 rounded-xl font-bold text-xs shadow-sm transition-all active:scale-95 hover:border-zinc-300"
                            >
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

      {/* Confirmation Modal for Cobrar */}
      {payingReading && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200 space-y-5">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mx-auto">
              <DollarSign className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-black text-zinc-900">Registrar Cobro</h3>
              <p className="text-xs text-zinc-500 font-medium">
                ¿Confirmas el cobro de esta factura de agua?
              </p>
            </div>

            <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">Usuario:</span>
                <span className="font-bold text-zinc-800">{payingReading.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400 font-medium">Consumo:</span>
                <span className="font-bold text-zinc-800">{payingReading.consumption} m³</span>
              </div>
              <div className="flex justify-between text-base border-t border-zinc-200 pt-2">
                <span className="font-bold text-zinc-600">Total a Cobrar:</span>
                <span className="font-black text-blue-600">
                  {(payingReading.bill_details?.total || 0).toFixed(2)} Bs
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPayingReading(null)}
                disabled={isProcessingPayment}
                className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleCobrar(payingReading)}
                disabled={isProcessingPayment}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 text-sm disabled:opacity-50"
              >
                {isProcessingPayment ? 'Procesando...' : 'Confirmar Cobro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
