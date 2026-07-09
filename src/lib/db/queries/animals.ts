import { queryTenant, type TenantContext } from '../client'
import type { AnimalActiu } from '@/types/db'

/**
 * Retorna tots els animals actius amb lot, cort, zona i edat calculada,
 * incloent si tenen bloqueig comercial actiu per període de supressió.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array d'animals actius, ordenats per crotal
 *
 * @remarks Control d'accés: visible per als 3 rols (Admin, Veterinari,
 * Treballador) — el llistat en si no és sensible; les accions
 * d'edició es restringeixen a nivell d'endpoint, no de lectura.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getAnimalsActius(ctx: TenantContext): Promise<AnimalActiu[]> {
  return queryTenant<AnimalActiu>(
    ctx,
    `SELECT
       va.id,
       va.crotal_id      AS "crotalId",
       va.dib,
       va.nom_raca       AS "nomRaca",
       va.data_naixement AS "dataNaixement",
       va.estat_salut    AS "estatSalut",
       va.sexe,
       va.nom_lot        AS "nomLot",
       va.codi_cort      AS "codiCort",
       va.nom_zona       AS "nomZona",
       va.data_entrada   AS "dataEntrada",
       va.edat_dies      AS "edatDies",
       (s.animal_id IS NOT NULL) AS "enSupressio"
     FROM v_animals_actius va
     LEFT JOIN v_animals_en_supressio s ON s.animal_id = va.id
     ORDER BY va.crotal_id`
  )
}

/**
 * Cerca animals actius per crotal (cerca parcial en temps real).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param terme - Text introduït pel cercador (coincidència parcial)
 * @returns Array d'animals que coincideixen, màxim 50 resultats
 *
 * @remarks Utilitza l'índex trigram idx_animals_crotal_trgm per a
 * cerques ILIKE eficients (veure database/02_schema_tenant_template.sql).
 * @remarks Control d'accés: visible per als 3 rols.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function cercarPerCrotal(
  ctx: TenantContext,
  terme: string
): Promise<AnimalActiu[]> {
  return queryTenant<AnimalActiu>(
    ctx,
    `SELECT
       id,
       crotal_id      AS "crotalId",
       dib,
       nom_raca       AS "nomRaca",
       data_naixement AS "dataNaixement",
       estat_salut    AS "estatSalut",
       sexe,
       nom_lot        AS "nomLot",
       codi_cort      AS "codiCort",
       nom_zona       AS "nomZona",
       data_entrada   AS "dataEntrada",
       edat_dies      AS "edatDies"
     FROM v_animals_actius
     WHERE crotal_id ILIKE $1
     ORDER BY crotal_id
     LIMIT 50`,
    [`%${terme}%`]
  )
}

/**
 * Registra el pes diari d'un animal.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Animal, data i pes en kg
 * @returns Promise que es resol un cop desat el registre
 *
 * @remarks Control d'accés: Admin i Treballador (docs/04_seguretat_i_rols.md,
 * secció 2.2 — "Llistat actius: lectura+creació" per a Treballador).
 * La comprovació de rol es fa a l'endpoint, no aquí.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
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

/**
 * Comprova quins crotal_id d'una llista ja existeixen a la base de dades.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param crotals - Llista de crotal_id a comprovar
 * @returns Array només amb els crotal_id que ja existeixen
 *
 * @remarks Utilitzat pel pas de previsualització de l'alta massiva
 * (docs/08_modul_llistat_actius.md, secció 4.3) per marcar files en
 * taronja quan el crotal ja és a la BD, sense bloquejar la importació.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function trobarCrotalsExistents(
  ctx: TenantContext,
  crotals: string[]
): Promise<string[]> {
  if (crotals.length === 0) return []
  const rows = await queryTenant<{ crotal_id: string }>(
    ctx,
    `SELECT crotal_id FROM animals WHERE crotal_id = ANY($1)`,
    [crotals]
  )
  return rows.map((r) => r.crotal_id)
}

/**
 * Catàleg de races disponibles (globals + pròpies del tenant).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de races ordenades alfabèticament
 *
 * @remarks Control d'accés: lectura oberta als 3 rols (necessari per
 * mostrar la raça a la graella, encara que només Admin la pugui triar).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getRacesCataleg(
  ctx: TenantContext
): Promise<{ id: number; nomRaca: string; esGlobal: boolean }[]> {
  return queryTenant(
    ctx,
    `SELECT id, nom_raca AS "nomRaca", es_global AS "esGlobal"
     FROM races_cataleg
     ORDER BY nom_raca`
  )
}

/**
 * Llistat de lots existents (per al desplegable d'assignació base).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de lots ordenats pel més recent primer
 *
 * @remarks Control d'accés: Admin (només es fa servir al flux d'altes,
 * restringit a Admin segons docs/08_modul_llistat_actius.md).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getLots(
  ctx: TenantContext
): Promise<{ id: number; nomLot: string }[]> {
  return queryTenant(
    ctx,
    `SELECT id, nom_lot AS "nomLot" FROM lots ORDER BY data_creacio DESC`
  )
}

/**
 * Llistat de corts existents amb el nom de la seva zona (per al
 * desplegable d'assignació base).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de corts amb el nom de zona per a context visual
 *
 * @remarks Control d'accés: Admin.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getCorts(
  ctx: TenantContext
): Promise<{ id: number; codiCort: string; nomZona: string }[]> {
  return queryTenant(
    ctx,
    `SELECT c.id, c.codi_cort AS "codiCort", z.nom AS "nomZona"
     FROM corts c
     JOIN zones_infraestructura z ON z.id = c.zona_id
     ORDER BY z.nom, c.codi_cort`
  )
}

/**
 * Crea un animal individual amb la seva distribució inicial (lot + cort).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Dades de l'animal i la seva ubicació inicial
 * @returns L'id de l'animal creat
 *
 * @remarks Control d'accés: Admin únicament (docs/08_modul_llistat_actius.md,
 * secció 5). Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Ambdós
 * INSERTs (animals + distribucio_animals) s'executen dins la mateixa
 * crida a queryTenant, que ja embolcalla en una transacció BEGIN/COMMIT
 * (veure src/lib/db/client.ts) — si el segon INSERT fallés, el primer
 * es desfaria també.
 */
