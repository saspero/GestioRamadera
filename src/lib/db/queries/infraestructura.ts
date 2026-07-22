import { queryTenant, type TenantContext } from '../client'
import type {
  Ubicacio,
  ZonaInfraestructura,
  Cort,
  UbicacioAmbJerarquia,
  TipusZona,
} from '@/types/infraestructura'

/**
 * Retorna totes les ubicacions (granges) amb les seves zones i corts
 * agrupats jeràrquicament, per a la vista d'arbre Granja → Zona →
 * Cort, cadascuna amb el nombre d'animals actius que hi ha
 * actualment.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array d'ubicacions amb zones i corts niats, cadascun amb comptador
 *
 * @remarks Comptadors afegits juliol 2026 (decisió confirmada amb
 * l'usuari): es calculen de baix a dalt — el de cada cort ve d'una
 * única query agregada (`GROUP BY cort_id`); el de cada zona és la
 * suma dels seus corts; el de cada ubicació és la suma de les seves
 * zones. No es fa cap query addicional per nivell, tot en memòria a
 * partir de la mateixa consulta de comptatge per cort.
 * @remarks Control d'accés: lectura per a Admin i Veterinari
 * (docs/13_modul_granja_corts.md).
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Quatre
 * queries independents (ubicacions, zones, corts, comptador
 * d'animals per cort) combinades en memòria en comptes d'un JOIN
 * gegant, per simplicitat i perquè el volum de files esperat és
 * baix (desenes, no milers).
 */
export async function getJerarquiaCompleta(
  ctx: TenantContext
): Promise<UbicacioAmbJerarquia[]> {
  const [ubicacions, zones, corts, comptadorsPerCort] = await Promise.all([
    queryTenant<Ubicacio>(
      ctx,
      `SELECT id, nom, codi_pastura_extensiu AS "codiPasturaExtensiu"
       FROM ubicacions ORDER BY nom`
    ),
    queryTenant<ZonaInfraestructura>(
      ctx,
      `SELECT id, ubicacio_id AS "ubicacioId", nom, tipus_zona AS "tipusZona"
       FROM zones_infraestructura ORDER BY nom`
    ),
    queryTenant<Cort>(
      ctx,
      `SELECT id, zona_id AS "zonaId", codi_cort AS "codiCort",
              capacitat_maxima AS "capacitatMaxima"
       FROM corts ORDER BY codi_cort`
    ),
    queryTenant<{ cortId: number; count: string }>(
      ctx,
      `SELECT cort_id AS "cortId", COUNT(*) AS count
       FROM distribucio_animals
       WHERE data_sortida IS NULL AND cort_id IS NOT NULL
       GROUP BY cort_id`
    ),
  ])

  const comptadorPerCortId = new Map(comptadorsPerCort.map((c) => [c.cortId, Number(c.count)]))

  return ubicacions.map((ubicacio) => {
    const zonesAmbComptador = zones
      .filter((z) => z.ubicacioId === ubicacio.id)
      .map((zona) => {
        const cortsAmbComptador = corts
          .filter((c) => c.zonaId === zona.id)
          .map((cort) => ({ ...cort, nombreAnimals: comptadorPerCortId.get(cort.id) ?? 0 }))
        return {
          ...zona,
          nombreAnimals: cortsAmbComptador.reduce((suma, c) => suma + c.nombreAnimals, 0),
          corts: cortsAmbComptador,
        }
      })

    return {
      ...ubicacio,
      nombreAnimals: zonesAmbComptador.reduce((suma, z) => suma + z.nombreAnimals, 0),
      zones: zonesAmbComptador,
    }
  })
}

