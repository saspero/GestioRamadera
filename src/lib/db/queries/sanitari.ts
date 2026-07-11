import { queryTenant, type TenantContext } from '../client'
import type { Medicament, TractamentAmbMedicament } from '@/types/sanitari'

/**
 * Retorna tots els medicaments de l'inventari, ordenats per nom.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de medicaments
 *
 * @remarks Control d'accés: Admin i Veterinari (lectura+escriptura),
 * Treballador només lectura — ampliació sobre docs/06_modul_sanitari.md,
 * secció 1, que reservava l'accés exclusivament a Admin/Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getMedicaments(ctx: TenantContext): Promise<Medicament[]> {
  const rows = await queryTenant<{
    id: number
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
       id,
       nom_medicament     AS "nomMedicament",
       principi_actiu     AS "principiActiu",
       lot,
       quantitat_estoc    AS "quantitatEstoc",
       unitat_estoc       AS "unitatEstoc",
       posologia_standard AS "posologiaStandard",
       preu_compra        AS "preuCompra",
       dies_supressio     AS "diesSupressio"
     FROM medicaments
     ORDER BY nom_medicament`
  )
  return rows.map((r) => ({
    ...r,
    quantitatEstoc: Number(r.quantitatEstoc),
    preuCompra: Number(r.preuCompra),
  }))
}

/**
 * Crea un medicament individualment (formulari, no CSV).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Camps de la fitxa del medicament
 * @returns L'id del medicament creat
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function crearMedicament(
  ctx: TenantContext,
  params: {
    nomMedicament: string
    principiActiu: string
    lot: string
    quantitatEstoc: number
    unitatEstoc: string
    posologiaStandard?: string
    preuCompra: number
    diesSupressio: number
  }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO medicaments (
       nom_medicament, principi_actiu, lot, quantitat_estoc,
       unitat_estoc, posologia_standard, preu_compra, dies_supressio
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      params.nomMedicament,
      params.principiActiu,
      params.lot,
      params.quantitatEstoc,
      params.unitatEstoc,
      params.posologiaStandard ?? null,
      params.preuCompra,
      params.diesSupressio,
    ]
  )
  return rows[0]
}

/**
 * Comprova quines combinacions nom_medicament+lot ja existeixen a la
 * BD, per a la detecció de duplicats de la importació CSV.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param combinacions - Parells [nomMedicament, lot] a comprovar
 * @returns Array dels ids de medicament existents, indexat pel
 * mateix ordre que `combinacions` (null si no existeix)
 *
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function trobarMedicamentsExistents(
  ctx: TenantContext,
  combinacions: { nomMedicament: string; lot: string }[]
): Promise<(number | null)[]> {
  if (combinacions.length === 0) return []

  const noms = combinacions.map((c) => c.nomMedicament)
  const lots = combinacions.map((c) => c.lot)

  const rows = await queryTenant<{ id: number; nom_medicament: string; lot: string }>(
    ctx,
    `SELECT id, nom_medicament, lot
     FROM medicaments
     WHERE (nom_medicament, lot) IN (
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
 * Importa un bloc de medicaments des del CSV. Si una fila coincideix
 * amb un medicament existent (mateix nom+lot), suma la quantitat a
 * l'estoc actual en comptes de crear un registre duplicat.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param medicaments - Files ja validades i convertides a números
 * @returns Nombre de medicaments creats i actualitzats
 *
 * @remarks Control d'accés: Admin i Veterinari. Comprovat a l'endpoint.
 * @remarks Decisió confirmada amb l'usuari: la detecció de duplicats
 * SEMPRE actualitza l'estoc sumant la quantitat (docs/06_modul_sanitari.md,
 * secció 3.3, parcialment simplificat — el document original oferia
 * triar entre actualitzar o crear un registre independent; s'ha optat
 * per l'actualització automàtica, sense demanar-ho a l'usuari).
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Cada
 * fila del bloc es processa amb una crida pròpia a queryTenant (cada
 * una la seva pròpia transacció) — no es fa una única transacció
 * gegant perquè un error en una fila no ha de desfer les altres ja
 * processades correctament (a diferència de l'alta massiva
 * d'animals, on totes les files formen un únic lot atòmic).
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
): Promise<{ nombreCreats: number; nombreActualitzats: number }> {
  let nombreCreats = 0
  let nombreActualitzats = 0

  const existents = await trobarMedicamentsExistents(
    ctx,
    medicaments.map((m) => ({ nomMedicament: m.nomMedicament, lot: m.lot }))
  )

  for (let i = 0; i < medicaments.length; i++) {
    const m = medicaments[i]
    const idExistent = existents[i]

    if (idExistent !== null) {
      await queryTenant(
        ctx,
        `UPDATE medicaments SET quantitat_estoc = quantitat_estoc + $1 WHERE id = $2`,
        [m.quantitat, idExistent]
      )
      nombreActualitzats++
    } else {
      await queryTenant(
        ctx,
        `INSERT INTO medicaments (
           nom_medicament, principi_actiu, lot, quantitat_estoc,
           unitat_estoc, posologia_standard, preu_compra, dies_supressio
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          m.nomMedicament,
          m.principiActiu,
          m.lot,
          m.quantitat,
          m.unitat,
          m.posologia || null,
          m.preu,
          m.diesSupressio,
        ]
      )
      nombreCreats++
    }
  }

  return { nombreCreats, nombreActualitzats }
}

/**
 * Retorna els tractaments aplicats, amb el nom del medicament i el
 * DIB de l'animal, ordenats pels més recents primer.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param limit - Nombre màxim de tractaments a retornar (per defecte 100)
 * @returns Array de tractaments
 *
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
       m.nom_medicament    AS "nomMedicament",
       t.data_inici        AS "dataInici",
       t.data_fi_prevista  AS "dataFiPrevista",
       t.data_alliberament AS "dataAlliberament",
       t.dosi_aplicada     AS "dosiAplicada",
       t.unitat_dosi       AS "unitatDosi",
       t.notes
     FROM tractaments t
     JOIN animals a     ON a.id = t.animal_id
     JOIN medicaments m ON m.id = t.medicament_id
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
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Animals, medicament i dades del tractament
 * @returns Nombre de tractaments creats
 *
 * @remarks Control d'accés: Admin i Veterinari. Comprovat a l'endpoint.
 * @remarks data_alliberament es calcula automàticament pel trigger
 * de BD trg_tractament_alliberament (data_inici + dies_supressio del
 * medicament) — no es calcula aquí (docs/02_model_de_dades.md).
 * @remarks Decisió confirmada amb l'usuari: NO es bloqueja l'aplicació
 * si la dosi total supera l'estoc disponible — l'estoc pot quedar
 * negatiu i es gestiona manualment (docs/06_modul_sanitari.md,
 * secció 4.2, ampliat).
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Tots els
 * INSERTs de tractaments + el descompte d'estoc s'executen en una
 * única crida a queryTenant (una sola transacció) — si qualsevol
 * animal fallés, tot el bloc es desfà.
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
 * de tractament "Per lot", que necessita expandir el lot a la seva
 * llista d'animals abans de cridar aplicarTractament).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param lotId - Id del lot
 * @returns Array d'ids d'animals actius del lot
 *
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
