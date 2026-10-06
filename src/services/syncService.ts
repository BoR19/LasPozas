import { db as localDb } from '../database/db';
import { db as firestoreDb } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, where, Timestamp } from 'firebase/firestore';

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
    
    // Push local changes
    const pending = await localDb.pending_sync.where('status').equals('pending').toArray();
    for (const item of pending) {
      try {
        const data = JSON.parse(item.data);
        await addDoc(collection(firestoreDb, `${item.type}s`), data);
        await localDb.pending_sync.update(item.id!, { status: 'synced' });
      } catch (error) {
        console.error(`Error syncing ${item.type}:`, error);
      }
    }
  },

  // Nueva función para iniciar listeners en tiempo real
  initRealtimeSync() {
    const collections = ['users', 'readings', 'tarifas'];
    
    collections.forEach(colName => {
      onSnapshot(collection(firestoreDb, colName), (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data();
            const existing = await (localDb as any)[colName].where('uuid').equals(data.uuid).first();
            
            if (!existing || (data.updated_at > existing.updated_at)) {
              const objToPut = { ...data };
              if (existing) objToPut.id = existing.id;
              else if (colName === 'users') objToPut.id = data.id || data.uuid;
              
              await (localDb as any)[colName].put(objToPut);
            }
          }
        });
      });
    });
  }
};