/**
 * Crea una nova ubicació (granja/finca).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Nom i codi de pastura extensiu opcional
 * @returns L'id de la ubicació creada
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function crearUbicacio(
  ctx: TenantContext,
  params: { nom: string; codiPasturaExtensiu?: string }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO ubicacions (nom, codi_pastura_extensiu)
     VALUES ($1, $2)
     RETURNING id`,
    [params.nom, params.codiPasturaExtensiu ?? null]
  )
  return rows[0]
}

/**
 * Actualitza el nom o codi de pastura d'una ubicació existent.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param id - Id de la ubicació a actualitzar
 * @param params - Camps a actualitzar
 * @returns Promise que es resol un cop desat el canvi
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function actualitzarUbicacio(
  ctx: TenantContext,
  id: number,
  params: { nom: string; codiPasturaExtensiu?: string }
): Promise<void> {
  await queryTenant(
    ctx,
    `UPDATE ubicacions SET nom = $1, codi_pastura_extensiu = $2 WHERE id = $3`,
    [params.nom, params.codiPasturaExtensiu ?? null, id]
  )
}

/**
 * Crea una nova zona dins d'una ubicació.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Ubicació, nom i tipus de la zona
 * @returns L'id de la zona creada
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function crearZona(
  ctx: TenantContext,
  params: { ubicacioId: number; nom: string; tipusZona: TipusZona }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO zones_infraestructura (ubicacio_id, nom, tipus_zona)
     VALUES ($1, $2, $3::tipus_zona_enum)
     RETURNING id`,
    [params.ubicacioId, params.nom, params.tipusZona]
  )
  return rows[0]
}

/**
 * Actualitza el nom d'una zona existent.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param id - Id de la zona a actualitzar
 * @param nom - Nou nom de la zona
 * @returns Promise que es resol un cop desat el canvi
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks No es permet canviar tipusZona un cop creada: si la zona
 * ja té corts o magatzems associats, canviar-ne el tipus trencaria
 * la relació validada pels triggers trg_corts_zona_tipus /
 * trg_magatzem_zona_tipus. Per canviar el tipus cal eliminar la zona
 * i crear-ne una de nova.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function actualitzarZona(
  ctx: TenantContext,
  id: number,
  nom: string
): Promise<void> {
  await queryTenant(ctx, `UPDATE zones_infraestructura SET nom = $1 WHERE id = $2`, [nom, id])
}

/**
 * Crea una nova cort dins d'una zona.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param params - Zona, codi i capacitat màxima opcional
 * @returns L'id de la cort creada
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks La BD rebutjarà la inserció (trigger trg_corts_zona_tipus)
 * si zonaId no correspon a una zona de tipus NAU_ANIMALS. La UI ja
 * filtra el desplegable de zones per evitar arribar a aquest cas,
 * però l'error de BD és la defensa real si s'hi arribés igualment
 * (per exemple, una crida directa a l'API sense passar pel formulari).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function crearCort(
  ctx: TenantContext,
  params: { zonaId: number; codiCort: string; capacitatMaxima?: number }
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO corts (zona_id, codi_cort, capacitat_maxima)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [params.zonaId, params.codiCort, params.capacitatMaxima ?? null]
  )
  return rows[0]
}

/**
 * Actualitza el codi o la capacitat màxima d'una cort existent.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param id - Id de la cort a actualitzar
 * @param params - Camps a actualitzar
 * @returns Promise que es resol un cop desat el canvi
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function actualitzarCort(
  ctx: TenantContext,
  id: number,
  params: { codiCort: string; capacitatMaxima?: number }
): Promise<void> {
  await queryTenant(
    ctx,
    `UPDATE corts SET codi_cort = $1, capacitat_maxima = $2 WHERE id = $3`,
    [params.codiCort, params.capacitatMaxima ?? null, id]
  )
}

/**
 * Elimina una cort, sempre que no tingui cap animal actiu assignat
 * actualment.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param id - Id de la cort a eliminar
 * @returns Promise que es resol un cop eliminada
 *
 * @throws Error amb missatge clar si encara hi ha animals a la cort,
 * o si té historial de moviments que impedeix l'eliminació.
 *
 * @remarks Decisió confirmada amb l'usuari: BLOQUEJAR si no està buida.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function eliminarCort(ctx: TenantContext, id: number): Promise<void> {
  const actius = await queryTenant<{ count: string }>(
    ctx,
    `SELECT COUNT(*) AS count FROM distribucio_animals WHERE cort_id = $1 AND data_sortida IS NULL`,
    [id]
  )
  if (Number(actius[0].count) > 0) {
    throw new Error('No es pot eliminar: encara hi ha animals assignats a aquesta cort')
  }

  try {
    await queryTenant(ctx, `DELETE FROM corts WHERE id = $1`, [id])
  } catch (err) {
    const esViolacioFk =
      err instanceof Error && (err.message.includes('foreign key') || err.message.includes('violates'))
    if (esViolacioFk) {
      throw new Error('No es pot eliminar: aquesta cort té historial de moviments d\'animals')
    }
    throw err
  }
}

/**
 * Elimina una zona, sempre que no tingui cap cort al seu interior.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param id - Id de la zona a eliminar
 * @returns Promise que es resol un cop eliminada
 *
 * @throws Error amb missatge clar si encara té corts, o si té
 * dependències que impedeixen l'eliminació (per exemple, un
 * magatzem de farratge que hi viu, o una sitja que hi té la nau
 * vinculada — aquesta última amb ON DELETE SET NULL, no bloqueja).
 *
 * @remarks Decisió confirmada amb l'usuari: BLOQUEJAR si no està buida.
 * Com que les corts ja es bloquegen si tenen animals, aquest control
 * crea una cadena natural: cal buidar les corts abans de poder
 * eliminar-les, i eliminar totes les corts abans de poder eliminar
 * la zona.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function eliminarZona(ctx: TenantContext, id: number): Promise<void> {
  const corts = await queryTenant<{ count: string }>(
    ctx,
    `SELECT COUNT(*) AS count FROM corts WHERE zona_id = $1`,
    [id]
  )
  if (Number(corts[0].count) > 0) {
    throw new Error('No es pot eliminar: aquesta zona encara té corts. Elimina-les primer.')
  }

  try {
    await queryTenant(ctx, `DELETE FROM zones_infraestructura WHERE id = $1`, [id])
  } catch (err) {
    const esViolacioFk =
      err instanceof Error && (err.message.includes('foreign key') || err.message.includes('violates'))
    if (esViolacioFk) {
      throw new Error('No es pot eliminar: aquesta zona té dependències (magatzems de farratge o historial)')
    }
    throw err
  }
}

/**
 * Elimina una ubicació (granja), sempre que no tingui cap zona al
 * seu interior.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param id - Id de la ubicació a eliminar
 * @returns Promise que es resol un cop eliminada
 *
 * @throws Error amb missatge clar si encara té zones, o si té
 * dependències que impedeixen l'eliminació (per exemple, sitges que
 * hi viuen).
 *
 * @remarks Decisió confirmada amb l'usuari: BLOQUEJAR si no està buida.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function eliminarUbicacio(ctx: TenantContext, id: number): Promise<void> {
  const zones = await queryTenant<{ count: string }>(
    ctx,
    `SELECT COUNT(*) AS count FROM zones_infraestructura WHERE ubicacio_id = $1`,
    [id]
  )
  if (Number(zones[0].count) > 0) {
    throw new Error('No es pot eliminar: aquesta granja encara té zones. Elimina-les primer.')
  }

  try {
    await queryTenant(ctx, `DELETE FROM ubicacions WHERE id = $1`, [id])
  } catch (err) {
    const esViolacioFk =
      err instanceof Error && (err.message.includes('foreign key') || err.message.includes('violates'))
    if (esViolacioFk) {
      throw new Error('No es pot eliminar: aquesta granja té dependències (sitges o historial)')
    }
    throw err
  }
}
