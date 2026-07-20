import { queryTenant, type TenantContext } from '../client'
import type { Medicament, MedicamentCataleg, TractamentAmbMedicament } from '@/types/sanitari'

/**
 * Retorna tots els medicaments de l'inventari (entrades d'estoc),
 * amb les dades del catàleg incloses via JOIN i l'estoc total ja
 * calculat.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de medicaments
 *
 * @remarks Model d'estoc (juliol 2026, migració
 * 13_migracio_estoc_unitats_medicaments.sql): `quantitatEstocTotal`
 * es calcula a la mateixa query (`nombre_unitats * quantitat_per_unitat`),
 * no és una columna física.
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
    nombreUnitats: string
    unitatPaquet: string
    quantitatPerUnitat: string
    unitatContingut: string
    quantitatEstocTotal: string
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
       m.nombre_unitats        AS "nombreUnitats",
       m.unitat_paquet         AS "unitatPaquet",
       m.quantitat_per_unitat  AS "quantitatPerUnitat",
       m.unitat_contingut      AS "unitatContingut",
       (m.nombre_unitats * m.quantitat_per_unitat) AS "quantitatEstocTotal",
       mc.posologia_standard   AS "posologiaStandard",
       m.preu_compra           AS "preuCompra",
       mc.dies_supressio       AS "diesSupressio"
     FROM medicaments m
     JOIN medicaments_cataleg mc ON mc.id = m.medicament_cataleg_id
     ORDER BY mc.nom_medicament`
  )
  return rows.map((r) => ({
    ...r,
    nombreUnitats: Number(r.nombreUnitats),
    quantitatPerUnitat: Number(r.quantitatPerUnitat),
    quantitatEstocTotal: Number(r.quantitatEstocTotal),
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
 * Actualitza un medicament del catàleg (dades mestres).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param id - Id del medicament del catàleg
 * @param params - Nom, principi actiu, posologia i dies de supressió
 * @returns Promise que es resol un cop desat el canvi
 *
 * @remarks Nou (juliol 2026). `nom_medicament` UNIQUE — un nom
 * duplicat llençarà un error que l'endpoint ha de traduir.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function actualitzarMedicamentCataleg(
  ctx: TenantContext,
  id: number,
  params: {
    nomMedicament: string
    principiActiu: string
    posologiaStandard?: string
    diesSupressio: number
  }
): Promise<void> {
  await queryTenant(
    ctx,
    `UPDATE medicaments_cataleg
     SET nom_medicament = $1, principi_actiu = $2, posologia_standard = $3, dies_supressio = $4
     WHERE id = $5`,
    [params.nomMedicament, params.principiActiu, params.posologiaStandard ?? null, params.diesSupressio, id]
  )
}

/**
 * Elimina un medicament del catàleg.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param id - Id del medicament del catàleg
 * @returns Promise que es resol un cop eliminat
 *
 * @remarks Nou (juliol 2026). La FK `medicaments.medicament_cataleg_id`
 * és `ON DELETE RESTRICT` — si hi ha entrades d'estoc que en
 * depenen, la BD rebutja l'eliminació amb un error de constraint
 * que l'endpoint tradueix a un missatge clar.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function eliminarMedicamentCataleg(ctx: TenantContext, id: number): Promise<void> {
  await queryTenant(ctx, `DELETE FROM medicaments_cataleg WHERE id = $1`, [id])
}

/**
 * Afegeix una entrada d'estoc (compra/lot) d'un medicament ja
 * existent al catàleg.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Medicament del catàleg, lot, nombre d'unitats,
 * unitat de paquet, quantitat per unitat, unitat de contingut i preu
 * @returns L'id de l'entrada d'estoc creada
 *
 * @remarks Model d'estoc (juliol 2026): l'estoc total NO s'introdueix
 * a mà — es calcula com nombreUnitats × quantitatPerUnitat.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function afegirEntradaMedicament(
  ctx: TenantContext,
  params: {
    medicamentCatalegId: number
    lot: string
    nombreUnitats: number
    unitatPaquet: string
    quantitatPerUnitat: number
    unitatContingut: string
    preuCompra: number
  }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO medicaments (
       medicament_cataleg_id, lot, nombre_unitats, unitat_paquet,
       quantitat_per_unitat, unitat_contingut, preu_compra
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      params.medicamentCatalegId,
      params.lot,
      params.nombreUnitats,
      params.unitatPaquet,
      params.quantitatPerUnitat,
      params.unitatContingut,
      params.preuCompra,
    ]
  )
  return rows[0]
}

/**
 * Actualitza una entrada d'estoc existent.
 *
 * @remarks `medicamentCatalegId` NO és editable — es fixa en crear
 * l'entrada, igual que `ubicacioId` a una sitja.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function actualitzarEntradaMedicament(
  ctx: TenantContext,
  id: number,
  params: {
    lot: string
    nombreUnitats: number
    unitatPaquet: string
    quantitatPerUnitat: number
    unitatContingut: string
    preuCompra: number
  }
): Promise<void> {
  await queryTenant(
    ctx,
    `UPDATE medicaments
     SET lot = $1, nombre_unitats = $2, unitat_paquet = $3,
         quantitat_per_unitat = $4, unitat_contingut = $5, preu_compra = $6
     WHERE id = $7`,
    [
      params.lot,
      params.nombreUnitats,
      params.unitatPaquet,
      params.quantitatPerUnitat,
      params.unitatContingut,
      params.preuCompra,
      id,
    ]
  )
}

/**
 * Elimina una entrada d'estoc.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param id - Id de l'entrada d'estoc
 * @returns Promise que es resol un cop eliminada
 *
 * @remarks Nou (juliol 2026). Si hi ha tractaments que referencien
 * aquesta entrada (`tractaments.medicament_id`), la BD rebutjarà
 * l'eliminació per FK — l'endpoint tradueix l'error a un missatge clar.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function eliminarEntradaMedicament(ctx: TenantContext, id: number): Promise<void> {
  await queryTenant(ctx, `DELETE FROM medicaments WHERE id = $1`, [id])
}

/**
 * Comprova quines combinacions nom_medicament+lot ja existeixen com
 * a entrada d'estoc, per a la detecció de duplicats de la
 * importació CSV.
 *
 * @remarks Sense canvis respecte a la versió anterior.
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
 * l'id; si no, crea l'entrada de catàleg automàticament. Després,
 * si ja hi ha una entrada d'estoc amb el mateix lot, en suma
 * `nombre_unitats`; si no, en crea una de nova.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param medicaments - Files ja validades i convertides a números
 * @returns Recompte de catàlegs creats, entrades noves i entrades actualitzades
 *
 * @remarks Format del CSV ACTUALITZAT (juliol 2026) amb el nou model
 * d'estoc — `nombre_unitats`+`unitat_paquet`+`quantitat_per_unitat`+
 * `unitat_contingut` en comptes de `quantitat`+`unitat`.
 * @remarks En sumar a una entrada existent, només se suma
 * `nombre_unitats` — `quantitat_per_unitat` es manté la de l'entrada
 * ja existent (assumeix que el mateix lot ve sempre amb el mateix
 * envasat).
 * @remarks Control d'accés: Admin i Veterinari. Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function importarMedicamentsMassiu(
  ctx: TenantContext,
  medicaments: {
    nomMedicament: string
    principiActiu: string
    lot: string
    nombreUnitats: number
    unitatPaquet: string
    quantitatPerUnitat: number
    unitatContingut: string
    posologia?: string
    preu: number
    diesSupressio: number
  }[]
): Promise<{ nombreCatalegsCreats: number; nombreEntradesCreades: number; nombreEntradesActualitzades: number }> {
  let nombreCatalegsCreats = 0
  let nombreEntradesCreades = 0
  let nombreEntradesActualitzades = 0

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
        `UPDATE medicaments SET nombre_unitats = nombre_unitats + $1 WHERE id = $2`,
        [m.nombreUnitats, entradaExistent[0].id]
      )
      nombreEntradesActualitzades++
    } else {
      await queryTenant(
        ctx,
        `INSERT INTO medicaments (
           medicament_cataleg_id, lot, nombre_unitats, unitat_paquet,
           quantitat_per_unitat, unitat_contingut, preu_compra
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [catalegId, m.lot, m.nombreUnitats, m.unitatPaquet, m.quantitatPerUnitat, m.unitatContingut, m.preu]
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
 * @remarks Sense canvis respecte a la versió anterior.
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
 * @remarks Model d'estoc (juliol 2026): el descompte ja NO resta
 * directament d'un total (`quantitat_estoc`), sinó que resta
 * `dosiTotal / quantitat_per_unitat` de `nombre_unitats` — mantenint
 * `quantitat_per_unitat` fix, `nombre_unitats` pot quedar amb
 * decimals (Ex: 9,4 ampolles de 50ml restants després de descomptar
 * 30ml). El càlcul es fa dins la mateixa UPDATE (referenciant
 * quantitat_per_unitat de la mateixa fila), no cal llegir-lo abans.
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
       SET nombre_unitats = nombre_unitats - ($9::decimal / quantitat_per_unitat)
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

/**
 * Actualitza un tractament ja aplicat (dosi, data de fi prevista i notes).
 *
 * @remarks NOMÉS aquests tres camps són editables — l'animal, el
 * medicament i la data d'inici no es poden canviar un cop aplicat
 * el tractament.
 * @remarks NO ajusta retroactivament l'estoc del medicament — el
 * descompte ja es va fer en aplicar el tractament originalment.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function actualitzarTractament(
  ctx: TenantContext,
  id: number,
  params: { dosiAplicada?: number; dataFiPrevista?: string; notes?: string }
): Promise<void> {
  await queryTenant(
    ctx,
    `UPDATE tractaments
     SET dosi_aplicada = $1, data_fi_prevista = $2, notes = $3
     WHERE id = $4`,
    [params.dosiAplicada ?? null, params.dataFiPrevista ?? null, params.notes ?? null, id]
  )
}

/**
 * Elimina un tractament (DELETE real — decisió confirmada amb
 * l'usuari), després de desar-ne una còpia (snapshot) al log
 * d'eliminacions amb el motiu indicat.
 *
 * @remarks IMPORTANT: si l'animal encara estava en període de
 * supressió per aquest tractament, eliminar-lo aixeca el bloqueig
 * comercial a l'instant.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function eliminarTractament(
  ctx: TenantContext,
  id: number,
  params: { motiu: string; motiuAltres?: string }
): Promise<boolean> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `WITH tractament_eliminat AS (
       DELETE FROM tractaments t
       WHERE t.id = $1
       RETURNING t.id, t.animal_id, t.medicament_id, t.data_inici,
                 t.data_alliberament, t.dosi_aplicada, t.unitat_dosi
     ),
     dades AS (
       SELECT
         te.id, te.animal_id, a.dib AS animal_dib,
         mc.nom_medicament,
         te.data_inici, te.data_alliberament, te.dosi_aplicada, te.unitat_dosi
       FROM tractament_eliminat te
       JOIN animals a              ON a.id = te.animal_id
       JOIN medicaments m          ON m.id = te.medicament_id
       JOIN medicaments_cataleg mc ON mc.id = m.medicament_cataleg_id
     )
     INSERT INTO tractaments_eliminats_log (
       tractament_id_original, animal_id, animal_dib, nom_medicament,
       data_inici, data_alliberament, dosi_aplicada, unitat_dosi,
       motiu, motiu_altres, eliminat_per
     )
     SELECT id, animal_id, animal_dib, nom_medicament,
            data_inici, data_alliberament, dosi_aplicada, unitat_dosi,
            $2, $3, $4
     FROM dades
     RETURNING id`,
    [id, params.motiu, params.motiuAltres ?? null, ctx.userId]
  )
  return rows.length > 0
}
