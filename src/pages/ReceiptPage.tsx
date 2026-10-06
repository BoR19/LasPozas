import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, type Reading, type User } from '../database/db';
import Receipt from '../components/Receipt/Receipt';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<{ reading: Reading; user: User; tariff: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        setLoading(true);
        const readingId = parseInt(id);
        const reading = await db.readings.get(readingId);
        if (!reading) throw new Error('Recibo no encontrado');

        const user = await db.users.get(reading.user_id);
        if (!user) throw new Error('Usuario no encontrado');

        let tariff = null;
        if (reading.bill_details?.tariff_id) {
          tariff = await db.tariffs.get(reading.bill_details.tariff_id);
        }

        setData({ reading, user, tariff });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar');
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
        <h2 className="text-xl font-black text-red-600">Error</h2>
        <p className="text-zinc-600">{error || 'No se pudo cargar el recibo'}</p>
        <button 
          onClick={() => navigate(-1)}
          className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-zinc-800 transition-all"
        >
          Volver
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-zinc-500 font-bold hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      <Receipt reading={data.reading} user={data.user} tariff={data.tariff} />
    </div>
  );
}
