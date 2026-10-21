import Dexie from 'dexie';
import { db as localDb } from '../database/db';
import { db as firestoreDb } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc 
} from 'firebase/firestore';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const getTable = (name: string) => {
  if (name === 'tarifa' || name === 'tarifas') return localDb.tariffs;
  if (name === 'user' || name === 'users') return localDb.users;
  if (name === 'reading' || name === 'readings') return localDb.readings;
  if (name === 'medidor' || name === 'medidores' || name === 'meters') return localDb.medidores;
  if (name === 'factura' || name === 'facturas' || name === 'invoices') return localDb.facturas;
  if (name === 'staff' || name === 'staffs') return localDb.staff;
  return (localDb as any)[name];
};

let syncTimeout: any = null;
let isSyncing = false;

export const syncService = {
  async addToQueue(type: 'reading' | 'user' | 'tarifa' | 'staff' | 'medidor' | 'factura', data: any) {
    const processedData = { ...data };
    if (processedData.imagen instanceof Blob) {
      processedData.imagen = await blobToBase64(processedData.imagen);
    }

    await Dexie.ignoreTransaction(async () => {
      await localDb.pending_sync.add({
        type,
        data: JSON.stringify(processedData),
        status: 'pending',
        created_at: Date.now()
      });
    });

    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    syncTimeout = setTimeout(() => {
      syncService.triggerSync().catch(err => console.error('Error en triggerSync:', err));
    }, 100);
  },

  async triggerSync() {
    if (!navigator.onLine) return;
    if (isSyncing) return;
    isSyncing = true;

    try {
      let pending: any[] = [];
      await Dexie.ignoreTransaction(async () => {
        pending = await localDb.pending_sync.where('status').equals('pending').toArray();
      });

      for (const item of pending) {
        try {
          const data = JSON.parse(item.data);
          const colName = 
            item.type === 'tarifa' ? 'tarifas' : 
            item.type === 'staff' ? 'staff' : 
            item.type === 'medidor' ? 'medidores' :
            item.type === 'factura' ? 'facturas' :
            `${item.type}s`;

          const itemUuid = data.uuid || data.id;

          if (itemUuid) {
            const docRef = doc(firestoreDb, colName, String(itemUuid));
            if (data.deleted) {
              await setDoc(docRef, {
                ...data,
                deleted: true,
                updated_at: data.updated_at || Date.now()
              }, { merge: true });

              // Limpiar posibles duplicados legados
              try {
                const q = query(collection(firestoreDb, colName), where('uuid', '==', itemUuid));
                const snap = await getDocs(q);
                for (const d of snap.docs) {
                  if (d.id !== itemUuid) {
                    await deleteDoc(d.ref);
                  }
                }
              } catch (cleanErr) {
                console.warn('Error limpiando duplicados legados:', cleanErr);
              }
            } else {
              await setDoc(docRef, data, { merge: true });

              // Limpiar duplicados legados
              try {
                const q = query(collection(firestoreDb, colName), where('uuid', '==', itemUuid));
                const snap = await getDocs(q);
                for (const d of snap.docs) {
                  if (d.id !== itemUuid) {
                    await deleteDoc(d.ref);
                  }
                }
              } catch (cleanErr) {
                console.warn('Error limpiando duplicados legados:', cleanErr);
              }
            }
          } else {
            await addDoc(collection(firestoreDb, colName), data);
          }

          if (item.id) {
            await Dexie.ignoreTransaction(async () => {
              await localDb.pending_sync.update(item.id, { status: 'synced' });
            });
          }
        } catch (error) {
          console.error(`Error syncing ${item.type}:`, error);
        }
      }
    } finally {
      isSyncing = false;
    }
  },

  initRealtimeSync() {
    const collections = ['users', 'readings', 'tarifas', 'staff', 'medidores', 'facturas'];
    
    collections.forEach(colName => {
      onSnapshot(collection(firestoreDb, colName), async (snapshot) => {
        const table = getTable(colName);
        if (!table) return;

        // Agrupar todos los documentos por UUID para resolver versiones y deduplicar
        const latestByUuid = new Map<string, { data: any; docId: string; ref: any }>();
        const staleDocsToDelete: any[] = [];

        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const uuid = data.uuid || docSnap.id;
          if (!uuid) return;

          const existingEntry = latestByUuid.get(uuid);
          if (!existingEntry) {
            latestByUuid.set(uuid, { data, docId: docSnap.id, ref: docSnap.ref });
          } else {
            const existingTime = existingEntry.data.updated_at || 0;
            const currentTime = data.updated_at || 0;
            if (currentTime >= existingTime) {
              staleDocsToDelete.push(existingEntry.ref);
              latestByUuid.set(uuid, { data, docId: docSnap.id, ref: docSnap.ref });
            } else {
              staleDocsToDelete.push(docSnap.ref);
            }
          }
        });

        // Limpiar documentos duplicados obsoletos en segundo plano
        if (staleDocsToDelete.length > 0) {
          staleDocsToDelete.forEach(ref => deleteDoc(ref).catch(() => {}));
        }

        // Aplicar el estado más reciente y certero para cada UUID
        for (const [uuid, { data }] of latestByUuid.entries()) {
          try {
            if (data.deleted) {
              const existing = await table.where('uuid').equals(uuid).first();
              if (existing) {
                await table.delete(existing.id);
              }
            } else {
              const existing = await table.where('uuid').equals(uuid).first();
              const remoteTime = data.updated_at || 0;
              const localTime = existing?.updated_at || 0;

              if (!existing || remoteTime >= localTime) {
                const objToPut = { ...data };
                if (existing) {
                  objToPut.id = existing.id;
                } else if (colName === 'users') {
                  objToPut.id = data.id || data.uuid;
                } else if (colName === 'medidores') {
                  objToPut.id = data.id || data.meter_id || data.uuid;
                } else {
                  delete objToPut.id;
                }
                delete objToPut.deleted;
                await table.put(objToPut);
              }
            }
          } catch (itemErr) {
            console.error(`Error procesando sync en ${colName}:`, itemErr);
          }
        }
      }, (error) => {
        console.error(`Error en realtime sync para ${colName}:`, error);
      });
    });
  }
};
