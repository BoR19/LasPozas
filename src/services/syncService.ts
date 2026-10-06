import { db as localDb } from '../database/db';
import { db as firestoreDb } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

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

    // Pull remote changes
    await this.pullSync();
  },

  async pullSync() {
    const collections = ['users', 'readings', 'tarifas'];
    for (const colName of collections) {
      try {
        const querySnapshot = await getDocs(collection(firestoreDb, colName));
        for (const doc of querySnapshot.docs) {
          const data = doc.data();
          // Update local DB if not exists or if remote version is newer
          const existing = await (localDb as any)[colName].where('uuid').equals(data.uuid).first();
          
          const objToPut = { ...data };
          if (existing) {
            objToPut.id = existing.id;
          } else if (!objToPut.id) {
            // Si es 'users' y falta 'id', intentamos usar 'uuid' o generar uno nuevo si fuera necesario.
            // Para otras tablas con '++id', Dexie maneja la autoincrementación si 'id' es undefined.
            if (colName === 'users') {
                objToPut.id = data.id || data.uuid;
            }
          }

          if (!existing || (data.updated_at > existing.updated_at)) {
            await (localDb as any)[colName].put(objToPut);
          }
        }
      } catch (error) {
        console.error(`Error pulling ${colName}:`, error);
      }
    }
  }
};
