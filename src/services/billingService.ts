import { db, type User, type Reading, type Tariff, type UserCategory } from '../database/db';

export function calculateBill(consumption: number, tariff: Tariff, isFirstReading: boolean = false) {
  if (isFirstReading) {
    return {
      water_cost: 0,
      fixed_charge: 0,
      sewer_cost: 0,
      total: tariff.tarifa_conexion || 0,
      tariff_id: tariff.id!
    };
  }

  let water_cost = 0;
  
  if (consumption <= 20) {
    water_cost = consumption * tariff.costo_m3_base;
  } else {
    water_cost = (20 * tariff.costo_m3_base) + ((consumption - 20) * tariff.costo_m3_exceso);
  }

  const fixed_charge = tariff.cargo_fijo_mensual;
  const porcentaje = tariff.porcentaje_alcantarillado ?? 20;
  const sewer_cost = water_cost * (porcentaje / 100);
  const total = water_cost + fixed_charge + sewer_cost;

  return {
    water_cost,
    fixed_charge,
    sewer_cost,
    total,
    tariff_id: tariff.id!
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
