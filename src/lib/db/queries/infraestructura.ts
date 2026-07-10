import { queryTenant, type TenantContext } from '../client'
import type { Ubicacio, ZonaInfraestructura, Cort, UbicacioAmbJerarquia, TipusZona } from '@/types/infraestructura'

/**
 * Retorna totes les ubicacions (granges) amb les seves zones i corts
 * agrupats jeràrquicament, per a la vista d'arbre Granja → Zona → Cort.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @returns Array d'ubicacions amb zones i corts niats
 *
 * @remarks Control d'accés: lectura per a Admin i Veterinari
 * (docs/13_modul_granja_corts.md).
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Tres
 * queries independents (ubicacions, zones, corts) combinades en
 * memòria en comptes d'un JOIN gegant, per simplicitat i perquè el
 * volum de files esperat és baix (desenes, no milers).
 */
export async function getJerarquiaCompleta(
  ctx: TenantContext
): Promise<UbicacioAmbJerarquia[]> {
  const [ubicacions, zones, corts] = await Promise.all([
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
  ])

  return ubicacions.map((ubicacio) => ({
    ...ubicacio,
    zones: zones
      .filter((z) => z.ubicacioId === ubicacio.id)
      .map((zona) => ({
        ...zona,
        corts: corts.filter((c) => c.zonaId === zona.id),
      })),
  }))
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
