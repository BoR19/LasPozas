import { db, type User, type Reading, type Tariff, type UserCategory, type Invoice, type Meter, type InvoiceDetalle } from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { generateId } from '../lib/utils';
import { db as firestoreDb } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { syncService, sanitizeFirestoreData } from './syncService';

/**
 * Estructura tarifaria vigente (31 dic 2023 al 30 dic 2030)
 * Industrial: Cargo Fijo Bs 40, Conexión Bs 500, Reconexión Bs 250, Base Bs 4, Exceso Bs 6
 * Comercial: Cargo Fijo Bs 17, Conexión Bs 200, Reconexión Bs 100, Base Bs 2.50, Exceso Bs 3.50
 * Residencial: Cargo Fijo Bs 7, Conexión Bs 100, Reconexión Bs 50, Base Bs 1.20, Exceso Bs 1.80
 * Residencial Social: Cargo Fijo Bs 3, Conexión Bs 50, Reconexión Bs 25, Base Bs 0.50, Exceso Bs 0.80
 * Reconexión = 50% de la tarifa de conexión
 */
export const DEFAULT_TARIFF_CONFIG: Record<UserCategory, { cargo_fijo: number; conexion: number; reconexion: number; base: number; exceso: number }> = {
  'Industrial': { cargo_fijo: 40, conexion: 500, reconexion: 250, base: 4.00, exceso: 6.00 },
  'Comercial': { cargo_fijo: 17, conexion: 200, reconexion: 100, base: 2.50, exceso: 3.50 },
  'Residencial': { cargo_fijo: 7, conexion: 100, reconexion: 50, base: 1.20, exceso: 1.80 },
  'Residencial Social': { cargo_fijo: 3, conexion: 50, reconexion: 25, base: 0.50, exceso: 0.80 }
};

/**
 * Cálculo de facturación:
 * 
 * Si es esUsuarioNuevo == true o esPrimeraLectura == true:
 *   total = tarifa.cargo_fijo + tarifa.conexion + (consumo * tarifa.base)
 *   Como consumo es 0, sería solo cargo fijo + conexión:
 *   - Bruno Torrejon (Comercial): 17 + 200 = 217
 *   - Residencial: 7 + 100 = 107
 *   - Residencial Social: 3 + 50 = 53
 *   - Industrial: 40 + 500 = 540
 * 
 * Para las siguientes facturas (usuario ya existente):
 *   si consumo <= 20: total = cargo_fijo + (consumo * base)
 *   si consumo > 20: total = cargo_fijo + (20 * base) + ((consumo - 20) * exceso)
 *   (La conexión SOLO se cobra en la primera factura)
 * 
 * Devuelve desglose: detalle: { cargo_fijo, conexion, consumo_m3, costo_consumo, total }
 */
export function calculateBill(
  consumption: number,
  tariff?: Tariff | null,
  isFirstReading: boolean = false,
  isNewUser: boolean = false
) {
  const isFirst = Boolean(isFirstReading || isNewUser);

  const cargo_fijo = tariff?.cargo_fijo_mensual ?? 0;
  const conexion = isFirst ? (tariff?.tarifa_conexion ?? 0) : 0;
  const reconexion = 0;
  const costo_m3_base = tariff?.costo_m3_base ?? 0;
  const costo_m3_exceso = tariff?.costo_m3_exceso ?? 0;
  const consumo_m3 = Math.max(0, Number(consumption) || 0);

  let consumo_base = 0;
  let monto_base = 0;
  let consumo_exceso = 0;
  let monto_exceso = 0;

  if (consumo_m3 <= 20) {
    consumo_base = consumo_m3;
    monto_base = Math.round(consumo_base * costo_m3_base * 100) / 100;
    consumo_exceso = 0;
    monto_exceso = 0;
  } else {
    consumo_base = 20;
    monto_base = Math.round(20 * costo_m3_base * 100) / 100;
    consumo_exceso = Math.round((consumo_m3 - 20) * 100) / 100;
    monto_exceso = Math.round(consumo_exceso * costo_m3_exceso * 100) / 100;
  }

  const costo_consumo = Math.round((monto_base + monto_exceso) * 100) / 100;
  const total = isFirst
    ? Math.round((cargo_fijo + conexion + costo_consumo) * 100) / 100
    : Math.round((cargo_fijo + costo_consumo) * 100) / 100;

  const detalle: InvoiceDetalle = {
    cargo_fijo,
    conexion,
    costo_conexion: conexion,
    reconexion,
    costo_reconexion: reconexion,
    consumo_m3,
    consumo_base,
    monto_base,
    consumo_exceso,
    monto_exceso,
    costo_consumo,
    es_primera_factura: isFirst,
    es_reconexion: false,
    tipo_factura: isFirst ? 'primera' : 'regular',
    total,
    tarifa_aplicada: tariff ? {
      categoria: tariff.categoria,
      cargo_fijo: tariff.cargo_fijo_mensual,
      conexion: tariff.tarifa_conexion,
      reconexion: tariff.tarifa_reconexion ?? Math.round((tariff.tarifa_conexion || 0) * 0.5 * 100) / 100,
      base: tariff.costo_m3_base,
      exceso: tariff.costo_m3_exceso
    } : undefined
  };

  const desglose = {
    cargo_fijo,
    conexion,
    reconexion,
    base_m3: consumo_base,
    base_costo: monto_base,
    exceso_m3: consumo_exceso,
    exceso_costo: monto_exceso,
    consumo_m3,
    costo_consumo,
    total
  };

  return {
    water_cost: costo_consumo,
    fixed_charge: cargo_fijo,
    sewer_cost: 0,
    conexion,
    costo_conexion: conexion,
    reconexion,
    costo_reconexion: reconexion,
    consumo_base,
    monto_base,
    consumo_exceso,
    monto_exceso,
    es_primera_factura: isFirst,
    es_reconexion: false,
    tipo_factura: isFirst ? ('primera' as const) : ('regular' as const),
    tipo: isFirst ? ('nueva' as const) : ('normal' as const),
    total,
    tariff_id: tariff?.id || 0,
    detalle,
    desglose
  };
}

