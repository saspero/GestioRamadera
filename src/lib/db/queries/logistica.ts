import { queryTenant, type TenantContext } from '../client'
import type { EstocMagatzemComplet, CatalegsConsum, TipusPinso, Sitja, MagatzemFarratge } from '@/types/logistica'
import { calcularQuantitatEnTones } from '@/lib/logistica/logistica-calculs'

/**
 * Retorna l'estoc de tots els magatzems i sitges (actius i
 * deshabilitats), amb l'estat d'alerta ja resolt.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de magatzems/sitges amb estoc i alerta
 *
 * @remarks NO reutilitza la vista v_estoc_magatzems (usada al
 * Dashboard) perquè aquesta filtra `WHERE estat = 'Actiu'`. La
 * pantalla de Control d'Estoc necessita veure TOTS els magatzems.
 * @remarks Per a sitges, `tipusProducte` és ara el nom del tipus de
 * pinso del catàleg (JOIN amb tipus_pinso_cataleg), no text lliure
 * (database/07_migracio_pinsos_magatzems.sql).
 * @remarks FIX (juliol 2026): el UNION ALL està embolicat en una
 * subconsulta (`combined`) perquè l'ORDER BY final pugui fer servir
 * expressions (`"estatAlerta" = 'ESGOTAT'`) — PostgreSQL NOMÉS
 * permet noms de columna simples a l'ORDER BY directament sobre un
 * UNION/UNION ALL, no expressions ni funcions (error 0A000: "invalid
 * UNION/INTERSECT/EXCEPT ORDER BY clause"). Un intent anterior
 * d'aquesta mateixa correcció (fa mesos) va quedar amb la mateixa
 * sintaxi invàlida sense detectar-ho fins ara.
 * @remarks Control d'accés: Admin i Treballador (lectura), Veterinari
 * sense accés.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getEstocComplet(ctx: TenantContext): Promise<EstocMagatzemComplet[]> {
  const rows = await queryTenant<{
    tipus: 'sitja' | 'magatzem'
    id: number
    nom: string
    tipusProducte: string | null
    estocActual: string
    unitat: 'kg' | 'tones'
    capacitat: string | null
    estocMinimEfectiu: string
    estat: 'Actiu' | 'Deshabilitat'
    estatAlerta: 'NORMAL' | 'BAIX' | 'ESGOTAT'
  }>(
    ctx,
    `SELECT * FROM (
       SELECT
         'sitja' AS tipus,
         s.id,
         s.nom,
         tp.nom AS "tipusProducte",
         s.estoc_actual_kg AS "estocActual",
         'kg' AS unitat,
         s.capacitat_kg AS capacitat,
         COALESCE(s.estoc_minim_kg, cg.estoc_minim_default_kg) AS "estocMinimEfectiu",
         s.estat,
         CASE
           WHEN s.estoc_actual_kg = 0 THEN 'ESGOTAT'
           WHEN s.estoc_actual_kg <= COALESCE(s.estoc_minim_kg, cg.estoc_minim_default_kg) THEN 'BAIX'
           ELSE 'NORMAL'
         END AS "estatAlerta"
       FROM sitges s
       LEFT JOIN tipus_pinso_cataleg tp ON tp.id = s.tipus_pinso_id
       CROSS JOIN configuracio_general cg

       UNION ALL

       SELECT
         'magatzem' AS tipus,
         mf.id,
         mf.tipus_farratge AS nom,
         mf.tipus_farratge AS "tipusProducte",
         mf.estoc_actual_tones AS "estocActual",
         'tones' AS unitat,
         mf.capacitat_maxima_tones AS capacitat,
         COALESCE(mf.estoc_minim_tones, cg.estoc_minim_default_tones) AS "estocMinimEfectiu",
         mf.estat,
         CASE
           WHEN mf.estoc_actual_tones = 0 THEN 'ESGOTAT'
           WHEN mf.estoc_actual_tones <= COALESCE(mf.estoc_minim_tones, cg.estoc_minim_default_tones) THEN 'BAIX'
           ELSE 'NORMAL'
         END AS "estatAlerta"
       FROM magatzems_farratge mf
       CROSS JOIN configuracio_general cg
     ) combined
     ORDER BY "estatAlerta" = 'ESGOTAT' DESC, "estatAlerta" = 'BAIX' DESC, nom`
  )
  return rows.map((r) => ({
    ...r,
    estocActual: Number(r.estocActual),
    capacitat: r.capacitat !== null ? Number(r.capacitat) : null,
    estocMinimEfectiu: Number(r.estocMinimEfectiu),
  }))
}

/**
 * Retorna els catàlegs necessaris per al formulari de Consums
 * Massius: orígens (només magatzems/sitges ACTIUS) i destins
 * (zones on hi ha animals que consumeixen).
 *
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function getCatalegsConsum(ctx: TenantContext): Promise<CatalegsConsum> {
  const [sitges, magatzems, zones] = await Promise.all([
    queryTenant<{ id: number; nom: string; zonaVinculadaId: number | null; nomZonaVinculada: string | null }>(
      ctx,
      `SELECT s.id, s.nom,
              s.zona_vinculada_id AS "zonaVinculadaId",
              z.nom AS "nomZonaVinculada"
       FROM sitges s
       LEFT JOIN zones_infraestructura z ON z.id = s.zona_vinculada_id
       WHERE s.estat = 'Actiu'
       ORDER BY s.nom`
    ),
    queryTenant<{
      id: number
      nom: string
      pesMitjaBalaKg: string | null
      zonaVinculadaId: number | null
      nomZonaVinculada: string | null
    }>(
      ctx,
      `SELECT mf.id, mf.tipus_farratge AS nom,
              mf.pes_mitja_bala_kg AS "pesMitjaBalaKg",
              mf.zona_vinculada_id AS "zonaVinculadaId",
              z.nom AS "nomZonaVinculada"
       FROM magatzems_farratge mf
       LEFT JOIN zones_infraestructura z ON z.id = mf.zona_vinculada_id
       WHERE mf.estat = 'Actiu'
       ORDER BY mf.tipus_farratge`
    ),
    queryTenant<{ id: number; nom: string; tipusZona: 'NAU_ANIMALS' | 'PASTURA' }>(
      ctx,
      `SELECT id, nom, tipus_zona AS "tipusZona"
       FROM zones_infraestructura
       WHERE tipus_zona IN ('NAU_ANIMALS', 'PASTURA')
       ORDER BY nom`
    ),
  ])

  return {
    origens: [
      ...sitges.map((s) => ({
        tipus: 'sitja' as const,
        id: s.id,
        nom: s.nom,
        pesMitjaBalaKg: null,
        zonaVinculadaId: s.zonaVinculadaId,
        nomZonaVinculada: s.nomZonaVinculada,
      })),
      ...magatzems.map((m) => ({
        tipus: 'magatzem' as const,
        id: m.id,
        nom: m.nom,
        pesMitjaBalaKg: m.pesMitjaBalaKg !== null ? Number(m.pesMitjaBalaKg) : null,
        zonaVinculadaId: m.zonaVinculadaId,
        nomZonaVinculada: m.nomZonaVinculada,
      })),
    ],
    destins: zones,
  }
}

/**
 * Registra un consum massiu, escrivint a la taula corresponent
 * segons el tipus d'origen, i descompta l'estoc.
 *
 * @remarks Sense canvis — confirmat correcte via prova directa a la
 * BD (2000 - 50 = 1950). El bug reportat no era aquí.
 */
