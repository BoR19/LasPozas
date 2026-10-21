import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { syncService } from '../services/syncService';

interface SyncIndicatorProps {
  className?: string;
  showText?: boolean;
}

export default function SyncIndicator({ className = '', showText = false }: SyncIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      syncService.triggerSync().finally(() => {
        setTimeout(() => setIsSyncing(false), 1500);
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check or sync trigger
    const interval = setInterval(() => {
      if (navigator.onLine && !isSyncing) {
        setIsOnline(true);
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isSyncing]);

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold select-none transition-all ${
        !isOnline 
          ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : isSyncing
            ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
      } ${className}`}
      title={
        !isOnline 
          ? 'Modo Offline (los cambios se guardan localmente)' 
          : isSyncing 
            ? 'Sincronizando con la nube...' 
            : 'Conectado y sincronizado'
      }
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          {showText && <span className="text-[11px] font-bold">Sin conexión</span>}
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin shrink-0" />
          {showText && <span className="text-[11px] font-bold">Sincronizando...</span>}
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          {showText && <span className="text-[11px] font-bold">En línea</span>}
        </>
      )}
    </div>
  );
}
