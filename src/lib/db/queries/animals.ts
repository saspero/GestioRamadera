import { queryTenant, type TenantContext } from '../client'
import type { AnimalActiu } from '@/types/db'

/**
 * Retorna tots els animals actius amb lot, cort, zona i edat calculada,
 * incloent si tenen bloqueig comercial actiu per període de supressió.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array d'animals actius, ordenats per DIB
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
     ORDER BY va.dib`
  )
}

/**
 * Cerca animals actius pel DIB (cerca parcial en temps real).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param terme - Text introduït pel cercador (coincidència parcial)
 * @returns Array d'animals que coincideixen, màxim 50 resultats
 *
 * @remarks Utilitza l'índex trigram idx_animals_dib_trgm per a
 * cerques ILIKE eficients (veure database/02_schema_tenant_template.sql).
 * @remarks Control d'accés: visible per als 3 rols.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function cercarPerDib(
  ctx: TenantContext,
  terme: string
): Promise<AnimalActiu[]> {
  return queryTenant<AnimalActiu>(
    ctx,
    `SELECT
       id,
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
     WHERE dib ILIKE $1
     ORDER BY dib
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
 * Comprova quins DIB d'una llista ja existeixen a la base de dades.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param dibs - Llista de DIB a comprovar
 * @returns Array només amb els DIB que ja existeixen
 *
 * @remarks Utilitzat pel pas de previsualització de l'alta massiva
 * (docs/08_modul_llistat_actius.md, secció 4.3) per marcar files en
 * taronja quan el DIB ja és a la BD, sense bloquejar la importació.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function trobarDibsExistents(
  ctx: TenantContext,
  dibs: string[]
): Promise<string[]> {
  if (dibs.length === 0) return []
  const rows = await queryTenant<{ dib: string }>(
    ctx,
    `SELECT dib FROM animals WHERE dib = ANY($1)`,
    [dibs]
  )
  return rows.map((r) => r.dib)
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
    dib: string
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
       INSERT INTO animals (dib, raca_id, data_naixement, sexe)
       VALUES ($1, $2, $3, $4)
       RETURNING id
     ),
     nova_distribucio AS (
       INSERT INTO distribucio_animals (animal_id, lot_id, cort_id, data_entrada)
       SELECT id, $5, $6, CURRENT_DATE FROM nou_animal
     )
     SELECT id FROM nou_animal`,
    [
      params.dib,
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
 * Resol un conjunt de noms de lot a IDs, creant els que no existeixin.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param nomsLot - Noms de lot únics a resoldre (buit si cap fila en té)
 * @returns Mapa nom de lot → id (existent o acabat de crear)
 *
 * @remarks Utilitzat pel flux d'alta massiva quan les files del CSV
 * indiquen un `lot_nom` propi (docs/08_modul_llistat_actius.md,
 * secció 4.2 — ampliació de lot opcional per fila). Cada nom nou
 * es crea com un lot independent; si dues files diferents demanen
 * el mateix nom encara inexistent, es crea un únic lot compartit.
 * @remarks Control d'accés: Admin únicament (cridada només des del
 * flux d'alta massiva). Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function resoldreLotsPerNom(
  ctx: TenantContext,
  nomsLot: string[]
): Promise<Map<string, number>> {
  const resultat = new Map<string, number>()
  if (nomsLot.length === 0) return resultat

  const nomsUnics = [...new Set(nomsLot)]

  const existents = await queryTenant<{ id: number; nom_lot: string }>(
    ctx,
    `SELECT id, nom_lot FROM lots WHERE nom_lot = ANY($1)`,
    [nomsUnics]
  )
  existents.forEach((l) => resultat.set(l.nom_lot, l.id))

  const pendents = nomsUnics.filter((n) => !resultat.has(n))
  if (pendents.length > 0) {
    const creats = await queryTenant<{ id: number; nom_lot: string }>(
      ctx,
      `INSERT INTO lots (nom_lot)
       SELECT nom FROM UNNEST($1::text[]) AS t(nom)
       RETURNING id, nom_lot`,
      [pendents]
    )
    creats.forEach((l) => resultat.set(l.nom_lot, l.id))
  }

  return resultat
}

/**
 * Importa un bloc d'animals de cop (alta massiva), amb assignació
 * base comuna (raça i cort) per a tots, i lot opcional per fila.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param animals - Files ja validades del CSV; `lotId` opcional per fila
 * @param assignacio - Raça, lot per defecte (existent o nou) i cort de destí
 * @returns Nombre d'animals creats
 *
 * @remarks Control d'accés: Admin únicament. Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Cada
 * crida a queryTenant s'executa dins la seva pròpia transacció
 * BEGIN/COMMIT (veure src/lib/db/client.ts). Si es crea un lot nou,
 * es fa en una query prèvia i separada per mantenir el SQL principal
 * simple i explícit.
 * @remarks Lot per fila: si una fila del CSV especifica `lotId`,
 * aquest té prioritat sobre el lot per defecte de `assignacio` per a
 * aquell animal concret (docs/08_modul_llistat_actius.md, secció 4.2
 * — ampliació: el lot per defecte és opcional de sobreescriure per fila).
 */