export async function registrarConsum(
  ctx: TenantContext,
  params: {
    origenTipus: 'sitja' | 'magatzem'
    origenId: number
    zonaDestiId: number
    quantitat: number
    unitat: 'kg' | 'Tones' | 'Unitats'
    data: string
  }
): Promise<{ estocResultant: number }> {
  if (params.origenTipus === 'sitja') {
    const rows = await queryTenant<{ estoc_actual_kg: string }>(
      ctx,
      `WITH nou_consum AS (
         INSERT INTO consums_pinso_nau (zona_id, sitge_id, data, kg_consumits, registrat_per)
         VALUES ($1, $2, $3, $4, $5)
       ),
       actualitza_estoc AS (
         UPDATE sitges
         SET estoc_actual_kg = estoc_actual_kg - $4
         WHERE id = $2
         RETURNING estoc_actual_kg
       )
       SELECT estoc_actual_kg FROM actualitza_estoc`,
      [params.zonaDestiId, params.origenId, params.data, params.quantitat, ctx.userId]
    )
    return { estocResultant: Number(rows[0]?.estoc_actual_kg ?? 0) }
  }

  const magatzemRows = await queryTenant<{ pes_mitja_bala_kg: string | null }>(
    ctx,
    `SELECT pes_mitja_bala_kg FROM magatzems_farratge WHERE id = $1`,
    [params.origenId]
  )
  const pesMitjaBala = magatzemRows[0]?.pes_mitja_bala_kg
  const pesMitjaBalaNum = pesMitjaBala !== null && pesMitjaBala !== undefined ? Number(pesMitjaBala) : null

  const quantitatTonesReal = calcularQuantitatEnTones(params.quantitat, params.unitat, pesMitjaBalaNum)

  const rows = await queryTenant<{ estoc_actual_tones: string }>(
    ctx,
    `WITH nou_moviment AS (
       INSERT INTO moviments_farratge (
         magatzem_id, zona_desti_id, data, quantitat, unitat,
         quantitat_kg_real, registrat_per
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
     ),
     actualitza_estoc AS (
       UPDATE magatzems_farratge
       SET estoc_actual_tones = estoc_actual_tones - $8
       WHERE id = $1
       RETURNING estoc_actual_tones
     )
     SELECT estoc_actual_tones FROM actualitza_estoc`,
    [
      params.origenId,
      params.zonaDestiId,
      params.data,
      params.quantitat,
      params.unitat,
      quantitatTonesReal * 1000,
      ctx.userId,
      quantitatTonesReal,
    ]
  )
  return { estocResultant: Number(rows[0]?.estoc_actual_tones ?? 0) }
}

