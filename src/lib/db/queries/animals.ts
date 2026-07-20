import { queryTenant, type TenantContext } from '../client'
import type { AnimalActiu } from '@/types/db'
import type { FiltresAnimals, FitxaAnimal } from '@/types/animals-extra'

/**
 * Retorna tots els animals actius amb lot, cort, zona, ubicació i
 * edat calculada, incloent els seus ids (per al filtratge en
 * cascada) i si tenen bloqueig comercial actiu per supressió.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array d'animals actius, ordenats pel DIB
 *
 * @remarks Ja NO es basa en la vista v_animals_actius (que només
 * exposava els NOMS de lot/cort/zona), sinó en un JOIN directe que
 * exposa també els ids — necessaris per als desplegables de filtre
 * Granja/Zona/Lot (docs/08_modul_llistat_actius.md).
 * @remarks Control d'accés: visible per als 3 rols (Admin, Veterinari,
 * Treballador).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getAnimalsActius(ctx: TenantContext): Promise<AnimalActiu[]> {
  return queryTenant<AnimalActiu>(
    ctx,
    `SELECT
       a.id,
       a.dib,
       r.nom_raca       AS "nomRaca",
       a.data_naixement AS "dataNaixement",
       a.estat_salut    AS "estatSalut",
       a.sexe,
       l.nom_lot        AS "nomLot",
       l.id             AS "lotId",
       c.codi_cort      AS "codiCort",
       c.id             AS "cortId",
       z.nom            AS "nomZona",
       z.id             AS "zonaId",
       u.nom            AS "nomUbicacio",
       u.id             AS "ubicacioId",
       da.data_entrada  AS "dataEntrada",
       (CURRENT_DATE - a.data_naixement) AS "edatDies",
       (s.animal_id IS NOT NULL) AS "enSupressio"
     FROM animals a
     LEFT JOIN distribucio_animals da ON da.animal_id = a.id AND da.data_sortida IS NULL
     LEFT JOIN lots l                 ON l.id = da.lot_id
     LEFT JOIN corts c                ON c.id = da.cort_id
     LEFT JOIN zones_infraestructura z ON z.id = c.zona_id
     LEFT JOIN ubicacions u           ON u.id = z.ubicacio_id
     LEFT JOIN races_cataleg r        ON r.id = a.raca_id
     LEFT JOIN v_animals_en_supressio s ON s.animal_id = a.id
     WHERE a.estat_actiu = TRUE
     ORDER BY a.dib`
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
 * cerques ILIKE eficients.
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
       a.id,
       a.dib,
       r.nom_raca       AS "nomRaca",
       a.data_naixement AS "dataNaixement",
       a.estat_salut    AS "estatSalut",
       a.sexe,
       l.nom_lot        AS "nomLot",
       l.id             AS "lotId",
       c.codi_cort      AS "codiCort",
       c.id             AS "cortId",
       z.nom            AS "nomZona",
       z.id             AS "zonaId",
       u.nom            AS "nomUbicacio",
       u.id             AS "ubicacioId",
       da.data_entrada  AS "dataEntrada",
       (CURRENT_DATE - a.data_naixement) AS "edatDies",
       (s.animal_id IS NOT NULL) AS "enSupressio"
     FROM animals a
     LEFT JOIN distribucio_animals da ON da.animal_id = a.id AND da.data_sortida IS NULL
     LEFT JOIN lots l                 ON l.id = da.lot_id
     LEFT JOIN corts c                ON c.id = da.cort_id
     LEFT JOIN zones_infraestructura z ON z.id = c.zona_id
     LEFT JOIN ubicacions u           ON u.id = z.ubicacio_id
     LEFT JOIN races_cataleg r        ON r.id = a.raca_id
     LEFT JOIN v_animals_en_supressio s ON s.animal_id = a.id
     WHERE a.estat_actiu = TRUE AND a.dib ILIKE $1
     ORDER BY a.dib
     LIMIT 50`,
    [`%${terme}%`]
  )
}

/**
 * Retorna els catàlegs necessaris per als desplegables de filtre en
 * cascada (Granja → Zona → Lot) de la pantalla d'Animals.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Ubicacions, zones (amb el seu ubicacioId) i lots
 *
 * @remarks Control d'accés: visible per als 3 rols (necessari per
 * mostrar els filtres, encara que el resultat sigui el mateix per
 * a tots).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getFiltresAnimals(ctx: TenantContext): Promise<FiltresAnimals> {
  const [ubicacions, zones, lots] = await Promise.all([
    queryTenant<{ id: number; nom: string }>(
      ctx,
      `SELECT id, nom FROM ubicacions ORDER BY nom`
    ),
    queryTenant<{ id: number; nom: string; ubicacioId: number }>(
      ctx,
      `SELECT id, nom, ubicacio_id AS "ubicacioId"
       FROM zones_infraestructura
       WHERE tipus_zona = 'NAU_ANIMALS'
       ORDER BY nom`
    ),
    queryTenant<{ id: number; nom: string }>(
      ctx,
      `SELECT id, nom_lot AS nom FROM lots ORDER BY nom_lot`
    ),
  ])
  return { ubicacions, zones, lots }
}

/**
 * Retorna la fitxa completa d'un animal: dades bàsiques, ubicació
 * actual, historial de pesos i historial de tractaments.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param animalId - Id de l'animal
 * @returns Fitxa completa, o null si l'animal no existeix
 *
 * @remarks Control d'accés: visible per als 3 rols (consulta de
 * només lectura; el botó de baixa es controla a l'endpoint de baixa,
 * no aquí).
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Quatre
 * consultes independents (dades bàsiques, ubicació, pesos,
 * tractaments) en comptes d'un únic JOIN gegant, per simplicitat —
 * el volum de files per animal és sempre baix.
 * @remarks FIX (juliol 2026): la consulta de historialTractaments
 * afegeix el JOIN a medicaments_cataleg per obtenir nom_medicament
 * — des de la migració 10_migracio_cataleg_medicaments.sql, aquesta
 * columna ja no viu a `medicaments` (error 42703 "column
 * m.nom_medicament does not exist" abans d'aquest fix).
 */
