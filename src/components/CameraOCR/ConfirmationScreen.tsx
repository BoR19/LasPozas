import React, { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';

interface ConfirmationScreenProps {
  imageSrc: string;
  detectedNumber: string;
  onConfirm: (value: string) => void;
  onRetry: () => void;
}

export default function ConfirmationScreen({ imageSrc, detectedNumber, onConfirm, onRetry }: ConfirmationScreenProps) {
  const [value, setValue] = useState(detectedNumber);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6 space-y-6">
      <div className="w-full max-w-sm bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800">
        <img src={imageSrc} alt="Captura" className="w-full h-48 object-cover" />
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Número detectado</label>
            <input 
              type="number" 
              value={value} 
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 text-white text-xl font-bold rounded-xl focus:outline-none focus:border-blue-500 border border-zinc-700"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        <button 
          onClick={onRetry}
          className="flex items-center justify-center gap-2 py-4 bg-zinc-800 text-white rounded-2xl font-bold active:scale-95 transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          Reintentar
        </button>
        <button 
          onClick={() => onConfirm(value)}
          className="flex items-center justify-center gap-2 py-4 bg-green-600 text-white rounded-2xl font-bold active:scale-95 transition-all"
        >
          <Check className="w-5 h-5" />
          Confirmar
        </button>
      </div>
    </div>
  );
}