/**
 * Canvia l'estat (Actiu/Deshabilitat) d'una sitja o magatzem de farratge.
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function canviarEstatMagatzem(
  ctx: TenantContext,
  tipus: 'sitja' | 'magatzem',
  id: number,
  estat: 'Actiu' | 'Deshabilitat'
): Promise<void> {
  const taula = tipus === 'sitja' ? 'sitges' : 'magatzems_farratge'
  await queryTenant(ctx, `UPDATE ${taula} SET estat = $1 WHERE id = $2`, [estat, id])
}

/**
 * Retorna el catàleg complet de tipus de pinso, amb els seus
 * components (ingredients i percentatges).
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function getTipusPinsoCataleg(ctx: TenantContext): Promise<TipusPinso[]> {
  const [tipus, components] = await Promise.all([
    queryTenant<{ id: number; codi: string; nom: string }>(
      ctx,
      `SELECT id, codi, nom FROM tipus_pinso_cataleg ORDER BY nom`
    ),
    queryTenant<{ id: number; tipusPinsoId: number; nomComponent: string; percentatge: string }>(
      ctx,
      `SELECT id, tipus_pinso_id AS "tipusPinsoId", nom_component AS "nomComponent", percentatge
       FROM component_pinso ORDER BY nom_component`
    ),
  ])

  return tipus.map((t) => ({
    ...t,
    components: components
      .filter((c) => c.tipusPinsoId === t.id)
      .map((c) => ({ id: c.id, nomComponent: c.nomComponent, percentatge: Number(c.percentatge) })),
  }))
}

/**
 * Crea un tipus de pinso nou amb la seva composició.
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function crearTipusPinso(
  ctx: TenantContext,
  params: { codi: string; nom: string; components: { nomComponent: string; percentatge: number }[] }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `WITH nou_tipus AS (
       INSERT INTO tipus_pinso_cataleg (codi, nom)
       VALUES ($1, $2)
       RETURNING id
     ),
     nous_components AS (
       INSERT INTO component_pinso (tipus_pinso_id, nom_component, percentatge)
       SELECT nt.id, c.nom, c.percentatge
       FROM nou_tipus nt
       CROSS JOIN UNNEST($3::text[], $4::decimal[]) AS c(nom, percentatge)
     )
     SELECT id FROM nou_tipus`,
    [
      params.codi,
      params.nom,
      params.components.map((c) => c.nomComponent),
      params.components.map((c) => c.percentatge),
    ]
  )
  return rows[0]
}

/**
 * Actualitza un tipus de pinso existent, substituint completament
 * la seva llista de components.
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function actualitzarTipusPinso(
  ctx: TenantContext,
  id: number,
  params: { codi: string; nom: string; components: { nomComponent: string; percentatge: number }[] }
): Promise<void> {
  await queryTenant(
    ctx,
    `WITH actualitza_tipus AS (
       UPDATE tipus_pinso_cataleg SET codi = $2, nom = $3 WHERE id = $1
     ),
     esborra_components AS (
       DELETE FROM component_pinso WHERE tipus_pinso_id = $1
     )
     INSERT INTO component_pinso (tipus_pinso_id, nom_component, percentatge)
     SELECT $1::integer, c.nom, c.percentatge
     FROM UNNEST($4::text[], $5::decimal[]) AS c(nom, percentatge)`,
    [
      id,
      params.codi,
      params.nom,
      params.components.map((c) => c.nomComponent),
      params.components.map((c) => c.percentatge),
    ]
  )
}

/**
 * Retorna totes les sitges amb el nom de la seva ubicació i del
 * tipus de pinso que emmagatzemen.
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function getSitges(ctx: TenantContext): Promise<Sitja[]> {
  const rows = await queryTenant<{
    id: number
    nom: string
    ubicacioId: number
    nomUbicacio: string
    tipusPinsoId: number | null
    nomTipusPinso: string | null
    capacitatKg: string | null
    estocActualKg: string
    estocMinimKg: string | null
    zonaVinculadaId: number | null
    nomZonaVinculada: string | null
    estat: 'Actiu' | 'Deshabilitat'
  }>(
    ctx,
    `SELECT
       s.id, s.nom,
       s.ubicacio_id  AS "ubicacioId",
       u.nom          AS "nomUbicacio",
       s.tipus_pinso_id AS "tipusPinsoId",
       tp.nom         AS "nomTipusPinso",
       s.capacitat_kg AS "capacitatKg",
       s.estoc_actual_kg AS "estocActualKg",
       s.estoc_minim_kg  AS "estocMinimKg",
       s.zona_vinculada_id AS "zonaVinculadaId",
       zv.nom AS "nomZonaVinculada",
       s.estat
     FROM sitges s
     JOIN ubicacions u ON u.id = s.ubicacio_id
     LEFT JOIN tipus_pinso_cataleg tp ON tp.id = s.tipus_pinso_id
     LEFT JOIN zones_infraestructura zv ON zv.id = s.zona_vinculada_id
     ORDER BY s.nom`
  )
  return rows.map((r) => ({
    ...r,
    capacitatKg: r.capacitatKg !== null ? Number(r.capacitatKg) : null,
    estocActualKg: Number(r.estocActualKg),
    estocMinimKg: r.estocMinimKg !== null ? Number(r.estocMinimKg) : null,
  }))
}

/**
 * Crea una sitja nova.
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function crearSitja(
  ctx: TenantContext,
  params: {
    nom: string
    ubicacioId: number
    tipusPinsoId?: number
    capacitatKg?: number
    estocActualKg: number
    estocMinimKg?: number
    zonaVinculadaId?: number
  }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO sitges (nom, ubicacio_id, tipus_pinso_id, capacitat_kg, estoc_actual_kg, estoc_minim_kg, zona_vinculada_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      params.nom,
      params.ubicacioId,
      params.tipusPinsoId ?? null,
      params.capacitatKg ?? null,
      params.estocActualKg,
      params.estocMinimKg ?? null,
      params.zonaVinculadaId ?? null,
    ]
  )
  return rows[0]
}

/**
 * Actualitza una sitja existent (la ubicació no es pot canviar).
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function actualitzarSitja(
  ctx: TenantContext,
  id: number,
  params: {
    nom: string
    tipusPinsoId?: number
    capacitatKg?: number
    estocActualKg: number
    estocMinimKg?: number
    zonaVinculadaId?: number
  }
): Promise<void> {
  await queryTenant(
    ctx,
    `UPDATE sitges
     SET nom = $1, tipus_pinso_id = $2, capacitat_kg = $3, estoc_actual_kg = $4,
         estoc_minim_kg = $5, zona_vinculada_id = $6
     WHERE id = $7`,
    [
      params.nom,
      params.tipusPinsoId ?? null,
      params.capacitatKg ?? null,
      params.estocActualKg,
      params.estocMinimKg ?? null,
      params.zonaVinculadaId ?? null,
      id,
    ]
  )
}

/**
 * Retorna tots els magatzems de farratge amb el nom de la seva zona.
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function getMagatzems(ctx: TenantContext): Promise<MagatzemFarratge[]> {
  const rows = await queryTenant<{
    id: number
    zonaId: number
    nomZona: string
    tipusFarratge: string
    capacitatMaximaTones: string | null
    estocActualTones: string
    estocMinimTones: string | null
    pesMitjaBalaKg: string | null
    zonaVinculadaId: number | null
    nomZonaVinculada: string | null
    estat: 'Actiu' | 'Deshabilitat'
  }>(
    ctx,
    `SELECT
       mf.id,
       mf.zona_id AS "zonaId",
       z.nom      AS "nomZona",
       mf.tipus_farratge AS "tipusFarratge",
       mf.capacitat_maxima_tones AS "capacitatMaximaTones",
       mf.estoc_actual_tones     AS "estocActualTones",
       mf.estoc_minim_tones      AS "estocMinimTones",
       mf.pes_mitja_bala_kg      AS "pesMitjaBalaKg",
       mf.zona_vinculada_id      AS "zonaVinculadaId",
       zv.nom                    AS "nomZonaVinculada",
       mf.estat
     FROM magatzems_farratge mf
     JOIN zones_infraestructura z ON z.id = mf.zona_id
     LEFT JOIN zones_infraestructura zv ON zv.id = mf.zona_vinculada_id
     ORDER BY mf.tipus_farratge`
  )
  return rows.map((r) => ({
    ...r,
    capacitatMaximaTones: r.capacitatMaximaTones !== null ? Number(r.capacitatMaximaTones) : null,
    estocActualTones: Number(r.estocActualTones),
    estocMinimTones: r.estocMinimTones !== null ? Number(r.estocMinimTones) : null,
    pesMitjaBalaKg: r.pesMitjaBalaKg !== null ? Number(r.pesMitjaBalaKg) : null,
  }))
}

/**
 * Crea un magatzem de farratge nou, dins d'una zona de tipus
 * COBERT_EMMAGATZEMATGE.
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function crearMagatzem(
  ctx: TenantContext,
  params: {
    zonaId: number
    tipusFarratge: string
    capacitatMaximaTones?: number
    estocActualTones: number
    estocMinimTones?: number
    pesMitjaBalaKg?: number
    zonaVinculadaId?: number
  }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO magatzems_farratge (
       zona_id, tipus_farratge, capacitat_maxima_tones,
       estoc_actual_tones, estoc_minim_tones, pes_mitja_bala_kg, zona_vinculada_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      params.zonaId,
      params.tipusFarratge,
      params.capacitatMaximaTones ?? null,
      params.estocActualTones,
      params.estocMinimTones ?? null,
      params.pesMitjaBalaKg ?? null,
      params.zonaVinculadaId ?? null,
    ]
  )
  return rows[0]
}

/**
 * Actualitza un magatzem de farratge existent (la zona no es pot canviar).
 * @remarks Sense canvis respecte a la versió anterior.
 */