export async function getFitxaAnimal(
  ctx: TenantContext,
  animalId: number
): Promise<FitxaAnimal | null> {
  const basiques = await queryTenant<{
    id: number
    dib: string
    nomRaca: string | null
    dataNaixement: string | null
    sexe: 'Mascle' | 'Femella' | null
    estatSalut: 'Sa' | 'En tractament' | 'Observació' | 'Crític'
    estatActiu: boolean
    nomUbicacio: string | null
    nomZona: string | null
    codiCort: string | null
    nomLot: string | null
    dataEntradaLot: string | null
    edatDies: number | null
  }>(
    ctx,
    `SELECT
       a.id,
       a.dib,
       r.nom_raca       AS "nomRaca",
       a.data_naixement AS "dataNaixement",
       a.sexe,
       a.estat_salut    AS "estatSalut",
       a.estat_actiu    AS "estatActiu",
       u.nom            AS "nomUbicacio",
       z.nom            AS "nomZona",
       c.codi_cort      AS "codiCort",
       l.nom_lot        AS "nomLot",
       da.data_entrada  AS "dataEntradaLot",
       (CURRENT_DATE - a.data_naixement) AS "edatDies"
     FROM animals a
     LEFT JOIN distribucio_animals da ON da.animal_id = a.id AND da.data_sortida IS NULL
     LEFT JOIN lots l                 ON l.id = da.lot_id
     LEFT JOIN corts c                ON c.id = da.cort_id
     LEFT JOIN zones_infraestructura z ON z.id = c.zona_id
     LEFT JOIN ubicacions u           ON u.id = z.ubicacio_id
     LEFT JOIN races_cataleg r        ON r.id = a.raca_id
     WHERE a.id = $1`,
    [animalId]
  )

  if (basiques.length === 0) return null

  const [historialPes, historialTractaments] = await Promise.all([
    queryTenant<{ data: string; pesKg: string }>(
      ctx,
      `SELECT data, pes_kg AS "pesKg"
       FROM registre_pes
       WHERE animal_id = $1
       ORDER BY data DESC`,
      [animalId]
    ),
    queryTenant<{
      id: number
      nomMedicament: string
      dataInici: string
      dataAlliberament: string | null
      dosiAplicada: string | null
      unitatDosi: string | null
      notes: string | null
    }>(
      ctx,
      `SELECT
         t.id,
         mc.nom_medicament  AS "nomMedicament",
         t.data_inici       AS "dataInici",
         t.data_alliberament AS "dataAlliberament",
         t.dosi_aplicada    AS "dosiAplicada",
         t.unitat_dosi      AS "unitatDosi",
         t.notes
       FROM tractaments t
       JOIN medicaments m          ON m.id = t.medicament_id
       JOIN medicaments_cataleg mc ON mc.id = m.medicament_cataleg_id
       WHERE t.animal_id = $1
       ORDER BY t.data_inici DESC`,
      [animalId]
    ),
  ])

  return {
    ...basiques[0],
    historialPes: historialPes.map((p) => ({ ...p, pesKg: Number(p.pesKg) })),
    historialTractaments: historialTractaments.map((t) => ({
      ...t,
      dosiAplicada: t.dosiAplicada !== null ? Number(t.dosiAplicada) : null,
    })),
  }
}

/**
 * Registra el pes diari d'un animal.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Animal, data i pes en kg
 * @returns Promise que es resol un cop desat el registre
 *
 * @remarks Control d'accés: Admin i Treballador.
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
 * @remarks Control d'accés: Admin i Veterinari. Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
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
 * @param nomsLot - Noms de lot únics a resoldre
 * @returns Mapa nom de lot → id
 *
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
 * @param assignacio - Raça, lot per defecte i cort de destí
 * @returns Nombre d'animals creats
 *
 * @remarks Control d'accés: Admin únicament. Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Una
 * única transacció: si qualsevol INSERT falla, tot es desfà.
 * L'aparellament animal↔lot es fa per dib (únic dins la transacció).
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

  const dibs = animals.map((a) => a.dib)
  const datesNaixement = animals.map((a) => a.dataNaixement ?? null)
  const sexes = animals.map((a) => a.sexe ?? null)
  const lotsFinals = animals.map((a) => a.lotId ?? lotPerDefecte)

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
