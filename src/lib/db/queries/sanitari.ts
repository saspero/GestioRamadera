import { queryTenant, type TenantContext } from '../client'
import type { Medicament, MedicamentCataleg, TractamentAmbMedicament } from '@/types/sanitari'

/**
 * Retorna tots els medicaments de l'inventari (entrades d'estoc),
 * amb les dades del catàleg incloses via JOIN.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de medicaments
 *
 * @remarks Des de la migració 10_migracio_cataleg_medicaments.sql,
 * nom/principiActiu/posologiaStandard/diesSupressio ja no viuen a
 * `medicaments` — es llegeixen via JOIN a `medicaments_cataleg`.
 * @remarks Control d'accés: Admin i Veterinari (lectura+escriptura),
 * Treballador només lectura.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getMedicaments(ctx: TenantContext): Promise<Medicament[]> {
  const rows = await queryTenant<{
    id: number
    medicamentCatalegId: number
    nomMedicament: string
    principiActiu: string
    lot: string
    quantitatEstoc: string
    unitatEstoc: string
    posologiaStandard: string | null
    preuCompra: string
    diesSupressio: number
  }>(
    ctx,
    `SELECT
       m.id,
       m.medicament_cataleg_id AS "medicamentCatalegId",
       mc.nom_medicament       AS "nomMedicament",
       mc.principi_actiu       AS "principiActiu",
       m.lot,
       m.quantitat_estoc       AS "quantitatEstoc",
       m.unitat_estoc          AS "unitatEstoc",
       mc.posologia_standard   AS "posologiaStandard",
       m.preu_compra           AS "preuCompra",
       mc.dies_supressio       AS "diesSupressio"
     FROM medicaments m
     JOIN medicaments_cataleg mc ON mc.id = m.medicament_cataleg_id
     ORDER BY mc.nom_medicament`
  )
  return rows.map((r) => ({
    ...r,
    quantitatEstoc: Number(r.quantitatEstoc),
    preuCompra: Number(r.preuCompra),
  }))
}

/**
 * Retorna el catàleg complet de medicaments (dades mestres).
 *
 * @remarks Control d'accés: Admin i Veterinari (lectura+escriptura),
 * Treballador només lectura.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getMedicamentsCataleg(ctx: TenantContext): Promise<MedicamentCataleg[]> {
  return queryTenant<MedicamentCataleg>(
    ctx,
    `SELECT
       id,
       nom_medicament     AS "nomMedicament",
       principi_actiu     AS "principiActiu",
       posologia_standard AS "posologiaStandard",
       dies_supressio     AS "diesSupressio"
     FROM medicaments_cataleg
     ORDER BY nom_medicament`
  )
}

/**
 * Crea un medicament nou al catàleg (només dades mestres, sense estoc).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Nom, principi actiu, posologia i dies de supressió
 * @returns L'id del medicament del catàleg creat
 *
 * @remarks `nom_medicament` té una constraint UNIQUE — un nom
 * duplicat llençarà un error que l'endpoint ha de traduir a un
 * missatge clar.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function crearMedicamentCataleg(
  ctx: TenantContext,
  params: {
    nomMedicament: string
    principiActiu: string
    posologiaStandard?: string
    diesSupressio: number
  }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO medicaments_cataleg (nom_medicament, principi_actiu, posologia_standard, dies_supressio)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [params.nomMedicament, params.principiActiu, params.posologiaStandard ?? null, params.diesSupressio]
  )
  return rows[0]
}

/**
 * Afegeix una entrada d'estoc (compra/lot) d'un medicament ja
 * existent al catàleg.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Medicament del catàleg, lot, quantitat, unitat i preu
 * @returns L'id de l'entrada d'estoc creada
 *
 * @remarks Substitueix l'antiga crearMedicament() (que creava
 * catàleg+estoc alhora) — ara el catàleg ja ha d'existir prèviament
 * (creat amb crearMedicamentCataleg o automàticament per la
 * importació CSV).
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function afegirEntradaMedicament(
  ctx: TenantContext,
  params: {
    medicamentCatalegId: number
    lot: string
    quantitatEstoc: number
    unitatEstoc: string
    preuCompra: number
  }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO medicaments (medicament_cataleg_id, lot, quantitat_estoc, unitat_estoc, preu_compra)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [params.medicamentCatalegId, params.lot, params.quantitatEstoc, params.unitatEstoc, params.preuCompra]
  )
  return rows[0]
}

/**
 * Comprova quines combinacions nom_medicament+lot ja existeixen com
 * a entrada d'estoc, per a la detecció de duplicats de la
 * importació CSV.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param combinacions - Parells [nomMedicament, lot] a comprovar
 * @returns Array dels ids d'entrada d'estoc existents, indexat pel
 * mateix ordre que `combinacions` (null si no existeix)
 *
 * @remarks El nom es resol contra el catàleg via JOIN — si el
 * medicament encara no existeix al catàleg, automàticament no hi
 * ha cap entrada d'estoc que hi coincideixi (retorna null), cosa
 * correcta.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function trobarEntradesExistents(
  ctx: TenantContext,
  combinacions: { nomMedicament: string; lot: string }[]
): Promise<(number | null)[]> {
  if (combinacions.length === 0) return []

  const noms = combinacions.map((c) => c.nomMedicament)
  const lots = combinacions.map((c) => c.lot)

  const rows = await queryTenant<{ id: number; nom_medicament: string; lot: string }>(
    ctx,
    `SELECT m.id, mc.nom_medicament, m.lot
     FROM medicaments m
     JOIN medicaments_cataleg mc ON mc.id = m.medicament_cataleg_id
     WHERE (mc.nom_medicament, m.lot) IN (
       SELECT * FROM UNNEST($1::text[], $2::text[])
     )`,
    [noms, lots]
  )

  return combinacions.map((c) => {
    const trobat = rows.find((r) => r.nom_medicament === c.nomMedicament && r.lot === c.lot)
    return trobat?.id ?? null
  })
}

/**
 * Importa un bloc de medicaments des del CSV. Per a cada fila:
 * si el nom del medicament ja existeix al catàleg, en reutilitza
 * l'id (ignorant principi actiu/posologia/dies de supressió del
 * CSV, que podrien no coincidir amb el catàleg ja existent); si no
 * existeix, crea l'entrada de catàleg automàticament amb les dades
 * de la fila. Després, si ja hi ha una entrada d'estoc amb el mateix
 * lot per a aquest medicament, en suma la quantitat; si no, en crea
 * una de nova.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param medicaments - Files ja validades i convertides a números
 * @returns Recompte de catàlegs creats, entrades noves i entrades actualitzades
 *
 * @remarks Format del CSV SENSE CANVIS (decisió confirmada amb
 * l'usuari) — cada fila continua portant totes les dades del
 * medicament, encara que ja estigui cataloguat, per mantenir la
 * comoditat d'importar directament des d'un albarà de proveïdor.
 * @remarks Control d'accés: Admin i Veterinari. Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Cada
 * fila es processa amb crides pròpies (no una única transacció
 * gegant) — un error en una fila no ha de desfer les altres ja
 * processades correctament.
 */
