import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { type Reading, type User, type Tariff } from '../database/db';
import { cargarRecibo } from '../services/billingService';
import Receipt from '../components/Receipt/Receipt';
import TicketTermico80 from '../components/Receipt/TicketTermico80';
import { ArrowLeft, RefreshCw, AlertCircle, FileText, Printer } from 'lucide-react';

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialMode = searchParams.get('mode') === 'ticket' ? 'ticket' : 'comprobante';
  const [viewMode, setViewMode] = useState<'comprobante' | 'ticket'>(initialMode);

  const [data, setData] = useState<{ reading: Reading; user: User; tariff: Tariff } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        console.log('[ReceiptPage] Cargando recibo/factura para identificador:', id);
        const result = await cargarRecibo(id);
        setData({
          reading: result.reading,
          user: result.user,
          tariff: result.tariff
        });
      } catch (err: any) {
        console.error('[ReceiptPage] Error real capturado al cargar el recibo:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido al cargar el recibo');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-100 max-w-md mx-auto text-center space-y-4 mt-12">
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-black text-red-600">Error al cargar el recibo</h2>
        <p className="text-zinc-600 text-sm">{error || 'No se pudieron cargar los datos necesarios.'}</p>
        <button 
          onClick={() => navigate(-1)}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all text-sm"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Botón Volver y Selector de Formatos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-lg mx-auto print:hidden">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-500 font-bold hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>

        {/* Dos botones solicitados: Ver Comprobante y Imprimir Ticket 80mm */}
        <div className="flex items-center gap-2 p-1 bg-zinc-200/70 rounded-2xl">
          <button
            onClick={() => {
              setViewMode('comprobante');
              setSearchParams({});
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
              viewMode === 'comprobante'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            Ver Comprobante
          </button>
          <button
            onClick={() => {
              setViewMode('ticket');
              setSearchParams({ mode: 'ticket' });
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
              viewMode === 'ticket'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            Imprimir Ticket 80mm
          </button>
        </div>
      </div>

      {/* Renderizado Condicional del Formato Seleccionado */}
      {viewMode === 'comprobante' ? (
        <Receipt reading={data.reading} user={data.user} tariff={data.tariff} />
      ) : (
        <TicketTermico80 reading={data.reading} user={data.user} tariff={data.tariff} />
      )}
    </div>
  );
}
