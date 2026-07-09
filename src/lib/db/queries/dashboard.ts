import { queryTenant, type TenantContext } from '../client'
import type {
  TotalAnimalsBlock,
  LotActiuBlock,
  EstocMagatzemBlock,
  AnimalEnSupressioBlock,
  BaixaRecentBlock,
  DistribucioSalutBlock,
} from '@/types/dashboard'

/**
 * Compta el total d'animals actius a l'explotació.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Bloc amb el recompte total
 *
 * @remarks Control d'accés: visible per als 3 rols (Admin, Veterinari,
 * Treballador) — cap dada sensible, només un recompte.
 * @remarks Multitenancy: la query s'executa amb SET LOCAL search_path
 * al schema del tenant (queryTenant), aïllant-la automàticament de
 * la resta de tenants.
 */
export async function getTotalAnimals(ctx: TenantContext): Promise<TotalAnimalsBlock> {
  const rows = await queryTenant<{ total: string }>(
    ctx,
    `SELECT COUNT(*) AS total FROM animals WHERE estat_actiu = TRUE`
  )
  return { total: Number(rows[0]?.total ?? 0) }
}

/**
 * Retorna els lots actius amb el nombre d'animals, els dies transcorreguts
 * des de la creació del lot, i el consum mitjà de pinso repartit
 * proporcionalment entre els lots d'una mateixa zona.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de lots actius amb les seves mètriques
 *
 * @remarks Càlcul del consum mitjà: com que consums_pinso_nau registra
 * kg per ZONA (no per lot), es reparteix proporcionalment segons el
 * nombre d'animals de cada lot dins de la zona:
 *   consum_lot = (kg totals consumits per la zona des que existeix
 *                 registre / dies des de data_creacio del lot)
 *                × (animals del lot a la zona / animals totals actius
 *                   a la zona)
 * La mitjana es calcula sobre tot l'històric de consums de la zona,
 * dividit pels dies transcorreguts des de la creació del lot (no
 * una finestra fixa de dies).
 * Si un lot no té cap consum registrat a la seva zona, consumMitjaKgDia
 * és null (no 0, per distingir "sense dades" de "consum zero real").
 *
 * @remarks Control d'accés: visible per als 3 rols — informació
 * operativa sense dades econòmiques ni sanitàries.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getLotsActius(ctx: TenantContext): Promise<LotActiuBlock[]> {
  const rows = await queryTenant<{
    lotId: number
    nomLot: string
    nombreAnimals: string
    diesDesDeCreacio: string
    consumMitjaKgDia: string | null
  }>(
    ctx,
    `
    WITH animals_per_lot_zona AS (
      -- Animals actius, amb el seu lot i la zona física on són (via cort)
      SELECT
        l.id            AS lot_id,
        l.nom_lot,
        l.data_creacio,
        c.zona_id,
        da.animal_id
      FROM lots l
      JOIN distribucio_animals da ON da.lot_id = l.id AND da.data_sortida IS NULL
      JOIN animals a              ON a.id = da.animal_id AND a.estat_actiu = TRUE
      LEFT JOIN corts c           ON c.id = da.cort_id
    ),
    animals_per_zona AS (
      -- Total d'animals actius per zona (denominador del repartiment)
      SELECT zona_id, COUNT(*) AS total_animals_zona
      FROM animals_per_lot_zona
      WHERE zona_id IS NOT NULL
      GROUP BY zona_id
    ),
    consum_per_zona AS (
      -- Kg totals consumits per zona, tot l'històric registrat
      SELECT
        mf.zona_id,
        SUM(mf.kg_consumits) AS kg_totals
      FROM consums_pinso_nau mf
      GROUP BY mf.zona_id
    )
    SELECT
      apl.lot_id                                            AS "lotId",
      apl.nom_lot                                            AS "nomLot",
      COUNT(apl.animal_id)                                   AS "nombreAnimals",
      GREATEST(CURRENT_DATE - apl.data_creacio, 1)           AS "diesDesDeCreacio",
      CASE
        WHEN apz.total_animals_zona IS NULL OR cpz.kg_totals IS NULL THEN NULL
        ELSE ROUND(
          (cpz.kg_totals / GREATEST(CURRENT_DATE - apl.data_creacio, 1))
          * (COUNT(apl.animal_id)::numeric / apz.total_animals_zona),
          2
        )
      END                                                     AS "consumMitjaKgDia"
    FROM animals_per_lot_zona apl
    LEFT JOIN animals_per_zona apz ON apz.zona_id = apl.zona_id
    LEFT JOIN consum_per_zona cpz  ON cpz.zona_id = apl.zona_id
    GROUP BY apl.lot_id, apl.nom_lot, apl.data_creacio, apz.total_animals_zona, cpz.kg_totals
    ORDER BY apl.nom_lot
    `
  )

  return rows.map((r) => ({
    lotId: r.lotId,
    nomLot: r.nomLot,
    nombreAnimals: Number(r.nombreAnimals),
    diesDesDeCreacio: Number(r.diesDesDeCreacio),
    consumMitjaKgDia: r.consumMitjaKgDia !== null ? Number(r.consumMitjaKgDia) : null,
  }))
}

/**
 * Retorna l'estoc actual de totes les sitges i magatzems de farratge.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array amb l'estoc i l'estat d'alerta de cada magatzem/sitja
 *
 * @remarks Reutilitza la vista v_estoc_magatzems (definida a
 * database/02_schema_tenant_template.sql), que ja aplica el llindar
 * d'alerta específic o el global de configuracio_general.
 * @remarks Control d'accés: Admin i Treballador (Veterinari no hi
 * té accés — dades operatives de logística, no clíniques).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getEstocMagatzems(ctx: TenantContext): Promise<EstocMagatzemBlock[]> {
  const rows = await queryTenant<{
    tipus: 'sitja' | 'magatzem'
    id: number
    nom: string
    estocActual: string
    unitat: 'kg' | 'tones'
    estatAlerta: 'NORMAL' | 'BAIX' | 'ESGOTAT'
  }>(
    ctx,
    `SELECT tipus, id, nom,
            estoc_actual AS "estocActual",
            unitat,
            estat_alerta AS "estatAlerta"
     FROM v_estoc_magatzems
     ORDER BY estat_alerta = 'ESGOTAT' DESC, estat_alerta = 'BAIX' DESC, nom`
  )
  return rows.map((r) => ({ ...r, estocActual: Number(r.estocActual) }))
}

/**
 * Retorna únicament els magatzems/sitges en estat BAIX o ESGOTAT.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Subconjunt crític d'getEstocMagatzems()
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getAlertesEstoc(ctx: TenantContext): Promise<EstocMagatzemBlock[]> {
  const tots = await getEstocMagatzems(ctx)
  return tots.filter((m) => m.estatAlerta !== 'NORMAL')
}

/**
 * Retorna els animals amb bloqueig comercial actiu per període de supressió.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array d'animals en supressió, ordenats per data d'alliberament
 *
 * @remarks Reutilitza la vista v_animals_en_supressio (definida a
 * database/02_schema_tenant_template.sql).
 * @remarks Control d'accés: Admin i Veterinari (dada clínica/sanitària,
 * Treballador no hi té accés).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getAnimalsEnSupressio(
  ctx: TenantContext
): Promise<AnimalEnSupressioBlock[]> {
  const rows = await queryTenant<{
    animalId: number
    crotalId: string
    nomMedicament: string
    dataAlliberament: string
    diesRestants: string
  }>(
    ctx,
    `SELECT animal_id AS "animalId", crotal_id AS "crotalId",
            nom_medicament AS "nomMedicament",
            data_alliberament AS "dataAlliberament",
            dies_restants_supressio AS "diesRestants"
     FROM v_animals_en_supressio
     LIMIT 20`
  )
  return rows.map((r) => ({ ...r, diesRestants: Number(r.diesRestants) }))
}

/**
 * Retorna les baixes (vendes o morts) més recents.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param limit - Nombre màxim de baixes a retornar (per defecte 10)
 * @returns Array de baixes recents, ordenades per data descendent
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getUltimesBaixes(
  ctx: TenantContext,
  limit = 10
): Promise<BaixaRecentBlock[]> {
  const rows = await queryTenant<{
    animalId: number
    crotalId: string
    motiu: 'Venda' | 'Mort'
    dataBaixa: string
  }>(
    ctx,
    `SELECT b.animal_id AS "animalId", a.crotal_id AS "crotalId",
            b.motiu, b.data_baixa AS "dataBaixa"
     FROM baixes b
     JOIN animals a ON a.id = b.animal_id
     ORDER BY b.data_baixa DESC, b.id DESC
     LIMIT $1`,
    [limit]
  )
  return rows
}

/**
 * Retorna el recompte d'animals actius agrupats per estat de salut.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array amb el recompte per a cada estat de salut
 *
 * @remarks Control d'accés: Admin i Veterinari (dada d'ordre clínic).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getDistribucioSalut(
  ctx: TenantContext
): Promise<DistribucioSalutBlock[]> {
  const rows = await queryTenant<{
    estatSalut: 'Sa' | 'En tractament' | 'Observació' | 'Crític'
    total: string
  }>(
    ctx,
    `SELECT estat_salut AS "estatSalut", COUNT(*) AS total
     FROM animals
     WHERE estat_actiu = TRUE
     GROUP BY estat_salut
     ORDER BY estat_salut`
  )
  return rows.map((r) => ({ ...r, total: Number(r.total) }))
}
