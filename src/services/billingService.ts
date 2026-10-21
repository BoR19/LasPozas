import { db, type User, type Reading, type Tariff, type UserCategory, type Invoice, type Meter } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { generateId } from '../lib/utils';
import { syncService } from './syncService';

// calculateBill permite total 0.00 y no lanza error si tariff es nulo o indefinido
export function calculateBill(consumption: number, tariff?: Tariff | null, isFirstReading: boolean = false) {
  if (isFirstReading) {
    return {
      water_cost: 0,
      fixed_charge: 0,
      sewer_cost: 0,
      total: 0, // Permite explícitamente Bs 0,00 para la primera factura
      tariff_id: tariff?.id || 0
    };
  }

  const fixed_charge = tariff?.cargo_fijo_mensual ?? 0;
  const costo_m3_base = tariff?.costo_m3_base ?? 0;
  const costo_m3_exceso = tariff?.costo_m3_exceso ?? 0;
  const porcentaje = tariff?.porcentaje_alcantarillado ?? 20;

  let water_cost = 0;
  if (consumption <= 20) {
    water_cost = consumption * costo_m3_base;
  } else {
    water_cost = (20 * costo_m3_base) + ((consumption - 20) * costo_m3_exceso);
  }

  const sewer_cost = water_cost * (porcentaje / 100);
  const total = water_cost + fixed_charge + sewer_cost;

  return {
    water_cost,
    fixed_charge,
    sewer_cost,
    total,
    tariff_id: tariff?.id || 0
  };
}

export async function getActiveTariff(category: UserCategory, date: number = Date.now()): Promise<Tariff | undefined> {
  return await db.tariffs
    .where('categoria')
    .equals(category)
    .filter(t => t.fecha_inicio <= date && t.fecha_fin >= date)
    .first();
}

export async function getLatestReading(userId: string): Promise<Reading | undefined> {
  if (!userId) return undefined;
  return await db.readings
    .where('user_id')
    .equals(userId)
    .reverse()
    .sortBy('date')
    .then(readings => readings[0]);
}

/**
 * Transacción de registro de usuario:
 * Crea atómicamente 4 documentos:
 * 1. usuarios
 * 2. medidores (id autogenerado MET-XXXX)
 * 3. lecturas (lectura_anterior: 0, lectura_actual: lectura_inicial, consumo: 0)
 * 4. facturas (total: 0, consumo: 0, estado: 'pendiente', usuario_id, medidor_id, lectura_id, fecha)
 */
export async function registrarUsuario(data: {
  name: string;
  address: string;
  category: UserCategory;
  initialReading: number;
}) {
  const userId = generateId('USR-');
  const meterId = generateId('MET-');
  const facturaId = generateId('FAC-');
  const now = Date.now();
  const initialReading = Number(data.initialReading) || 0;

  const tariff = await getActiveTariff(data.category, now);
  const tariffId = tariff?.id || 0;

  const userUuid = uuidv4();
  const meterUuid = uuidv4();
  const readingUuid = uuidv4();
  const facturaUuid = uuidv4();

  let createdReadingId: number = 0;
  let createdFacturaId: number = 0;

  let userDoc: User | undefined;
  let medidorDoc: Meter | undefined;
  let readingDoc: Reading | undefined;
  let facturaDoc: Invoice | undefined;

  await db.transaction('rw', [db.users, db.medidores, db.readings, db.facturas], async () => {
    // 1. usuarios
    userDoc = {
      id: userId,
      name: data.name.trim(),
      address: data.address.trim(),
      meter_id: meterId,
      category: data.category,
      createdAt: now,
      uuid: userUuid,
      updated_at: now,
      version: 1
    };
    await db.users.add(userDoc);

    // 2. medidores
    medidorDoc = {
      id: meterId,
      meter_id: meterId,
      user_id: userId,
      categoria: data.category,
      lectura_inicial: initialReading,
      fecha_instalacion: now,
      estado: 'activo',
      uuid: meterUuid,
      updated_at: now,
      version: 1
    };
    await db.medidores.add(medidorDoc);

    // 3. lecturas
    readingDoc = {
      user_id: userId,
      medidor_id: meterId,
      factura_id: facturaId,
      previous_reading: 0,
      current_reading: initialReading,
      consumption: 0,
      date: now,
      status: 'pending',
      bill_details: {
        water_cost: 0,
        fixed_charge: 0,
        sewer_cost: 0,
        total: 0, // Permite Bs 0,00
        tariff_id: tariffId
      },
      uuid: readingUuid,
      updated_at: now,
      version: 1
    };
    createdReadingId = (await db.readings.add(readingDoc)) as number;

    // 4. facturas
    facturaDoc = {
      factura_id: facturaId,
      total: 0,
      consumo: 0,
      estado: 'pendiente',
      usuario_id: userId,
      user_id: userId,
      medidor_id: meterId,
      lectura_id: createdReadingId,
      fecha: now,
      date: now,
      bill_details: {
        water_cost: 0,
        fixed_charge: 0,
        sewer_cost: 0,
        total: 0,
        tariff_id: tariffId
      },
      uuid: facturaUuid,
      updated_at: now,
      version: 1
    };
    createdFacturaId = (await db.facturas.add(facturaDoc)) as number;
  });

  // Enviar a cola de sincronización con Firestore FUERA de la transacción Dexie
  if (userDoc && medidorDoc && readingDoc && facturaDoc) {
    try {
      await syncService.addToQueue('user', userDoc);
      await syncService.addToQueue('medidor', medidorDoc);
      await syncService.addToQueue('reading', { ...readingDoc, id: createdReadingId });
      await syncService.addToQueue('factura', { ...facturaDoc, id: createdFacturaId });
    } catch (syncErr) {
      console.warn('Error encolando sincronización tras registrarUsuario:', syncErr);
    }
  }

  return {
    userId,
    meterId,
    facturaId,
    readingId: createdReadingId
  };
}

