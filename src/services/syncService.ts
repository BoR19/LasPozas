import { db as localDb } from '../database/db';
import { db as firestoreDb } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const syncService = {
  async addToQueue(type: 'reading' | 'user' | 'tarifa', data: any) {
    // Process data to convert Blobs to Base64
    const processedData = { ...data };
    if (processedData.imagen instanceof Blob) {
      processedData.imagen = await blobToBase64(processedData.imagen);
    }

    await localDb.pending_sync.add({
      type,
      data: JSON.stringify(processedData),
      status: 'pending',
      created_at: Date.now()
    });
    this.triggerSync();
  },

  async triggerSync() {
    if (!navigator.onLine) return;
    
    const pending = await localDb.pending_sync.where('status').equals('pending').toArray();
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        const data = JSON.parse(item.data);
        // Sync to Firestore
        await addDoc(collection(firestoreDb, `${item.type}s`), data);
        
        await localDb.pending_sync.update(item.id!, { status: 'synced' });
      } catch (error) {
        console.error(`Error syncing ${item.type}:`, error);
      }
    }
  }
};