export async function actualitzarMagatzem(
  ctx: TenantContext,
  id: number,
  params: {
    tipusFarratge: string
    capacitatMaximaTones?: number
    estocActualTones: number
    estocMinimTones?: number
    pesMitjaBalaKg?: number
    zonaVinculadaId?: number
  }
): Promise<void> {
  await queryTenant(
    ctx,
    `UPDATE magatzems_farratge
     SET tipus_farratge = $1, capacitat_maxima_tones = $2, estoc_actual_tones = $3,
         estoc_minim_tones = $4, pes_mitja_bala_kg = $5, zona_vinculada_id = $6
     WHERE id = $7`,
    [
      params.tipusFarratge,
      params.capacitatMaximaTones ?? null,
      params.estocActualTones,
      params.estocMinimTones ?? null,
      params.pesMitjaBalaKg ?? null,
      params.zonaVinculadaId ?? null,
      id,
    ]
  )
}

/**
 * Registra una entrada d'estoc repartida manualment entre diversos
 * silos o magatzems del mateix tipus, i opcionalment assigna un
 * tipus de pinso comú a totes les sitges incloses en el repartiment.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Tipus (sitja/magatzem), repartiment (id + quantitat
 * per fila), i tipusPinsoId opcional (només aplicable si tipus === 'sitja')
 * @returns Nombre de magatzems/sitges actualitzats
 *
 * @remarks tipusPinsoId (nou): un únic desplegable per a tota
 * l'entrada (no un per sitja) — si s'informa, s'aplica a TOTES les
 * sitges del repartiment en la mateixa operació. Opcional: si no
 * s'informa, cada sitja manté el tipus de pinso que ja tingués
 * assignat (o cap, si no en tenia).
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Tot el
 * repartiment (i l'assignació de tipus de pinso, si escau) s'aplica
 * en una única transacció.
 */
