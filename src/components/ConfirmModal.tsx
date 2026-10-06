import React, { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

export default function ConfirmModal({ isOpen, onClose, onConfirm, title = "¿Estás seguro?", message = "¿Seguro que deseas eliminar este registro?" }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-zinc-900">{title}</h2>
        </div>
        <p className="text-zinc-500 font-medium mb-8">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 py-3 font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }} 
            className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
