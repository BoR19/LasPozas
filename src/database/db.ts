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

export interface Reading {
  id?: number;
  user_id: string;
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
    tariff_id: number;
  };
  imagen?: Blob;
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
  tarifa_conexion: number; // New field
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
  type: 'reading' | 'user' | 'tarifa' | 'staff';
  data: string; // JSON string
  status: 'pending' | 'synced';
  created_at: number;
}

export class AppDatabase extends Dexie {
  users!: Table<User>;
  readings!: Table<Reading>;
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
    }).upgrade(tx => {
      // Data migration
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
      // Test if decode succeeds
      const decoded = decodePassword(s.password);
      if (decoded === s.password && s.password.length > 0) {
        // Plaintext detected, encode it
        await db.staff.update(s.id!, { password: encodePassword(s.password) });
      }
    } catch (e) {
      // If error occurred, encode as fallback
      await db.staff.update(s.id!, { password: encodePassword(s.password) });
    }
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
