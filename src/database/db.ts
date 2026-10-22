import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';

export type UserCategory = 'Residencial' | 'Residencial Social' | 'Comercial' | 'Industrial';
export type UserStatus = 'activo' | 'suspendido' | 'baja';

export interface User {
  id: string;
  name: string;
  address: string;
  meter_id: string;
  category: UserCategory;
  estado?: UserStatus;
  motivo_suspension?: string;
  fecha_suspension?: number | null;
  fecha_reactivacion?: number | null;
  createdAt: number;
  uuid: string;
  updated_at: number;
  version: number;
  deleted?: boolean;
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

export interface InvoiceDetalle {
  cargo_fijo: number;
  conexion: number;
  costo_conexion?: number;
  reconexion?: number;
  costo_reconexion?: number;
  tipo_factura?: 'regular' | 'primera' | 'reconexion';
  es_reconexion?: boolean;
  consumo_m3: number;
  consumo_base: number;
  monto_base: number;
  consumo_exceso: number;
  monto_exceso: number;
  costo_consumo: number;
  es_primera_factura: boolean;
  total: number;
  tarifa_aplicada?: {
    categoria: UserCategory;
    cargo_fijo: number;
    conexion: number;
    reconexion?: number;
    base: number;
    exceso: number;
  };
}

export interface Reading {
  id?: number;
  user_id: string;
  medidor_id?: string;
  factura_id?: string;
  tipo_factura?: 'regular' | 'primera' | 'reconexion';
  es_primera_factura?: boolean;
  es_reconexion?: boolean;
  previous_reading: number;
  current_reading: number;
  consumption: number;
  date: number;
  status: 'paid' | 'pending' | 'overdue';
  estado_pago?: 'pendiente' | 'pagado';
  metodo_pago?: 'efectivo' | 'qr_fie' | 'qr_altoke';
  fecha_pago?: number | null;
  monto_recibido?: number;
  cambio?: number;
  desglose?: InvoiceDesglose;
  detalle?: InvoiceDetalle;
  bill_details?: {
    water_cost: number;
    fixed_charge: number;
    sewer_cost: number;
    conexion?: number;
    costo_conexion?: number;
    reconexion?: number;
    costo_reconexion?: number;
    tipo_factura?: 'regular' | 'primera' | 'reconexion';
    es_reconexion?: boolean;
    consumo_base?: number;
    monto_base?: number;
    consumo_exceso?: number;
    monto_exceso?: number;
    es_primera_factura?: boolean;
    total: number;
    tariff_id?: number;
    detalle?: InvoiceDetalle;
  };
  imagen?: Blob;
  uuid: string;
  updated_at: number;
  version: number;
}

export interface InvoiceDesglose {
  cargo_fijo: number;
  conexion: number;
  reconexion: number;
  base_m3: number;
  base_costo: number;
  exceso_m3: number;
  exceso_costo: number;
  consumo_m3?: number;
  costo_consumo?: number;
  total?: number;
}

export interface Invoice {
  id?: number;
  factura_id: string;
  tipo?: 'nueva' | 'normal' | 'reconexion';
  tipo_factura?: 'nueva' | 'normal' | 'reconexion' | 'regular' | 'primera';
  es_primera_factura?: boolean;
  es_reconexion?: boolean;
  total: number;
  consumo: number;
  estado: 'pendiente' | 'pagado' | 'anulado';
  estado_pago?: 'pendiente' | 'pagado';
  metodo_pago?: 'efectivo' | 'qr_fie' | 'qr_altoke';
  fecha_pago?: number | null;
  monto_recibido?: number;
  cambio?: number;
  usuario_id: string;
  user_id: string;
  medidor_id: string;
  lectura_id: number | string;
  fecha: number;
  date: number;
  nombre?: string;
  zona?: string;
  categoria?: UserCategory;
  lectura_anterior?: number;
  lectura_actual?: number;
  desglose?: InvoiceDesglose;
  detalle?: InvoiceDetalle;
  bill_details?: {
    water_cost: number;
    fixed_charge: number;
    sewer_cost: number;
    conexion?: number;
    costo_conexion?: number;
    reconexion?: number;
    costo_reconexion?: number;
    tipo_factura?: 'regular' | 'primera' | 'reconexion';
    es_reconexion?: boolean;
    consumo_base?: number;
    monto_base?: number;
    consumo_exceso?: number;
    monto_exceso?: number;
    es_primera_factura?: boolean;
    total: number;
    tariff_id?: number;
    detalle?: InvoiceDetalle;
  };
  uuid: string;
  updated_at: number;
  version: number;
}

export interface Tariff {
  id?: number;
  categoria: UserCategory;
  cargo_fijo_mensual: number;
  cargo_fijo?: number;
  costo_m3_base: number; // 0-20 m3
  base?: number;
  costo_m3_exceso: number; // >20 m3
  exceso?: number;
  tarifa_conexion: number;
  conexion?: number;
  tarifa_reconexion?: number; // Reconexión = 50% de conexión
  reconexion?: number;
  porcentaje_alcantarillado: number;
  fecha_inicio: number;
  fecha_fin: number;
  activa?: boolean;
  uuid: string;
  updated_at: number;
  version: number;
}

export interface PaymentConfig {
  id: string; // 'pagos'
  qr_fie_url: string;
  qr_altoke_url: string;
  titular: string;
  banco: string;
  cuenta?: string;
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
  type: 'reading' | 'user' | 'tarifa' | 'staff' | 'medidor' | 'factura' | 'configuracion';
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
  configuracion!: Table<PaymentConfig>;
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

