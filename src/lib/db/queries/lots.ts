import { queryTenant, type TenantContext } from '../client'
import type { LotResum, AnimalDelLot } from '@/types/lots'

/**
 * Retorna tots els lots amb el recompte d'animals actius que contenen.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de lots amb nom, data de creació i nombre d'animals
 *
 * @remarks Control d'accés: lectura oberta als 3 rols (Admin,
 * Veterinari, Treballador) — docs/14_modul_lots.md.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 * @remarks COUNT() de PostgreSQL retorna bigint, que el driver pg
 * serialitza com a string per evitar pèrdua de precisió amb números
 * grans. Es converteix explícitament amb Number() abans de retornar,
 * igual que a la resta de queries del projecte amb COUNT (per exemple
 * getTotalAnimals a src/lib/db/queries/dashboard.ts) — sense aquesta
 * conversió, el camp arriba com a string al frontend i trenca
 * qualsevol ús numèric silenciosament.
 */
export async function getLotsAmbRecompte(ctx: TenantContext): Promise<LotResum[]> {
  const rows = await queryTenant<{
    id: number
    nomLot: string
    dataCreacio: string
    nombreAnimals: string
  }>(
    ctx,
    `SELECT
       l.id,
       l.nom_lot AS "nomLot",
       l.data_creacio AS "dataCreacio",
       COUNT(da.animal_id) AS "nombreAnimals"
     FROM lots l
     LEFT JOIN distribucio_animals da
       ON da.lot_id = l.id AND da.data_sortida IS NULL
     LEFT JOIN animals a
       ON a.id = da.animal_id AND a.estat_actiu = TRUE
     GROUP BY l.id, l.nom_lot, l.data_creacio
     ORDER BY l.data_creacio DESC`
  )

  return rows.map((r) => ({ ...r, nombreAnimals: Number(r.nombreAnimals) }))
}

/**
 * Retorna els animals actius que pertanyen a un lot concret.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param lotId - Id del lot
 * @returns Array d'animals del lot, amb raça i cort actual
 *
 * @remarks Control d'accés: lectura oberta als 3 rols.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getAnimalsDelLot(
  ctx: TenantContext,
  lotId: number
): Promise<AnimalDelLot[]> {
  return queryTenant<AnimalDelLot>(
    ctx,
    `SELECT
       a.id,
       a.dib,
       r.nom_raca AS "nomRaca",
       c.codi_cort AS "codiCort",
       da.data_entrada AS "dataEntrada"
     FROM distribucio_animals da
     JOIN animals a ON a.id = da.animal_id AND a.estat_actiu = TRUE
     LEFT JOIN corts c ON c.id = da.cort_id
     LEFT JOIN races_cataleg r ON r.id = a.raca_id
     WHERE da.lot_id = $1 AND da.data_sortida IS NULL
     ORDER BY a.dib`,
    [lotId]
  )
}

/**
 * Crea un nou lot.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param nomLot - Nom del lot nou
 * @returns L'id del lot creat
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function crearLot(
  ctx: TenantContext,
  nomLot: string
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO lots (nom_lot) VALUES ($1) RETURNING id`,
    [nomLot]
  )
  return rows[0]
}

/**
 * Mou un o més animals a un altre lot, tancant la seva distribució
 * actual i obrint-ne una de nova.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Animals a moure, lot de destí, i cort de destí opcional
 * @returns Nombre d'animals moguts
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Segueix el flux ja documentat a docs/08_modul_llistat_actius.md,
 * secció 3.3 (Flux de Canvi de Lot): per cada animal, es tanca la
 * distribucio_animals activa (data_sortida = avui) i se'n crea una
 * de nova amb el lot destí i la cort (l'actual si no se n'especifica
 * una de nova).
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Tota
 * l'operació s'executa en una única crida a queryTenant (una sola
 * transacció BEGIN/COMMIT) — si qualsevol animal fallés, tot el
 * moviment es desfà, evitant estats intermedis (alguns animals
 * moguts i altres no).
 */
export async function moureAnimalsDeLot(
  ctx: TenantContext,
  params: { animalIds: number[]; lotDestiId: number; cortDestiId?: number }
): Promise<{ nombreMoguts: number }> {
  const rows = await queryTenant<{ animal_id: number }>(
    ctx,
    `WITH tancament AS (
       UPDATE distribucio_animals
       SET data_sortida = CURRENT_DATE
       WHERE animal_id = ANY($1::integer[])
         AND data_sortida IS NULL
       RETURNING animal_id, cort_id
     ),
     nova_distribucio AS (
       INSERT INTO distribucio_animals (animal_id, lot_id, cort_id, data_entrada)
       SELECT
         animal_id,
         $2::integer,
         COALESCE($3::integer, cort_id),
         CURRENT_DATE
       FROM tancament
       RETURNING animal_id
     )
     SELECT animal_id FROM nova_distribucio`,
    [params.animalIds, params.lotDestiId, params.cortDestiId ?? null]
  )

  return { nombreMoguts: rows.length }
}