// Alias de compatibilidad
export const guardarUsuario = registrarUsuario;

/**
 * Función cargarRecibo(id) / getRecibo(id)
 * - No crashea si algún campo es null
 * - Si la tarifa por categoría no existe, usa 0 por defecto
 * - Agrega console.log del error real
 */
export async function cargarRecibo(id: string | number): Promise<{
  reading: Reading;
  user: User;
  tariff: Tariff;
  factura?: Invoice;
}> {
  try {
    console.log('[cargarRecibo] Buscando recibo con identificador:', id);
    if (!id && id !== 0) {
      throw new Error('ID no provisto para cargar el recibo');
    }

    const idStr = String(id).trim();
    const idNum = parseInt(idStr, 10);

    let factura: Invoice | undefined;
    let reading: Reading | undefined;

    // 1. Buscar en tabla de facturas
    if (!isNaN(idNum)) {
      factura = await db.facturas.get(idNum);
    }
    if (!factura) {
      factura = await db.facturas.where('factura_id').equals(idStr).first();
    }
    if (!factura) {
      factura = await db.facturas.where('uuid').equals(idStr).first();
    }

    // Si encontramos la factura, localizar la lectura
    if (factura && factura.lectura_id) {
      const lecIdNum = parseInt(String(factura.lectura_id), 10);
      if (!isNaN(lecIdNum)) {
        reading = await db.readings.get(lecIdNum);
      }
      if (!reading) {
        reading = await db.readings.where('uuid').equals(String(factura.lectura_id)).first();
      }
    }

    // 2. Si no encontramos la lectura por factura, buscarla directamente en readings
    if (!reading && !isNaN(idNum)) {
      reading = await db.readings.get(idNum);
    }
    if (!reading) {
      reading = await db.readings.where('factura_id').equals(idStr).first();
    }
    if (!reading) {
      reading = await db.readings.where('uuid').equals(idStr).first();
    }

    // Si encontramos lectura pero no factura, buscar si existe factura asociada
    if (reading && !factura) {
      if (reading.factura_id) {
        factura = await db.facturas.where('factura_id').equals(reading.factura_id).first();
      }
      if (!factura && reading.id) {
        factura = await db.facturas.where('lectura_id').equals(reading.id).first();
      }
    }

    // Si tenemos factura pero no lectura en tabla readings, construir lectura segura desde la factura
    if (!reading && factura) {
      reading = {
        id: typeof factura.lectura_id === 'number' ? factura.lectura_id : 1,
        user_id: factura.usuario_id || factura.user_id,
        medidor_id: factura.medidor_id,
        factura_id: factura.factura_id,
        previous_reading: 0,
        current_reading: factura.consumo || 0,
        consumption: factura.consumo || 0,
        date: factura.fecha || factura.date || Date.now(),
        status: factura.estado === 'pagado' ? 'paid' : 'pending',
        bill_details: factura.bill_details || {
          water_cost: 0,
          fixed_charge: 0,
          sewer_cost: 0,
          total: factura.total || 0,
          tariff_id: 0
        },
        uuid: factura.uuid || uuidv4(),
        updated_at: factura.updated_at || Date.now(),
        version: 1
      };
    }

    if (!reading) {
      const notFoundErr = new Error(`No se encontró el documento de factura ni lectura para ID: "${id}"`);
      console.error('[cargarRecibo] Error real al buscar lectura:', notFoundErr);
      throw notFoundErr;
    }

    // 3. Buscar datos del usuario
    const userId = reading.user_id || factura?.usuario_id || factura?.user_id;
    let user: User | undefined;
    if (userId) {
      user = await db.users.get(userId);
      if (!user) {
        user = await db.users.where('uuid').equals(userId).first();
      }
    }

    if (!user) {
      console.warn(`[cargarRecibo] Usuario "${userId}" no encontrado. Usando datos seguros de respaldo.`);
      user = {
        id: userId || 'USR-ACTUAL',
        name: 'Cliente Tolomosita Oeste',
        address: 'Tolomosita Oeste',
        meter_id: reading.medidor_id || factura?.medidor_id || 'MET-S/N',
        category: 'Residencial',
        createdAt: Date.now(),
        uuid: uuidv4(),
        updated_at: Date.now(),
        version: 1
      };
    }

    // 4. Buscar tarifa (Si no existe, usar 0 por defecto)
    let tariff: Tariff | undefined;
    if (reading.bill_details?.tariff_id) {
      tariff = await db.tariffs.get(reading.bill_details.tariff_id);
    }
    if (!tariff && user.category) {
      tariff = await db.tariffs.where('categoria').equals(user.category).first();
    }

    if (!tariff) {
      console.log(`[cargarRecibo] Tarifa no configurada para "${user.category}". Usando 0 por defecto.`);
      tariff = {
        id: 0,
        categoria: user.category || 'Residencial',
        cargo_fijo_mensual: 0,
        costo_m3_base: 0,
        costo_m3_exceso: 0,
        tarifa_conexion: 0,
        porcentaje_alcantarillado: 0,
        fecha_inicio: 0,
        fecha_fin: Date.now() + 315360000000,
        uuid: 'tarifa-default-cero',
        updated_at: Date.now(),
        version: 1
      };
    }

    // Asegurar que ningún campo sea null ni undefined
    reading.previous_reading = reading.previous_reading ?? 0;
    reading.current_reading = reading.current_reading ?? 0;
    reading.consumption = reading.consumption ?? 0;
    reading.date = reading.date ?? Date.now();
    reading.uuid = reading.uuid || factura?.uuid || `REC-${reading.id || '001'}`;

    if (!reading.bill_details) {
      reading.bill_details = {
        water_cost: 0,
        fixed_charge: 0,
        sewer_cost: 0,
        total: factura?.total ?? 0,
        tariff_id: tariff.id || 0
      };
    } else {
      reading.bill_details.water_cost = reading.bill_details.water_cost ?? 0;
      reading.bill_details.fixed_charge = reading.bill_details.fixed_charge ?? 0;
      reading.bill_details.sewer_cost = reading.bill_details.sewer_cost ?? 0;
      reading.bill_details.total = reading.bill_details.total ?? factura?.total ?? 0;
      reading.bill_details.tariff_id = reading.bill_details.tariff_id ?? tariff.id ?? 0;
    }

    console.log('[cargarRecibo] Datos cargados correctamente:', {
      readingId: reading.id,
      userId: user.id,
      facturaId: factura?.factura_id || reading.factura_id,
      total: reading.bill_details.total
    });

    return { reading, user, tariff, factura };
  } catch (error) {
    console.error('[cargarRecibo] Error real al cargar el recibo:', error);
    throw error;
  }
}

// Alias de compatibilidad
export const getRecibo = cargarRecibo;
