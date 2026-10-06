import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle } from 'lucide-react';

export default function SyncIndicator() {
  const [status, setStatus] = useState<'online' | 'offline' | 'syncing' | 'synced'>('online');

  useEffect(() => {
    const handleOnline = () => setStatus('online');
    const handleOffline = () => setStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50">
      {status === 'online' && <Wifi className="w-6 h-6 text-green-500" />}
      {status === 'offline' && <WifiOff className="w-6 h-6 text-red-500" />}
      {status === 'syncing' && <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />}
      {status === 'synced' && <CheckCircle className="w-6 h-6 text-green-500" />}
    </div>
  );
}
