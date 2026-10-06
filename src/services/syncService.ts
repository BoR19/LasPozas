import { db } from '../database/db';

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

    await db.pending_sync.add({
      type,
      data: JSON.stringify(processedData),
      status: 'pending',
      created_at: Date.now()
    });
    this.triggerSync();
  },

  async triggerSync() {
    if (!navigator.onLine) return;
    
    const pending = await db.pending_sync.where('status').equals('pending').toArray();
    if (pending.length === 0) return;

    // Batch sync
    const grouped = pending.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [type, items] of Object.entries(grouped)) {
      try {
        const response = await fetch(`/api/sync/${type}s`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items.map(i => JSON.parse(i.data)))
        });
        
        if (response.ok) {
          await db.pending_sync.bulkUpdate(items.map(i => ({ key: i.id!, changes: { status: 'synced' } })));
        }
      } catch (error) {
        console.error(`Error syncing ${type}:`, error);
      }
    }
  }
};
