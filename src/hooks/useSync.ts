import { useEffect } from 'react';
import { syncService } from '../services/syncService';

export function useSync() {
  useEffect(() => {
    const handleOnline = () => {
      console.log('Online, syncing data...');
      syncService.triggerSync();
    };

    window.addEventListener('online', handleOnline);
    
    // Initial sync check
    if (navigator.onLine) {
      syncService.triggerSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);
}