export async function importarMedicamentsMassiu(
  ctx: TenantContext,
  medicaments: {
    nomMedicament: string
    principiActiu: string
    lot: string
    quantitat: number
    unitat: string
    posologia?: string
    preu: number
    diesSupressio: number
  }[]
): Promise<{ nombreCatalegsCreats: number; nombreEntradesCreades: number; nombreEntradesActualitzades: number }> {
  let nombreCatalegsCreats = 0
  let nombreEntradesCreades = 0
  let nombreEntradesActualitzades = 0

  // Precàrrega dels catàlegs existents que coincideixin amb els noms del bloc
  const nomsUnics = [...new Set(medicaments.map((m) => m.nomMedicament))]
  const catalegsExistents = await queryTenant<{ id: number; nom_medicament: string }>(
    ctx,
    `SELECT id, nom_medicament FROM medicaments_cataleg WHERE nom_medicament = ANY($1::text[])`,
    [nomsUnics]
  )
  const catalegPerNom = new Map(catalegsExistents.map((c) => [c.nom_medicament, c.id]))

  for (const m of medicaments) {
    let catalegId = catalegPerNom.get(m.nomMedicament)

    if (catalegId === undefined) {
      const rows = await queryTenant<{ id: number }>(
        ctx,
        `INSERT INTO medicaments_cataleg (nom_medicament, principi_actiu, posologia_standard, dies_supressio)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [m.nomMedicament, m.principiActiu, m.posologia || null, m.diesSupressio]
      )
      catalegId = rows[0].id
      catalegPerNom.set(m.nomMedicament, catalegId)
      nombreCatalegsCreats++
    }

    const entradaExistent = await queryTenant<{ id: number }>(
      ctx,
      `SELECT id FROM medicaments WHERE medicament_cataleg_id = $1 AND lot = $2`,
      [catalegId, m.lot]
    )

    if (entradaExistent.length > 0) {
      await queryTenant(
        ctx,
        `UPDATE medicaments SET quantitat_estoc = quantitat_estoc + $1 WHERE id = $2`,
        [m.quantitat, entradaExistent[0].id]
      )
      nombreEntradesActualitzades++
    } else {
      await queryTenant(
        ctx,
        `INSERT INTO medicaments (medicament_cataleg_id, lot, quantitat_estoc, unitat_estoc, preu_compra)
         VALUES ($1, $2, $3, $4, $5)`,
        [catalegId, m.lot, m.quantitat, m.unitat, m.preu]
      )
      nombreEntradesCreades++
    }
  }

  return { nombreCatalegsCreats, nombreEntradesCreades, nombreEntradesActualitzades }
}

/**
 * Retorna els tractaments aplicats, amb el nom del medicament i el
 * DIB de l'animal, ordenats pels més recents primer.
 *
 * @remarks JOIN afegit a medicaments_cataleg per obtenir el nom
 * (ja no viu a medicaments des de la migració del catàleg).
 * @remarks Control d'accés: Admin, Veterinari, i Treballador (lectura).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getTractaments(
  ctx: TenantContext,
  limit = 100
): Promise<TractamentAmbMedicament[]> {
  const rows = await queryTenant<{
    id: number
    animalId: number
    animalDib: string
    nomMedicament: string
    dataInici: string
    dataFiPrevista: string | null
    dataAlliberament: string | null
    dosiAplicada: string | null
    unitatDosi: string | null
    notes: string | null
  }>(
    ctx,
    `SELECT
       t.id,
       t.animal_id         AS "animalId",
       a.dib               AS "animalDib",
       mc.nom_medicament   AS "nomMedicament",
       t.data_inici        AS "dataInici",
       t.data_fi_prevista  AS "dataFiPrevista",
       t.data_alliberament AS "dataAlliberament",
       t.dosi_aplicada     AS "dosiAplicada",
       t.unitat_dosi       AS "unitatDosi",
       t.notes
     FROM tractaments t
     JOIN animals a              ON a.id = t.animal_id
     JOIN medicaments m          ON m.id = t.medicament_id
     JOIN medicaments_cataleg mc ON mc.id = m.medicament_cataleg_id
     ORDER BY t.data_inici DESC, t.id DESC
     LIMIT $1`,
    [limit]
  )
  return rows.map((r) => ({
    ...r,
    dosiAplicada: r.dosiAplicada !== null ? Number(r.dosiAplicada) : null,
  }))
}

/**
 * Aplica un tractament a un o més animals (individual o per lot,
 * amb la mateixa dosi/data per a tots), i desconta la dosi total de
 * l'estoc del medicament.
 *
 * @remarks Sense canvis funcionals respecte a la versió anterior —
 * `medicaments.id` (l'entrada d'estoc concreta triada al formulari)
 * segueix sent el que es referencia, no el catàleg.
 * @remarks Control d'accés: Admin i Veterinari. Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function aplicarTractament(
  ctx: TenantContext,
  params: {
    animalIds: number[]
    medicamentId: number
    dataInici: string
    dataFiPrevista?: string
    dosiAplicada?: number
    unitatDosi?: string
    notes?: string
  }
): Promise<{ nombreTractaments: number }> {
  const animalIds = params.animalIds
  const dosiTotal = (params.dosiAplicada ?? 0) * animalIds.length

  const rows = await queryTenant<{ id: number }>(
    ctx,
    `WITH nous_tractaments AS (
       INSERT INTO tractaments (
         animal_id, medicament_id, data_inici, data_fi_prevista,
         dosi_aplicada, unitat_dosi, notes, aplicat_per
       )
       SELECT
         animal_id, $2::integer, $3::date, $4::date,
         $5::decimal, $6, $7, $8
       FROM UNNEST($1::integer[]) AS t(animal_id)
       RETURNING id
     ),
     descompte_estoc AS (
       UPDATE medicaments
       SET quantitat_estoc = quantitat_estoc - $9
       WHERE id = $2::integer
     )
     SELECT id FROM nous_tractaments`,
    [
      animalIds,
      params.medicamentId,
      params.dataInici,
      params.dataFiPrevista ?? null,
      params.dosiAplicada ?? null,
      params.unitatDosi ?? null,
      params.notes ?? null,
      ctx.userId,
      dosiTotal,
    ]
  )

  return { nombreTractaments: rows.length }
}

/**
 * Retorna els ids dels animals actius d'un lot (per a l'aplicació
 * de tractament "Per lot").
 *
 * @remarks Sense canvis respecte a la versió anterior.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getAnimalIdsDelLot(
  ctx: TenantContext,
  lotId: number
): Promise<number[]> {
  const rows = await queryTenant<{ animal_id: number }>(
    ctx,
    `SELECT da.animal_id
     FROM distribucio_animals da
     JOIN animals a ON a.id = da.animal_id AND a.estat_actiu = TRUE
     WHERE da.lot_id = $1 AND da.data_sortida IS NULL`,
    [lotId]
  )
  return rows.map((r) => r.animal_id)
}