export async function registrarEntradaEstoc(
  ctx: TenantContext,
  params: {
    tipus: 'sitja' | 'magatzem'
    repartiment: { id: number; quantitat: number }[]
    tipusPinsoId?: number
  }
): Promise<{ nombreActualitzats: number }> {
  const ids = params.repartiment.map((r) => r.id)
  const quantitats = params.repartiment.map((r) => r.quantitat)

  if (params.tipus === 'sitja') {
    const rows = await queryTenant<{ id: number }>(
      ctx,
      `WITH repartiment AS (
         SELECT * FROM UNNEST($1::integer[], $2::decimal[]) AS t(id, quantitat)
       ),
       actualitza_estoc AS (
         UPDATE sitges s
         SET estoc_actual_kg = s.estoc_actual_kg + r.quantitat
         FROM repartiment r
         WHERE s.id = r.id
         RETURNING s.id
       ),
       actualitza_pinso AS (
         UPDATE sitges
         SET tipus_pinso_id = $3::integer
         WHERE id = ANY($1::integer[]) AND $3::integer IS NOT NULL
       )
       SELECT id FROM actualitza_estoc`,
      [ids, quantitats, params.tipusPinsoId ?? null]
    )
    return { nombreActualitzats: rows.length }
  }

  const rows = await queryTenant<{ id: number }>(
    ctx,
    `WITH repartiment AS (
       SELECT * FROM UNNEST($1::integer[], $2::decimal[]) AS t(id, quantitat)
     )
     UPDATE magatzems_farratge mf
     SET estoc_actual_tones = mf.estoc_actual_tones + r.quantitat
     FROM repartiment r
     WHERE mf.id = r.id
     RETURNING mf.id`,
    [ids, quantitats]
  )
  return { nombreActualitzats: rows.length }
}
