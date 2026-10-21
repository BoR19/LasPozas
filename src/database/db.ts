import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export type UserCategory = 'Residencial' | 'Residencial Social' | 'Comercial' | 'Industrial';

export interface User {
  id: string;
  name: string;
  address: string;
  meter_id: string;
  category: UserCategory;
  createdAt: number;
  uuid: string;
  updated_at: number;
  version: number;
}

export interface Meter {
  id: string; // e.g. MET-XXXX
  meter_id: string;
  user_id: string;
  categoria?: UserCategory;
  lectura_inicial?: number;
  fecha_instalacion?: number;
  estado?: string;
  uuid: string;
  updated_at: number;
  version: number;
}

export interface Reading {
  id?: number;
  user_id: string;
  medidor_id?: string;
  factura_id?: string;
  previous_reading: number;
  current_reading: number;
  consumption: number;
  date: number;
  status: 'paid' | 'pending' | 'overdue';
  bill_details?: {
    water_cost: number;
    fixed_charge: number;
    sewer_cost: number;
    total: number;
    tariff_id?: number;
  };
  imagen?: Blob;
  uuid: string;
  updated_at: number;
  version: number;
}

export interface Invoice {
  id?: number;
  factura_id: string;
  total: number;
  consumo: number;
  estado: 'pendiente' | 'pagado' | 'anulado';
  usuario_id: string;
  user_id: string;
  medidor_id: string;
  lectura_id: number | string;
  fecha: number;
  date: number;
  bill_details?: {
    water_cost: number;
    fixed_charge: number;
    sewer_cost: number;
    total: number;
    tariff_id?: number;
  };
  uuid: string;
  updated_at: number;
  version: number;
}

export interface Tariff {
  id?: number;
  categoria: UserCategory;
  cargo_fijo_mensual: number;
  costo_m3_base: number; // 0-20 m3
  costo_m3_exceso: number; // >20 m3
  tarifa_conexion: number;
  porcentaje_alcantarillado: number;
  fecha_inicio: number;
  fecha_fin: number;
  uuid: string;
  updated_at: number;
  version: number;
}

export interface Staff {
  id?: number;
  username: string;
  password: string; // Simple local password
  role: 'admin' | 'lector';
  name: string;
  uuid: string;
  updated_at: number;
  version: number;
}

export interface PendingSync {
  id?: number;
  type: 'reading' | 'user' | 'tarifa' | 'staff' | 'medidor' | 'factura';
  data: string; // JSON string
  status: 'pending' | 'synced';
  created_at: number;
}

export class AppDatabase extends Dexie {
  users!: Table<User>;
  medidores!: Table<Meter>;
  readings!: Table<Reading>;
  facturas!: Table<Invoice>;
  tariffs!: Table<Tariff>;
  staff!: Table<Staff>;
  pending_sync!: Table<PendingSync>;

  constructor() {
    super('AquaLecturaDB');
    this.version(5).stores({
      users: 'id, name, meter_id, category, uuid',
      readings: '++id, user_id, date, status, uuid',
      tariffs: '++id, categoria, fecha_inicio, fecha_fin, uuid',
      staff: '++id, username, role, uuid',
      pending_sync: '++id, type, status, created_at'
    });

    this.version(6).stores({
      users: 'id, name, meter_id, category, uuid',
      medidores: 'id, meter_id, user_id, uuid',
      readings: '++id, user_id, medidor_id, date, status, uuid, factura_id',
      facturas: '++id, factura_id, usuario_id, user_id, medidor_id, lectura_id, fecha, estado, uuid',
      tariffs: '++id, categoria, fecha_inicio, fecha_fin, uuid',
      staff: '++id, username, role, uuid',
      pending_sync: '++id, type, status, created_at'
    }).upgrade(async (tx) => {
      // Migrar lecturas existentes a facturas
      try {
        const readings = await tx.table('readings').toArray();
        for (const r of readings) {
          if (!r.factura_id) {
            const facId = `FAC-${r.id || Date.now()}`;
            await tx.table('readings').update(r.id, { factura_id: facId });
            await tx.table('facturas').add({
              factura_id: facId,
              total: r.bill_details?.total ?? 0,
              consumo: r.consumption ?? 0,
              estado: r.status === 'paid' ? 'pagado' : 'pendiente',
              usuario_id: r.user_id,
              user_id: r.user_id,
              medidor_id: r.medidor_id || 'MET-S/N',
              lectura_id: r.id,
              fecha: r.date || Date.now(),
              date: r.date || Date.now(),
              bill_details: r.bill_details || {
                water_cost: 0,
                fixed_charge: 0,
                sewer_cost: 0,
                total: 0
              },
              uuid: r.uuid || uuidv4(),
              updated_at: Date.now(),
              version: 1
            });
          }
        }
      } catch (err) {
        console.warn('Upgrade error in version 6:', err);
      }
    });
  }
}

