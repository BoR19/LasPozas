import React, { useState } from 'react';
import { db, type User, type Reading } from '../database/db';
import { formatCurrency, formatDate } from '../lib/utils';
import { Search, Droplets, Receipt as ReceiptIcon, AlertCircle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ConsultationPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ user: User; readings: Reading[] } | null>(null);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setError('');
    setResult(null);
    setIsSearching(true);

    try {
      const user = await db.users
        .filter(u => u.id === query || u.meter_id === query)
        .first();

      if (user && user.id) {
        const readings = await db.readings
          .where('user_id')
          .equals(user.id)
          .reverse()
          .sortBy('date');
        setResult({ user, readings });
      } else {
        setError('No se encontró ningún usuario con ese ID o Medidor.');
      }
    } catch (err) {
      setError('Error al buscar. Intente de nuevo.');
    } finally {
      setIsSearching(false);
    }
  };

  const getStatusInfo = (reading: Reading) => {
    if (reading.status === 'paid') {
      return { label: 'Pagado', color: 'text-green-500', bg: 'bg-green-50', icon: CheckCircle2 };
    }
    
    // Check if overdue (e.g., more than 30 days since reading)
    const readingDate = new Date(reading.date);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - readingDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 30) {
      return { label: 'Vencido', color: 'text-red-500', bg: 'bg-red-50', icon: AlertCircle };
    }
    
    return { label: 'Pendiente', color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock };
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4 md:py-8">
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-200">
          <Droplets className="w-10 h-10" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight">Consulta de Deuda</h1>
        <p className="text-zinc-500 font-medium px-4">Ingrese su número de medidor o código de cliente para ver sus facturas.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-zinc-100 space-y-6">
        <form onSubmit={handleSearch} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em] ml-1">Número de Medidor o Cliente</label>
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text"
                placeholder="Ej: MET-12345"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-14 pr-4 py-6 bg-zinc-50 border-2 border-zinc-200 rounded-[2rem] text-xl font-black focus:outline-none focus:border-blue-500 transition-all placeholder:text-zinc-300"
              />
            </div>
          </div>
          <button 
            type="submit"
            disabled={isSearching}
            className="w-full py-6 bg-blue-600 text-white text-xl font-black rounded-[2rem] hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-3 shadow-xl shadow-blue-100"
          >
            {isSearching ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
            Buscar Facturas
          </button>
        </form>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5" />
            <p className="font-bold text-sm">{error}</p>
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-zinc-200 shadow-sm space-y-6">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Cliente</p>
                <h2 className="text-xl font-black text-zinc-900">{result.user.name}</h2>
                <p className="text-sm text-zinc-500 font-medium">{result.user.address}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Medidor</p>
                <p className="text-xl font-black text-zinc-900">{result.user.meter_id}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest ml-4">Historial de Facturación</h3>
            <div className="space-y-3">
              {result.readings.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-[2.5rem] border border-zinc-100">
                  <ReceiptIcon className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                  <p className="text-zinc-400 font-bold">No hay facturas registradas</p>
                </div>
              ) : (
                result.readings.map(reading => {
                  const status = getStatusInfo(reading);
                  return (
                    <div 
                      key={reading.id}
                      className="bg-white p-5 rounded-[2rem] border border-zinc-200 flex items-center justify-between hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center",
                          status.bg, status.color
                        )}>
                          <status.icon className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-zinc-900">{formatDate(reading.date)}</p>
                          <p className="text-xs text-zinc-500 font-medium">Consumo: {reading.consumption} m³</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-zinc-900">{formatCurrency(reading.bill_details?.total || 0)}</p>
                        <p className={cn(
                          "text-[10px] font-black uppercase tracking-widest",
                          status.color
                        )}>
                          {status.label}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
