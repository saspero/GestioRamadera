import { queryTenant, type TenantContext } from '../client'
import type { EstocMagatzemComplet, CatalegsConsum } from '@/types/logistica'
import { calcularQuantitatEnTones } from '@/lib/logistica/logistica-calculs'

/**
 * Retorna l'estoc de tots els magatzems i sitges (actius i
 * deshabilitats), amb l'estat d'alerta ja resolt.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array de magatzems/sitges amb estoc i alerta
 *
 * @remarks NO reutilitza la vista v_estoc_magatzems (usada al
 * Dashboard) perquè aquesta filtra `WHERE estat = 'Actiu'` a totes
 * dues branques — pensada per a les alertes del Dashboard, que
 * només han de mostrar espais en ús. La pantalla de Control d'Estoc
 * (docs/09_modul_logistica_farratges.md, secció 5) necessita veure
 * TOTS els magatzems, incloent els deshabilitats, per poder-los
 * gestionar — per això aquesta query pròpia replica la mateixa
 * lògica de la vista (jerarquia de llindars, càlcul d'alerta) però
 * sense el filtre d'estat.
 * @remarks Control d'accés: Admin i Treballador (lectura), Veterinari
 * sense accés (docs/09_modul_logistica_farratges.md, secció 1).
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
    `SELECT
       'sitja' AS tipus,
       s.id,
       s.nom,
       s.tipus_pinso AS "tipusProducte",
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
 * Massius: orígens (només magatzems/sitges ACTIUS) i destins (totes
 * les zones).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Orígens i destins seleccionables
 *
 * @remarks Només es mostren magatzems en estat 'Actiu' com a origen
 * (docs/09_modul_logistica_farratges.md, secció 2.1).
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getCatalegsConsum(ctx: TenantContext): Promise<CatalegsConsum> {
  const [sitges, magatzems, zones] = await Promise.all([
    queryTenant<{ id: number; nom: string }>(
      ctx,
      `SELECT id, nom FROM sitges WHERE estat = 'Actiu' ORDER BY nom`
    ),
    queryTenant<{ id: number; nom: string; pesMitjaBalaKg: string | null }>(
      ctx,
      `SELECT id, tipus_farratge AS nom, pes_mitja_bala_kg AS "pesMitjaBalaKg"
       FROM magatzems_farratge WHERE estat = 'Actiu' ORDER BY tipus_farratge`
    ),
    queryTenant<{ id: number; nom: string; tipusZona: 'NAU_ANIMALS' | 'COBERT_EMMAGATZEMATGE' | 'PASTURA' }>(
      ctx,
      `SELECT id, nom, tipus_zona AS "tipusZona" FROM zones_infraestructura ORDER BY nom`
    ),
  ])

  return {
    origens: [
      ...sitges.map((s) => ({ tipus: 'sitja' as const, id: s.id, nom: s.nom, pesMitjaBalaKg: null })),
      ...magatzems.map((m) => ({
        tipus: 'magatzem' as const,
        id: m.id,
        nom: m.nom,
        pesMitjaBalaKg: m.pesMitjaBalaKg !== null ? Number(m.pesMitjaBalaKg) : null,
      })),
    ],
    destins: zones,
  }
}

/**
 * Registra un consum massiu, escrivint a la taula corresponent
 * segons el tipus d'origen (sitja → consums_pinso_nau, magatzem de
 * farratge → moviments_farratge), i descompta l'estoc.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Origen, destí, quantitat, unitat i data
 * @returns L'estoc resultant després del descompte
 *
 * @remarks Decisió confirmada amb l'usuari: el formulari únic de
 * "Consums Massius" (docs/09_modul_logistica_farratges.md, secció 2)
 * escriu a UNA de les dues taules segons el tipus d'origen.
 * @remarks Lògica de bales (secció 2.2): la conversió a tones es
 * delega a calcularQuantitatEnTones() (src/lib/logistica/logistica-calculs.ts),
 * extreta com a funció pura i testejada a
 * src/lib/logistica/logistica-calculs.test.ts — abans aquesta lògica
 * vivia inline en aquesta mateixa funció, sense tests possibles
 * sense connexió real a BD.
 * @remarks NO es bloqueja si l'estoc quedaria negatiu — mateix
 * criteri que al mòdul Sanitari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path. INSERT
 * del moviment + UPDATE de l'estoc en una única transacció.
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
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param tipus - 'sitja' o 'magatzem'
 * @param id - Id de l'element
 * @param estat - Nou estat
 * @returns Promise que es resol un cop desat el canvi
 *
 * @remarks Control d'accés: Admin únicament.
 * @remarks Seguretat: `taula` s'interpola directament al SQL, però
 * `tipus` prové sempre d'un valor ja validat per Zod a l'endpoint
 * (enum 'sitja'|'magatzem') — mai arriba text lliure de l'usuari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
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