export async function importarAnimalsMassiu(
  ctx: TenantContext,
  animals: {
    dib: string
    dataNaixement?: string
    sexe?: 'Mascle' | 'Femella'
    lotId?: number
  }[],
  assignacio: { racaId: number; lotId: number | null; lotNouNom: string | null; cortId: number }
): Promise<{ nombreCreats: number }> {
  // Pas 1: resoldre el lot de destí PER DEFECTE (existent o crear-ne un de nou).
  // Les files amb lotId propi ignoren aquest valor.
  let lotPerDefecte = assignacio.lotId
  if (lotPerDefecte === null) {
    if (!assignacio.lotNouNom) {
      throw new Error('Cal indicar un lot existent o el nom d\'un lot nou')
    }
    const lotRows = await queryTenant<{ id: number }>(
      ctx,
      `INSERT INTO lots (nom_lot) VALUES ($1) RETURNING id`,
      [assignacio.lotNouNom]
    )
    lotPerDefecte = lotRows[0].id
  }

  // Pas 2: inserir tots els animals + les seves distribucions inicials.
  // lotsFinals aplica el lot propi de la fila si en té, o el per defecte.
  const dibs = animals.map((a) => a.dib)
  const datesNaixement = animals.map((a) => a.dataNaixement ?? null)
  const sexes = animals.map((a) => a.sexe ?? null)
  const lotsFinals = animals.map((a) => a.lotId ?? lotPerDefecte)

  // Una única query amb CTEs encadenades, dins la mateixa transacció
  // que aplica queryTenant() — si qualsevol INSERT falla, tot es desfà
  // (atomicitat completa: lot nou + animals + distribucions, o res).
  // L'aparellament animal↔lot es fa per `dib` (no per ordre/posició,
  // que PostgreSQL no garanteix entre un INSERT...SELECT i el seu
  // RETURNING quan hi ha CTEs pel mig). És segur perquè dins d'aquesta
  // mateixa transacció cada dib del bloc és necessàriament únic: ja
  // validat sense duplicats interns (Zod) i sense duplicats contra la
  // BD (trobarDibsExistents, cridat abans a l'endpoint bulk-import).
  const rows = await queryTenant<{ animal_id: number; lot_id: number }>(
    ctx,
    `WITH files AS (
       SELECT dib, data_naixement, sexe, lot_id, ordinality
       FROM UNNEST($1::text[], $2::text[], $3::text[], $4::integer[])
         WITH ORDINALITY AS t(dib, data_naixement, sexe, lot_id, ordinality)
     ),
     nous_animals AS (
       INSERT INTO animals (dib, raca_id, data_naixement, sexe)
       SELECT f.dib, $5::integer, f.data_naixement::date, f.sexe::sexe_enum
       FROM files f
       ORDER BY f.ordinality
       RETURNING id, dib
     ),
     -- Reaparellem per dib (UNIQUE a la BD i validat sense duplicats
     -- abans d'arribar aquí) per assignar el lot correcte a cada animal
     -- creat, sense dependre de cap ordre implícit d'execució.
     animals_amb_lot AS (
       SELECT na.id AS animal_id, f.lot_id
       FROM nous_animals na
       JOIN files f ON f.dib = na.dib
     ),
     noves_distribucions AS (
       INSERT INTO distribucio_animals (animal_id, lot_id, cort_id, data_entrada)
       SELECT animal_id, lot_id, $6::integer, CURRENT_DATE
       FROM animals_amb_lot
       RETURNING animal_id, lot_id
     )
     SELECT animal_id, lot_id FROM noves_distribucions`,
    [dibs, datesNaixement, sexes, lotsFinals, assignacio.racaId, assignacio.cortId]
  )

  return { nombreCreats: rows.length }
}