    this.version(7).stores({
      users: 'id, name, meter_id, category, estado, uuid',
      medidores: 'id, meter_id, user_id, uuid',
      readings: '++id, user_id, medidor_id, date, status, uuid, factura_id',
      facturas: '++id, factura_id, usuario_id, user_id, medidor_id, lectura_id, fecha, estado, uuid',
      tariffs: '++id, categoria, fecha_inicio, fecha_fin, uuid',
      staff: '++id, username, role, uuid',
      pending_sync: '++id, type, status, created_at'
    }).upgrade(async (tx) => {
      try {
        const users = await tx.table('users').toArray();
        for (const u of users) {
          if (!u.estado) {
            await tx.table('users').update(u.id, { estado: 'activo' });
          }
        }
      } catch (err) {
        console.warn('Upgrade error in version 7:', err);
      }
    });

    this.version(8).stores({
      users: 'id, name, meter_id, category, estado, uuid',
      medidores: 'id, meter_id, user_id, uuid',
      readings: '++id, user_id, medidor_id, date, status, uuid, factura_id',
      facturas: '++id, factura_id, usuario_id, user_id, medidor_id, lectura_id, tipo, fecha, estado, estado_pago, uuid',
      tariffs: '++id, categoria, fecha_inicio, fecha_fin, activa, uuid',
      staff: '++id, username, role, uuid',
      configuracion: 'id, uuid, updated_at',
      pending_sync: '++id, type, status, created_at'
    }).upgrade(async (tx) => {
      try {
        const tariffs = await tx.table('tariffs').toArray();
        for (const t of tariffs) {
          if (t.activa === undefined) {
            const now = Date.now();
            const isCurrentlyActive = t.fecha_inicio <= now && t.fecha_fin >= now;
            await tx.table('tariffs').update(t.id, {
              activa: isCurrentlyActive,
              cargo_fijo: t.cargo_fijo_mensual,
              conexion: t.tarifa_conexion,
              reconexion: t.tarifa_reconexion ?? Math.round(t.tarifa_conexion * 0.5 * 100) / 100,
              base: t.costo_m3_base,
              exceso: t.costo_m3_exceso
            });
          }
        }

        const facturas = await tx.table('facturas').toArray();
        for (const f of facturas) {
          const updates: any = {};
          if (!f.estado_pago) updates.estado_pago = f.estado === 'pagado' ? 'pagado' : 'pendiente';
          if (!f.tipo) updates.tipo = f.es_reconexion ? 'reconexion' : f.es_primera_factura ? 'nueva' : 'normal';
          if (Object.keys(updates).length > 0) {
            await tx.table('facturas').update(f.id, updates);
          }
        }
      } catch (err) {
        console.warn('Upgrade error in version 8:', err);
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
      cargo_fijo: 3,
      costo_m3_base: 0.50,
      base: 0.50,
      costo_m3_exceso: 0.80,
      exceso: 0.80,
      tarifa_conexion: 50,
      conexion: 50,
      tarifa_reconexion: 25,
      reconexion: 25,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date('2023-12-31').getTime(),
      fecha_fin: new Date('2030-12-30T23:59:59').getTime(),
      activa: true
    },
    {
      categoria: 'Residencial',
      cargo_fijo_mensual: 7,
      cargo_fijo: 7,
      costo_m3_base: 1.20,
      base: 1.20,
      costo_m3_exceso: 1.80,
      exceso: 1.80,
      tarifa_conexion: 100,
      conexion: 100,
      tarifa_reconexion: 50,
      reconexion: 50,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date('2023-12-31').getTime(),
      fecha_fin: new Date('2030-12-30T23:59:59').getTime(),
      activa: true
    },
    {
      categoria: 'Comercial',
      cargo_fijo_mensual: 17,
      cargo_fijo: 17,
      costo_m3_base: 2.50,
      base: 2.50,
      costo_m3_exceso: 3.50,
      exceso: 3.50,
      tarifa_conexion: 200,
      conexion: 200,
      tarifa_reconexion: 100,
      reconexion: 100,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date('2023-12-31').getTime(),
      fecha_fin: new Date('2030-12-30T23:59:59').getTime(),
      activa: true
    },
    {
      categoria: 'Industrial',
      cargo_fijo_mensual: 40,
      cargo_fijo: 40,
      costo_m3_base: 4.00,
      base: 4.00,
      costo_m3_exceso: 6.00,
      exceso: 6.00,
      tarifa_conexion: 500,
      conexion: 500,
      tarifa_reconexion: 250,
      reconexion: 250,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date('2023-12-31').getTime(),
      fecha_fin: new Date('2030-12-30T23:59:59').getTime(),
      activa: true
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
    } else {
      // Sincronizar tarifas vigentes
      await db.tariffs.update(existing.id!, {
        cargo_fijo_mensual: tariff.cargo_fijo_mensual,
        cargo_fijo: tariff.cargo_fijo,
        tarifa_conexion: tariff.tarifa_conexion,
        conexion: tariff.conexion,
        tarifa_reconexion: tariff.tarifa_reconexion,
        reconexion: tariff.reconexion,
        costo_m3_base: tariff.costo_m3_base,
        base: tariff.base,
        costo_m3_exceso: tariff.costo_m3_exceso,
        exceso: tariff.exceso,
        fecha_inicio: tariff.fecha_inicio,
        fecha_fin: tariff.fecha_fin,
        activa: existing.activa !== undefined ? existing.activa : true,
        updated_at: Date.now()
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

  // Asegurar que todos los usuarios tengan estado 'activo' por defecto
  try {
    const allUsers = await db.users.toArray();
    for (const u of allUsers) {
      if (!u.estado) {
        await db.users.update(u.id, { estado: 'activo' });
      }
    }
  } catch (uErr) {
    console.warn('Error actualizando estados de usuarios:', uErr);
  }

  // Asegurar que exista configuración de pagos (FIE y Altoke)
  try {
    const existingConfig = await db.configuracion.get('pagos');
    if (!existingConfig) {
      await db.configuracion.add({
        id: 'pagos',
        qr_fie_url: '',
        qr_altoke_url: '',
        titular: 'Comité de Agua Potable Tolomosita Oeste',
        banco: 'Banco FIE S.A. / Altoke',
        cuenta: 'Cuenta Corriente / Ahorros',
        uuid: 'config-pagos-tolomosita-oeste',
        updated_at: Date.now(),
        version: 1
      });
    }
  } catch (cfgErr) {
    console.warn('Error inicializando configuracion de pagos:', cfgErr);
  }
}

export async function getPaymentConfig(): Promise<PaymentConfig> {
  const cfg = await db.configuracion.get('pagos');
  if (cfg) return cfg;
  return {
    id: 'pagos',
    qr_fie_url: '',
    qr_altoke_url: '',
    titular: 'Comité de Agua Potable Tolomosita Oeste',
    banco: 'Banco FIE S.A. / Altoke',
    cuenta: 'Cuenta Corriente / Ahorros',
    uuid: 'config-pagos-tolomosita-oeste',
    updated_at: Date.now(),
    version: 1
  };
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