export async function crearAnimalIndividual(
  ctx: TenantContext,
  params: {
    crotalId: string
    dib?: string
    racaId?: number
    dataNaixement?: string
    sexe?: 'Mascle' | 'Femella'
    lotId: number
    cortId: number
  }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `WITH nou_animal AS (
       INSERT INTO animals (crotal_id, dib, raca_id, data_naixement, sexe)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id
     ),
     nova_distribucio AS (
       INSERT INTO distribucio_animals (animal_id, lot_id, cort_id, data_entrada)
       SELECT id, $6, $7, CURRENT_DATE FROM nou_animal
     )
     SELECT id FROM nou_animal`,
    [
      params.crotalId,
      params.dib ?? null,
      params.racaId ?? null,
      params.dataNaixement ?? null,
      params.sexe ?? null,
      params.lotId,
      params.cortId,
    ]
  )
  return rows[0]
}

/**
 * Importa un bloc d'animals de cop (alta massiva), amb assignació
 * base comuna (raça, lot, cort) per a tots.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param animals - Files ja validades del CSV
 * @param assignacio - Raça, lot (existent o nou) i cort de destí
 * @returns Nombre d'animals creats
 *
 * @remarks Control d'accés: Admin únicament. Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Cada
 * crida a queryTenant s'executa dins la seva pròpia transacció
 * BEGIN/COMMIT (veure src/lib/db/client.ts). Si es crea un lot nou,
 * es fa en una query prèvia i separada per mantenir el SQL principal
 * simple i explícit — evitant condicionals dins del propi SQL, que
 * són fràgils de mantenir i proclius a desajustos en el nombre de
 * paràmetres enviats a `pg`.
 */
export async function importarAnimalsMassiu(
  ctx: TenantContext,
  animals: { crotalId: string; dib?: string; dataNaixement?: string; sexe?: 'Mascle' | 'Femella' }[],
  assignacio: { racaId: number; lotId: number | null; lotNouNom: string | null; cortId: number }
): Promise<{ nombreCreats: number }> {
  // Pas 1: resoldre el lot de destí (existent o crear-ne un de nou)
  let lotId = assignacio.lotId
  if (lotId === null) {
    if (!assignacio.lotNouNom) {
      throw new Error('Cal indicar un lot existent o el nom d\'un lot nou')
    }
    const lotRows = await queryTenant<{ id: number }>(
      ctx,
      `INSERT INTO lots (nom_lot) VALUES ($1) RETURNING id`,
      [assignacio.lotNouNom]
    )
    lotId = lotRows[0].id
  }

  // Pas 2: inserir tots els animals + les seves distribucions inicials
  const crotalIds = animals.map((a) => a.crotalId)
  const dibs = animals.map((a) => a.dib ?? null)
  const datesNaixement = animals.map((a) => a.dataNaixement ?? null)
  const sexes = animals.map((a) => a.sexe ?? null)

  const rows = await queryTenant<{ nombre_creats: string }>(
    ctx,
    `WITH nous_animals AS (
       INSERT INTO animals (crotal_id, dib, raca_id, data_naixement, sexe)
       SELECT
         crotal_id, dib, $5::integer, data_naixement::date, sexe::sexe_enum
       FROM UNNEST($1::text[], $2::text[], $3::text[], $4::text[])
         AS t(crotal_id, dib, data_naixement, sexe)
       RETURNING id
     ),
     noves_distribucions AS (
       INSERT INTO distribucio_animals (animal_id, lot_id, cort_id, data_entrada)
       SELECT id, $6::integer, $7::integer, CURRENT_DATE
       FROM nous_animals
     )
     SELECT COUNT(*) AS nombre_creats FROM nous_animals`,
    [crotalIds, dibs, datesNaixement, sexes, assignacio.racaId, lotId, assignacio.cortId]
  )

  return { nombreCreats: Number(rows[0]?.nombre_creats ?? 0) }
}