export const db = new AppDatabase();

// Password obfuscation (Safe against UTF-8 and special characters)
export const encodePassword = (password: string) => {
  try {
    return btoa(encodeURIComponent(password));
  } catch {
    try {
      return btoa(password);
    } catch {
      return password;
    }
  }
};

export const decodePassword = (encoded: string) => {
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    try {
      return atob(encoded);
    } catch {
      return encoded;
    }
  }
};

// Initial data for tariffs and admin
export async function seedDatabase() {
  const defaultTariffs: Omit<Tariff, 'id' | 'uuid' | 'updated_at' | 'version'>[] = [
    {
      categoria: 'Residencial Social',
      cargo_fijo_mensual: 3,
      costo_m3_base: 0.50,
      costo_m3_exceso: 0.80,
      tarifa_conexion: 50,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date('2024-01-01').getTime(),
      fecha_fin: new Date('2030-12-31').getTime()
    },
    {
      categoria: 'Residencial',
      cargo_fijo_mensual: 7,
      costo_m3_base: 1.20,
      costo_m3_exceso: 1.80,
      tarifa_conexion: 100,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date('2024-01-01').getTime(),
      fecha_fin: new Date('2030-12-31').getTime()
    },
    {
      categoria: 'Comercial',
      cargo_fijo_mensual: 17,
      costo_m3_base: 2.50,
      costo_m3_exceso: 3.50,
      tarifa_conexion: 200,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date('2024-01-01').getTime(),
      fecha_fin: new Date('2030-12-31').getTime()
    },
    {
      categoria: 'Industrial',
      cargo_fijo_mensual: 40,
      costo_m3_base: 4.00,
      costo_m3_exceso: 6.00,
      tarifa_conexion: 500,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date('2024-01-01').getTime(),
      fecha_fin: new Date('2030-12-31').getTime()
    }
  ];

  for (const tariff of defaultTariffs) {
    const existing = await db.tariffs
      .where('categoria')
      .equals(tariff.categoria)
      .first();
    
    if (!existing) {
      await db.tariffs.add({
        ...tariff,
        uuid: uuidv4(),
        updated_at: Date.now(),
        version: 1
      });
    }
  }

  // Ensure default admin exists without deleting any user-created staff or admins
  const defaultAdmin = await db.staff.where('username').equals('@dmin&').first();
  if (!defaultAdmin) {
    await db.staff.add({
      username: '@dmin&',
      password: encodePassword('@dmin&1#'),
      role: 'admin',
      name: 'Administrador',
      uuid: 'default-admin-tolomosita-oeste',
      updated_at: 1704067200000,
      version: 1
    });
  }

  // Normalize staff passwords safely
  const allStaff = await db.staff.toArray();
  for (const s of allStaff) {
    if (!s.password) continue;
    try {
      const decoded = decodePassword(s.password);
      if (decoded === s.password && s.password.length > 0) {
        await db.staff.update(s.id!, { password: encodePassword(s.password) });
      }
    } catch {
      await db.staff.update(s.id!, { password: encodePassword(s.password) });
    }
  }

  // Asegurar que cada lectura previa tenga su factura asociada en db.facturas
  try {
    const readings = await db.readings.toArray();
    for (const r of readings) {
      if (r.id) {
        const existingFac = await db.facturas.where('lectura_id').equals(r.id).first();
        if (!existingFac) {
          const facId = r.factura_id || `FAC-${r.id}`;
          if (!r.factura_id) {
            await db.readings.update(r.id, { factura_id: facId });
          }
          await db.facturas.add({
            factura_id: facId,
            total: r.bill_details?.total ?? 0,
            consumo: r.consumption ?? 0,
            estado: r.status === 'paid' ? 'pagado' : 'pendiente',
            usuario_id: r.user_id,
            user_id: r.user_id,
            medidor_id: r.medidor_id || 'MET-S/N',
            lectura_id: r.id,
            fecha: r.date || Date.now(),
            date: r.date || Date.now(),
            bill_details: r.bill_details || {
              water_cost: 0,
              fixed_charge: 0,
              sewer_cost: 0,
              total: 0
            },
            uuid: r.uuid || uuidv4(),
            updated_at: Date.now(),
            version: 1
          });
        }
      }
    }
  } catch (migrErr) {
    console.warn('Error sincronizando facturas existentes:', migrErr);
  }
}

export async function changePassword(staffId: number, currentPassword: string, newPassword: string) {
  const staff = await db.staff.get(staffId);
  if (!staff) throw new Error('Usuario no encontrado');

  const matchesCurrent = 
    staff.password === currentPassword ||
    staff.password === encodePassword(currentPassword) ||
    decodePassword(staff.password) === currentPassword;

  if (!matchesCurrent) {
    throw new Error('Contraseña actual incorrecta');
  }

  await db.staff.update(staffId, { 
    password: encodePassword(newPassword),
    updated_at: Date.now()
  });
}
