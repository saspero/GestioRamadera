import { queryTenant, type TenantContext } from '../client'
import type { AnimalActiu } from '@/types/db'

/**
 * Retorna tots els animals actius amb lot, cort i edat calculada.
 */
export async function getAnimalsActius(ctx: TenantContext): Promise<AnimalActiu[]> {
  return queryTenant<AnimalActiu>(
    ctx,
    `SELECT * FROM v_animals_actius ORDER BY crotal_id`
  )
}

/**
 * Cerca animals per crotal (cerca parcial, usa l'índex trigram).
 */
export async function cercarPerCrotal(
  ctx: TenantContext,
  terme: string
): Promise<AnimalActiu[]> {
  return queryTenant<AnimalActiu>(
    ctx,
    `SELECT * FROM v_animals_actius
     WHERE crotal_id ILIKE $1
     ORDER BY crotal_id
     LIMIT 50`,
    [`%${terme}%`]
  )
}

/**
 * Registra el pes diari d'un animal.
 */
export async function registrarPes(
  ctx: TenantContext,
  params: { animalId: number; data: string; pesKg: number }
): Promise<void> {
  await queryTenant(
    ctx,
    `INSERT INTO registre_pes (animal_id, data, pes_kg, registrat_per)
     VALUES ($1, $2, $3, $4)`,
    [params.animalId, params.data, params.pesKg, ctx.userId]
  )
}