/**
 * Busca la tarifa correcta por categoria y por fecha vigente (la que esté entre fecha_inicio y fecha_fin y esté activa).
 * Si no está cargada en base de datos, usa los valores reglamentarios por defecto con reconexión = 50% de conexión.
 */
export async function getActiveTariff(category: UserCategory, date: number = Date.now()): Promise<Tariff> {
  // 1. Tarifa vigente en fecha y activa
  let tariff = await db.tariffs
    .where('categoria')
    .equals(category)
    .filter(t => t.fecha_inicio <= date && t.fecha_fin >= date && t.activa !== false)
    .first();

  // 2. Si no encontró por rango estricto, buscar la última activa
  if (!tariff) {
    tariff = await db.tariffs
      .where('categoria')
      .equals(category)
      .filter(t => t.activa !== false)
      .reverse()
      .sortBy('fecha_inicio')
      .then(tariffs => tariffs[0]);
  }

  // 3. Fallback a la más reciente de esa categoría
  if (!tariff) {
    tariff = await db.tariffs
      .where('categoria')
      .equals(category)
      .reverse()
      .sortBy('fecha_inicio')
      .then(tariffs => tariffs[0]);
  }

  if (!tariff) {
    const config = DEFAULT_TARIFF_CONFIG[category] || DEFAULT_TARIFF_CONFIG['Residencial'];
    tariff = {
      id: 0,
      categoria: category,
      cargo_fijo_mensual: config.cargo_fijo,
      cargo_fijo: config.cargo_fijo,
      tarifa_conexion: config.conexion,
      conexion: config.conexion,
      tarifa_reconexion: config.reconexion,
      reconexion: config.reconexion,
      costo_m3_base: config.base,
      base: config.base,
      costo_m3_exceso: config.exceso,
      exceso: config.exceso,
      porcentaje_alcantarillado: 20,
      fecha_inicio: new Date('2023-12-31').getTime(),
      fecha_fin: new Date('2030-12-30T23:59:59').getTime(),
      activa: true,
      uuid: `tarifa-default-${category.toLowerCase().replace(/\s+/g, '-')}`,
      updated_at: Date.now(),
      version: 1
    };
  } else {
    if (tariff.tarifa_reconexion === undefined) {
      tariff.tarifa_reconexion = Math.round((tariff.tarifa_conexion || 0) * 0.5 * 100) / 100;
    }
    tariff.cargo_fijo = tariff.cargo_fijo_mensual;
    tariff.conexion = tariff.tarifa_conexion;
    tariff.reconexion = tariff.tarifa_reconexion;
    tariff.base = tariff.costo_m3_base;
    tariff.exceso = tariff.costo_m3_exceso;
    if (tariff.activa === undefined) tariff.activa = true;
  }

  return tariff;
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
 * Implementación de crearFacturaInicial:
 * Busca la tarifa por categoría y fecha vigente (2023-2030)
 * Si es esUsuarioNuevo == true o esPrimeraLectura == true:
 * total = tarifa.cargo_fijo + tarifa.conexion + (consumo * tarifa.base)
 * Con consumo = 0: total = cargo_fijo + conexion
 * Guarda desglose detalle: { cargo_fijo, conexion, consumo_m3, costo_consumo, total }
 */
export async function crearFacturaInicial(params: {
  userId: string;
  meterId: string;
  category: UserCategory;
  userName?: string;
  userAddress?: string;
  initialReading?: number;
  date?: number;
  facturaId?: string;
  readingId?: number;
  esUsuarioNuevo?: boolean;
  esPrimeraLectura?: boolean;
}) {
  const now = params.date || Date.now();
  const consumption = 0;
  const initialReading = Number(params.initialReading) || 0;
  const facturaId = params.facturaId || generateId('FAC-');

  const tariff = await getActiveTariff(params.category, now);
  const bill = calculateBill(consumption, tariff, true, true);

  const facturaDoc: Invoice = {
    factura_id: facturaId,
    tipo: 'nueva',
    tipo_factura: 'nueva',
    total: bill.total,
    consumo: 0,
    estado: 'pendiente',
    estado_pago: 'pendiente',
    usuario_id: params.userId,
    user_id: params.userId,
    medidor_id: params.meterId,
    lectura_id: params.readingId || 0,
    fecha: now,
    date: now,
    nombre: params.userName || '',
    zona: params.userAddress || 'Tolomosita Oeste',
    categoria: params.category,
    lectura_anterior: 0,
    lectura_actual: initialReading,
    es_primera_factura: true,
    desglose: {
      cargo_fijo: bill.fixed_charge,
      conexion: bill.conexion,
      reconexion: 0,
      base_m3: 0,
      base_costo: 0,
      exceso_m3: 0,
      exceso_costo: 0,
      consumo_m3: 0,
      costo_consumo: 0,
      total: bill.total
    },
    detalle: bill.detalle,
    bill_details: bill,
    uuid: uuidv4(),
    updated_at: now,
    version: 1
  };

  return {
    facturaId,
    bill,
    facturaDoc,
    tariff
  };
}

/**
 * Genera factura automática de tipo 'reconexion' al reactivar un usuario:
 * total = Cargo Fijo + Reconexión (donde Reconexión = 50% de conexión de la tarifa vigente).
 * Guarda desglose completo en factura y lectura para asegurar que el recibo cargue perfecto.
 */
export async function generarFacturaReconexion(user: User, date: number = Date.now()) {
  const now = date;
  const tariff = await getActiveTariff(user.category, now);
  const cargo_fijo = tariff.cargo_fijo_mensual ?? 0;
  const reconexion = tariff.tarifa_reconexion ?? Math.round((tariff.tarifa_conexion || 0) * 0.5 * 100) / 100;
  const total = Math.round((cargo_fijo + reconexion) * 100) / 100;

  const latestReading = await getLatestReading(user.id);
  const currentReading = latestReading?.current_reading ?? 0;

  const facturaId = generateId('FAC-');
  const facturaUuid = uuidv4();
  const readingUuid = uuidv4();

  const detalle: InvoiceDetalle = {
    cargo_fijo,
    conexion: 0,
    costo_conexion: 0,
    reconexion,
    costo_reconexion: reconexion,
    consumo_m3: 0,
    consumo_base: 0,
    monto_base: 0,
    consumo_exceso: 0,
    monto_exceso: 0,
    costo_consumo: 0,
    es_primera_factura: false,
    es_reconexion: true,
    tipo_factura: 'reconexion',
    total,
    tarifa_aplicada: {
      categoria: tariff.categoria,
      cargo_fijo: tariff.cargo_fijo_mensual,
      conexion: tariff.tarifa_conexion,
      reconexion: reconexion,
      base: tariff.costo_m3_base,
      exceso: tariff.costo_m3_exceso
    }
  };

  const readingDoc: Reading = {
    user_id: user.id,
    medidor_id: user.meter_id,
    factura_id: facturaId,
    previous_reading: currentReading,
    current_reading: currentReading,
    consumption: 0,
    date: now,
    status: 'pending',
    tipo_factura: 'reconexion',
    detalle,
    bill_details: {
      water_cost: 0,
      fixed_charge: cargo_fijo,
      sewer_cost: 0,
      conexion: 0,
      costo_conexion: 0,
      reconexion,
      costo_reconexion: reconexion,
      consumo_base: 0,
      monto_base: 0,
      consumo_exceso: 0,
      monto_exceso: 0,
      es_primera_factura: false,
      es_reconexion: true,
      tipo_factura: 'reconexion',
      total,
      tariff_id: tariff.id || 0,
      detalle
    },
    uuid: readingUuid,
    updated_at: now,
    version: 1
  };

  const readingId = (await db.readings.add(readingDoc)) as number;

  const facturaDoc: Invoice = {
    factura_id: facturaId,
    tipo: 'reconexion',
    tipo_factura: 'reconexion',
    total,
    consumo: 0,
    estado: 'pendiente',
    estado_pago: 'pendiente',
    usuario_id: user.id,
    user_id: user.id,
    medidor_id: user.meter_id,
    lectura_id: readingId,
    fecha: now,
    date: now,
    nombre: user.name,
    zona: user.address,
    categoria: user.category,
    lectura_anterior: currentReading,
    lectura_actual: currentReading,
    es_primera_factura: false,
    es_reconexion: true,
    desglose: {
      cargo_fijo,
      conexion: 0,
      reconexion,
      base_m3: 0,
      base_costo: 0,
      exceso_m3: 0,
      exceso_costo: 0,
      consumo_m3: 0,
      costo_consumo: 0,
      total
    },
    detalle,
    bill_details: readingDoc.bill_details,
    uuid: facturaUuid,
    updated_at: now,
    version: 1
  };

  const createdFacturaId = (await db.facturas.add(facturaDoc)) as number;

  try {
    await syncService.addToQueue('reading', { ...readingDoc, id: readingId });
    await syncService.addToQueue('factura', { ...facturaDoc, id: createdFacturaId });
  } catch (syncErr) {
    console.warn('Error encolando factura de reconexión:', syncErr);
  }

  return {
    facturaId,
    readingId,
    facturaDoc,
    total,
    reconexion,
    cargo_fijo,
    tariff
  };
}

/**
 * Transacción de registro de usuario:
 * Crea atómicamente 4 documentos:
 * 1. usuarios
 * 2. medidores (id autogenerado MET-XXXX)
 * 3. lecturas (lectura_anterior: 0, lectura_actual: lectura_inicial, consumo: 0)
 * 4. facturas con desglose detalle: { cargo_fijo, conexion, consumo_m3, consumo_base, monto_base, consumo_exceso, monto_exceso, costo_consumo, total }
 * 
 * La primera factura incluye la CONEXIÓN (ej. Comercial: 17 + 200 = 217, Residencial: 7 + 100 = 107)
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

  // Tarifa vigente entre 2023-2030
  const tariff = await getActiveTariff(data.category, now);
  const tariffId = tariff?.id || 0;

  // Cálculo de primera factura con cargo fijo + conexión
  const bill = calculateBill(0, tariff, true, true);

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
      estado: 'activo',
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
      detalle: bill.detalle,
      bill_details: bill,
      uuid: readingUuid,
      updated_at: now,
      version: 1
    };
    createdReadingId = (await db.readings.add(readingDoc)) as number;

    // 4. facturas - Guarda desglose completo y datos de cliente para que nunca falle
    facturaDoc = {
      factura_id: facturaId,
      tipo: 'nueva',
      tipo_factura: 'nueva',
      total: bill.total,
      consumo: 0,
      estado: 'pendiente',
      estado_pago: 'pendiente',
      usuario_id: userId,
      user_id: userId,
      medidor_id: meterId,
      lectura_id: createdReadingId,
      fecha: now,
      date: now,
      nombre: data.name.trim(),
      zona: data.address.trim(),
      categoria: data.category,
      lectura_anterior: 0,
      lectura_actual: initialReading,
      es_primera_factura: true,
      desglose: {
        cargo_fijo: bill.fixed_charge,
        conexion: bill.conexion,
        reconexion: 0,
        base_m3: 0,
        base_costo: 0,
        exceso_m3: 0,
        exceso_costo: 0,
        consumo_m3: 0,
        costo_consumo: 0,
        total: bill.total
      },
      detalle: bill.detalle,
      bill_details: bill,
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

/**
 * Registra el cobro de una factura (en efectivo o vía QR estático FIE/Altoke).
 * Actualiza de forma sincronizada y atómica facturas y readings, tanto en Dexie local
 * como directamente en Firestore para producción (Vercel).
 */
export async function registrarPagoFactura(params: {
  facturaId?: string | number;
  readingId?: string | number;
  readingUuid?: string;
  metodo_pago: 'efectivo' | 'qr_fie' | 'qr_altoke';
  monto_recibido?: number;
  cambio?: number;
}) {
  const now = Date.now();
  console.log('[registrarPagoFactura] Procesando cobro:', params);

  // 1. Buscar la lectura correspondiente
  let reading: Reading | undefined;
  
  // A. Buscar por readingId si se provee
  if (params.readingId !== undefined && params.readingId !== null) {
    const rIdNum = typeof params.readingId === 'number' ? params.readingId : parseInt(String(params.readingId), 10);
    if (!isNaN(rIdNum)) {
      reading = await db.readings.get(rIdNum);
    }
    if (!reading) {
      reading = await db.readings.where('uuid').equals(String(params.readingId)).first();
    }
    if (!reading) {
      reading = await db.readings.where('factura_id').equals(String(params.readingId)).first();
    }
  }

  // B. Buscar por readingUuid
  if (!reading && params.readingUuid) {
    reading = await db.readings.where('uuid').equals(params.readingUuid).first();
  }

  // C. Buscar por facturaId
  if (!reading && params.facturaId !== undefined && params.facturaId !== null) {
    const facIdStr = String(params.facturaId).trim();
    const facIdNum = parseInt(facIdStr, 10);

    reading = await db.readings.where('factura_id').equals(facIdStr).first();
    if (!reading) {
      reading = await db.readings.where('uuid').equals(facIdStr).first();
    }
    if (!reading && !isNaN(facIdNum)) {
      reading = await db.readings.get(facIdNum);
    }
  }

  // 2. Buscar la factura correspondiente
  let factura: Invoice | undefined;
  const idStr = params.facturaId !== undefined ? String(params.facturaId).trim() : '';
  const idNum = parseInt(idStr, 10);

  if (idStr) {
    factura = await db.facturas.where('factura_id').equals(idStr).first();
    if (!factura) {
      factura = await db.facturas.where('uuid').equals(idStr).first();
    }
    if (!factura && !isNaN(idNum)) {
      factura = await db.facturas.get(idNum);
    }
  }

  // Si encontramos reading pero no factura, intentar localizar factura por el reading
  if (!factura && reading) {
    if (reading.factura_id) {
      factura = await db.facturas.where('factura_id').equals(reading.factura_id).first();
    }
    if (!factura && reading.id) {
      factura = await db.facturas.where('lectura_id').equals(reading.id).first();
    }
    if (!factura && reading.uuid) {
      factura = await db.facturas.where('uuid').equals(reading.uuid).first();
    }
  }

  // Si encontramos factura pero no reading, localizar reading por factura
  if (!reading && factura) {
    if (typeof factura.lectura_id === 'number') {
      reading = await db.readings.get(factura.lectura_id);
    }
    if (!reading && factura.factura_id) {
      reading = await db.readings.where('factura_id').equals(factura.factura_id).first();
    }
    if (!reading && factura.uuid) {
      reading = await db.readings.where('uuid').equals(factura.uuid).first();
    }
  }

  // Si no se encontró ninguno, error explicativo
  if (!reading && !factura) {
    throw new Error(`No se encontró registro para cobrar (Identificador: ${params.facturaId || params.readingId})`);
  }

  const montoTotal = Number(
    factura?.total ?? 
    reading?.bill_details?.total ?? 
    reading?.detalle?.total ?? 
    0
  );

  const montoRecibido = params.monto_recibido ?? montoTotal;
  const cambioDevolver = params.cambio ?? Math.max(0, Math.round((montoRecibido - montoTotal) * 100) / 100);

  // Sintetizar factura si faltaba en Dexie
  if (!factura && reading) {
    const newFacId = reading.factura_id || `FAC-${reading.id || Date.now()}`;
    const newFacUuid = reading.uuid || uuidv4();
    factura = {
      factura_id: newFacId,
      total: montoTotal,
      consumo: reading.consumption ?? 0,
      estado: 'pagado',
      estado_pago: 'pagado',
      metodo_pago: params.metodo_pago,
      fecha_pago: now,
      monto_recibido: montoRecibido,
      cambio: cambioDevolver,
      usuario_id: reading.user_id,
      user_id: reading.user_id,
      medidor_id: reading.medidor_id || 'MET-S/N',
      lectura_id: reading.id ?? reading.uuid,
      fecha: reading.date || now,
      date: reading.date || now,
      detalle: reading.detalle,
      desglose: reading.desglose,
      bill_details: reading.bill_details,
      uuid: newFacUuid,
      updated_at: now,
      version: 1
    };
    const createdId = await db.facturas.add(factura);
    factura.id = createdId as number;
  }

  // Sintetizar reading si faltaba en Dexie
  if (!reading && factura) {
    const newReadingUuid = factura.uuid || uuidv4();
    reading = {
      user_id: factura.user_id || factura.usuario_id,
      medidor_id: factura.medidor_id,
      factura_id: factura.factura_id,
      previous_reading: factura.lectura_anterior || 0,
      current_reading: factura.lectura_actual || (factura.consumo || 0),
      consumption: factura.consumo || 0,
      date: factura.fecha || factura.date || now,
      status: 'paid',
      estado_pago: 'pagado',
      metodo_pago: params.metodo_pago,
      fecha_pago: now,
      monto_recibido: montoRecibido,
      cambio: cambioDevolver,
      detalle: factura.detalle,
      bill_details: factura.bill_details || {
        water_cost: 0,
        fixed_charge: 0,
        sewer_cost: 0,
        total: factura.total
      },
      uuid: newReadingUuid,
      updated_at: now,
      version: 1
    };
    const createdRId = await db.readings.add(reading);
    reading.id = createdRId as number;
  }

  // Actualizar lectura en Dexie
  const updatedReading: Reading = {
    ...reading!,
    status: 'paid',
    estado_pago: 'pagado',
    metodo_pago: params.metodo_pago,
    fecha_pago: now,
    monto_recibido: montoRecibido,
    cambio: cambioDevolver,
    updated_at: now,
    version: ((reading as any).version || 1) + 1
  };
  if (reading!.id) {
    await db.readings.update(reading!.id, updatedReading);
  }

  // Actualizar factura en Dexie
  const updatedFactura: Invoice = {
    ...factura!,
    estado: 'pagado',
    estado_pago: 'pagado',
    metodo_pago: params.metodo_pago,
    fecha_pago: now,
    monto_recibido: montoRecibido,
    cambio: cambioDevolver,
    updated_at: now,
    version: ((factura as any).version || 1) + 1
  };
  if (factura!.id) {
    await db.facturas.update(factura!.id, updatedFactura);
  }

  // Actualización inmediata directa en Firestore para producción (Vercel)
  try {
    const cleanReading = sanitizeFirestoreData({ ...updatedReading });
    const cleanFactura = sanitizeFirestoreData({ ...updatedFactura });

    const readingKey = String(cleanReading.uuid || cleanReading.id);
    const facturaKey = String(cleanFactura.uuid || cleanFactura.factura_id || cleanFactura.id);

    await Promise.all([
      setDoc(doc(firestoreDb, 'readings', readingKey), cleanReading, { merge: true }),
      setDoc(doc(firestoreDb, 'facturas', facturaKey), cleanFactura, { merge: true })
    ]);
    console.log('[registrarPagoFactura] ✅ Pago guardado directamente en Firestore con éxito');
  } catch (directErr) {
    console.warn('[registrarPagoFactura] Guardado directo a Firestore falló (se usará cola offline):', directErr);
  }

  // Encolar también en sincronización Dexie
  try {
    await syncService.addToQueue('reading', updatedReading);
    await syncService.addToQueue('factura', updatedFactura);
  } catch (queueErr) {
    console.warn('[registrarPagoFactura] Error encolando:', queueErr);
  }

  return updatedFactura;
}

// Alias de compatibilidad
export const guardarUsuario = registrarUsuario;

/**
 * Función cargarRecibo(id) / getRecibo(id)
 * - Lee el desglose detalle: { cargo_fijo, conexion, consumo_m3, consumo_base, monto_base, consumo_exceso, monto_exceso, costo_consumo, total }
 * - No crashea si algún campo es null o undefined
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

    // 3. Buscar datos del usuario
    const userId = reading?.user_id || factura?.usuario_id || factura?.user_id;
    let user: User | undefined;
    if (userId) {
      user = await db.users.get(userId);
      if (!user) {
        user = await db.users.where('uuid').equals(userId).first();
      }
    }

    if (!user) {
      console.warn(`[cargarRecibo] Usuario "${userId}" no encontrado en users. Usando datos de factura o respaldo.`);
      user = {
        id: userId || 'USR-ACTUAL',
        name: factura?.nombre || 'Cliente Tolomosita Oeste',
        address: factura?.zona || 'Tolomosita Oeste',
        meter_id: reading?.medidor_id || factura?.medidor_id || 'MET-S/N',
        category: factura?.categoria || 'Residencial',
        createdAt: Date.now(),
        uuid: uuidv4(),
        updated_at: Date.now(),
        version: 1
      };
    } else {
      // Complementar con datos guardados en factura si faltan
      if (!user.name && factura?.nombre) user.name = factura.nombre;
      if (!user.address && factura?.zona) user.address = factura.zona;
      if (!user.meter_id && factura?.medidor_id) user.meter_id = factura.medidor_id;
      if (!user.category && factura?.categoria) user.category = factura.categoria;
    }

    // 4. Buscar tarifa (Si no existe, usar 0 por defecto)
    let tariff: Tariff | undefined;
    const readingTariffId = reading?.bill_details?.tariff_id || factura?.bill_details?.tariff_id;
    if (readingTariffId) {
      tariff = await db.tariffs.get(readingTariffId);
    }
    if (!tariff && user.category) {
      tariff = await getActiveTariff(user.category, reading?.date || factura?.fecha || Date.now());
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
        fecha_inicio: new Date('2023-12-31').getTime(),
        fecha_fin: new Date('2030-12-30T23:59:59').getTime(),
        uuid: 'tarifa-default-cero',
        updated_at: Date.now(),
        version: 1
      };
    }

    // 5. Determinar con precisión el tipo de factura (esPrimeraFactura / esReconexion)
    const rawDetalle = factura?.detalle || reading?.detalle || factura?.bill_details?.detalle || reading?.bill_details?.detalle;
    
    const isReconexion = Boolean(
      factura?.tipo_factura === 'reconexion' ||
      reading?.tipo_factura === 'reconexion' ||
      factura?.es_reconexion ||
      reading?.bill_details?.es_reconexion ||
      rawDetalle?.es_reconexion ||
      rawDetalle?.tipo_factura === 'reconexion' ||
      ((rawDetalle?.reconexion ?? 0) > 0 && !factura?.es_primera_factura)
    );

    let isFirstInvoice = false;
    if (!isReconexion) {
      if (factura?.es_primera_factura !== undefined) {
        isFirstInvoice = Boolean(factura.es_primera_factura);
      } else if (rawDetalle?.es_primera_factura !== undefined) {
        isFirstInvoice = Boolean(rawDetalle.es_primera_factura);
      } else if (reading?.bill_details?.es_primera_factura !== undefined) {
        isFirstInvoice = Boolean(reading.bill_details.es_primera_factura);
      } else {
        const prev = reading?.previous_reading ?? factura?.lectura_anterior ?? 0;
        const cons = reading?.consumption ?? factura?.consumo ?? 0;
        const conFee = rawDetalle?.conexion ?? rawDetalle?.costo_conexion ?? 0;
        isFirstInvoice = Boolean(conFee > 0 || (prev === 0 && cons === 0));
      }
    }

    // 6. Leer y normalizar desglose detalle: { cargo_fijo, conexion, reconexion, consumo_m3, consumo_base, monto_base, consumo_exceso, monto_exceso, costo_consumo, total }
    const cargo_fijo = Number(rawDetalle?.cargo_fijo ?? reading?.bill_details?.fixed_charge ?? factura?.bill_details?.fixed_charge ?? tariff.cargo_fijo_mensual ?? 0);
    
    let conexion = 0;
    if (isFirstInvoice) {
      const rawConex = rawDetalle?.conexion ?? rawDetalle?.costo_conexion ?? reading?.bill_details?.conexion ?? factura?.bill_details?.conexion;
      conexion = Number(rawConex !== undefined && rawConex !== null ? rawConex : (tariff.tarifa_conexion || 0));
    }

    let reconexion = 0;
    if (isReconexion) {
      const rawReconex = rawDetalle?.reconexion ?? rawDetalle?.costo_reconexion ?? reading?.bill_details?.reconexion ?? factura?.bill_details?.reconexion;
      reconexion = Number(rawReconex !== undefined && rawReconex !== null ? rawReconex : (tariff.tarifa_reconexion ?? Math.round((tariff.tarifa_conexion || 0) * 0.5 * 100) / 100));
    }

    const consumo_m3 = isReconexion ? 0 : Number(rawDetalle?.consumo_m3 ?? reading?.consumption ?? factura?.consumo ?? 0);
    
    let consumo_base = 0;
    let monto_base = 0;
    let consumo_exceso = 0;
    let monto_exceso = 0;

    if (!isReconexion) {
      if (consumo_m3 <= 20) {
        consumo_base = consumo_m3;
        monto_base = rawDetalle?.monto_base ?? Math.round(consumo_base * (tariff.costo_m3_base || 0) * 100) / 100;
        consumo_exceso = 0;
        monto_exceso = 0;
      } else {
        consumo_base = 20;
        monto_base = rawDetalle?.monto_base ?? Math.round(20 * (tariff.costo_m3_base || 0) * 100) / 100;
        consumo_exceso = Math.round((consumo_m3 - 20) * 100) / 100;
        monto_exceso = rawDetalle?.monto_exceso ?? Math.round(consumo_exceso * (tariff.costo_m3_exceso || 0) * 100) / 100;
      }
    }

    const costo_consumo = Number(rawDetalle?.costo_consumo ?? Math.round((monto_base + monto_exceso) * 100) / 100);

    let total = rawDetalle?.total ?? factura?.total ?? reading?.bill_details?.total;
    if (isReconexion) {
      total = Math.round((cargo_fijo + reconexion) * 100) / 100;
      if (factura?.id && (factura.total === 0 || factura.total === undefined)) {
        await db.facturas.update(factura.id, { total, updated_at: Date.now() });
      }
    } else if ((total === 0 || total === undefined || total === null) && isFirstInvoice && (tariff.cargo_fijo_mensual > 0 || tariff.tarifa_conexion > 0)) {
      total = Math.round((cargo_fijo + conexion + costo_consumo) * 100) / 100;
      if (factura?.id) {
        await db.facturas.update(factura.id, { total, updated_at: Date.now() });
      }
    } else if (total === undefined || total === null) {
      total = isFirstInvoice 
        ? Math.round((cargo_fijo + conexion + costo_consumo) * 100) / 100
        : Math.round((cargo_fijo + costo_consumo) * 100) / 100;
    }

    const safeDetalle: InvoiceDetalle = {
      cargo_fijo,
      conexion,
      costo_conexion: conexion,
      reconexion,
      costo_reconexion: reconexion,
      consumo_m3,
      consumo_base,
      monto_base,
      consumo_exceso,
      monto_exceso,
      costo_consumo,
      es_primera_factura: isFirstInvoice,
      es_reconexion: isReconexion,
      tipo_factura: isReconexion ? 'reconexion' : isFirstInvoice ? 'primera' : 'regular',
      total: Number(total) || 0,
      tarifa_aplicada: {
        categoria: tariff.categoria,
        cargo_fijo: tariff.cargo_fijo_mensual,
        conexion: tariff.tarifa_conexion,
        reconexion: tariff.tarifa_reconexion ?? Math.round((tariff.tarifa_conexion || 0) * 0.5 * 100) / 100,
        base: tariff.costo_m3_base,
        exceso: tariff.costo_m3_exceso
      }
    };

    // Si no tenemos lectura en la tabla readings, construirla de forma segura
    if (!reading && factura) {
      reading = {
        id: typeof factura.lectura_id === 'number' ? factura.lectura_id : 1,
        user_id: user.id,
        medidor_id: factura.medidor_id || user.meter_id,
        factura_id: factura.factura_id,
        previous_reading: factura.lectura_anterior ?? 0,
        current_reading: factura.lectura_actual ?? safeDetalle.consumo_m3,
        consumption: safeDetalle.consumo_m3,
        date: factura.fecha || factura.date || Date.now(),
        status: factura.estado === 'pagado' ? 'paid' : 'pending',
        tipo_factura: safeDetalle.tipo_factura,
        detalle: safeDetalle,
        bill_details: {
          water_cost: safeDetalle.costo_consumo,
          fixed_charge: safeDetalle.cargo_fijo,
          sewer_cost: 0,
          conexion: safeDetalle.conexion,
          costo_conexion: safeDetalle.costo_conexion,
          reconexion: safeDetalle.reconexion,
          costo_reconexion: safeDetalle.costo_reconexion,
          consumo_base: safeDetalle.consumo_base,
          monto_base: safeDetalle.monto_base,
          consumo_exceso: safeDetalle.consumo_exceso,
          monto_exceso: safeDetalle.monto_exceso,
          es_primera_factura: isFirstInvoice,
          es_reconexion: isReconexion,
          tipo_factura: safeDetalle.tipo_factura,
          total: safeDetalle.total,
          tariff_id: tariff.id || 0,
          detalle: safeDetalle
        },
        uuid: factura.uuid || uuidv4(),
        updated_at: factura.updated_at || Date.now(),
        version: 1
      };
    } else if (reading) {
      reading.previous_reading = reading.previous_reading ?? factura?.lectura_anterior ?? 0;
      reading.current_reading = reading.current_reading ?? factura?.lectura_actual ?? 0;
      reading.consumption = reading.consumption ?? safeDetalle.consumo_m3;
      reading.date = reading.date ?? Date.now();
      reading.tipo_factura = safeDetalle.tipo_factura;
      reading.uuid = reading.uuid || factura?.uuid || `REC-${reading.id || '001'}`;
      reading.detalle = safeDetalle;
      reading.bill_details = {
        water_cost: safeDetalle.costo_consumo,
        fixed_charge: safeDetalle.cargo_fijo,
        sewer_cost: reading.bill_details?.sewer_cost ?? 0,
        conexion: safeDetalle.conexion,
        costo_conexion: safeDetalle.costo_conexion,
        reconexion: safeDetalle.reconexion,
        costo_reconexion: safeDetalle.costo_reconexion,
        consumo_base: safeDetalle.consumo_base,
        monto_base: safeDetalle.monto_base,
        consumo_exceso: safeDetalle.consumo_exceso,
        monto_exceso: safeDetalle.monto_exceso,
        es_primera_factura: isFirstInvoice,
        es_reconexion: isReconexion,
        tipo_factura: safeDetalle.tipo_factura,
        total: safeDetalle.total,
        tariff_id: reading.bill_details?.tariff_id ?? tariff.id ?? 0,
        detalle: safeDetalle
      };
    }

    if (factura) {
      factura.detalle = safeDetalle;
      factura.total = safeDetalle.total;
      factura.es_primera_factura = isFirstInvoice;
      factura.es_reconexion = isReconexion;
      factura.tipo_factura = safeDetalle.tipo_factura;
      if (!factura.nombre && user.name) factura.nombre = user.name;
      if (!factura.zona && user.address) factura.zona = user.address;
      if (!factura.categoria && user.category) factura.categoria = user.category;
    }

    if (!reading) {
      const notFoundErr = new Error(`No se encontró el documento de factura ni lectura para ID: "${id}"`);
      console.error('[cargarRecibo] Error real al buscar lectura:', notFoundErr);
      throw notFoundErr;
    }

    console.log('[cargarRecibo] Recibo y desglose cargados exitosamente:', {
      readingId: reading.id,
      userId: user.id,
      facturaId: factura?.factura_id || reading.factura_id,
      esPrimeraFactura: isFirstInvoice,
      desglose: safeDetalle
    });

    return { reading, user, tariff, factura };
  } catch (error) {
    console.error('[cargarRecibo] Error real al cargar el recibo:', error);
    throw error;
  }
}

// Alias de compatibilidad
export const getRecibo = cargarRecibo;

/**
 * Lógica de facturación:
 * En la función que genera lecturas mensuales, aplica este filtro:
 * if (usuario.estado != 'activo') skip. No generes facturas para suspendidos.
 */
export function shouldSkipBillingForUser(user: { estado?: string }): boolean {
  return Boolean(user.estado && user.estado !== 'activo');
}

/**
 * Procesa o genera el ciclo mensual de lecturas/facturas omitiendo usuarios suspendidos o dados de baja.
 */
export async function generarLecturasMensuales() {
  const allUsers = await db.users.toArray();
  const usuariosActivos = [];

  for (const usuario of allUsers) {
    // FILTRO REQUERIDO: Si el estado no es 'activo', saltar y no facturar
    if (usuario.estado && usuario.estado !== 'activo') {
      console.log(`[generarLecturasMensuales] Saltando usuario "${usuario.name}" (ID: ${usuario.id}) por estado "${usuario.estado}"`);
      continue;
    }
    usuariosActivos.push(usuario);
  }

  return usuariosActivos;
}
