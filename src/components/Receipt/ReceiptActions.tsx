import React from 'react';
import { Printer, Share2, RefreshCw, Download } from 'lucide-react';

interface ReceiptActionsProps {
  onPrint: () => void;
  onShare: () => void;
  onDownload: () => void;
  isProcessing: 'sharing' | 'downloading' | null;
}

export default function ReceiptActions({ onPrint, onShare, onDownload, isProcessing }: ReceiptActionsProps) {
  return (
    <div className="flex flex-col items-center gap-4 print:hidden">
      <div className="grid grid-cols-3 gap-3 w-full">
        <button 
          onClick={onPrint}
          className="flex flex-col items-center justify-center gap-1 bg-zinc-900 text-white py-3 rounded-2xl font-bold text-xs hover:bg-zinc-800 transition-all active:scale-95 shadow-lg shadow-zinc-200"
        >
          <Printer className="w-5 h-5" />
          Imprimir
        </button>
        <button 
          onClick={onShare}
          disabled={!!isProcessing}
          className="flex flex-col items-center justify-center gap-1 bg-blue-600 text-white py-3 rounded-2xl font-bold text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-100 disabled:opacity-50"
        >
          {isProcessing === 'sharing' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
          Compartir
        </button>
        <button 
          onClick={onDownload}
          disabled={!!isProcessing}
          className="flex flex-col items-center justify-center gap-1 bg-emerald-600 text-white py-3 rounded-2xl font-bold text-xs hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100 disabled:opacity-50"
        >
          {isProcessing === 'downloading' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          Descargar
        </button>
      </div>
    </div>
  );
}
