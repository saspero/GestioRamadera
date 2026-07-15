import { queryPublic, queryTenant, type TenantContext } from '../client'
import { hashPassword } from '@/lib/auth/password'
import type { UsuariTenant, RacaCataleg, ConfiguracioGeneral } from '@/types/configuracio'
import type { Rol } from '@/types/db'

/**
 * Retorna tots els usuaris del tenant.
 *
 * @param tenantId - Id del tenant (la taula users viu a l'schema
 * `public`, compartida entre tenants — l'aïllament es fa per filtre
 * explícit de tenant_id, no per search_path)
 * @returns Array d'usuaris, mai amb el password_hash
 *
 * @remarks Control d'accés: Admin únicament (docs/04_seguretat_i_rols.md).
 * @remarks Multitenancy: NO usa queryTenant/search_path — `public.users`
 * és una taula compartida, aïllada per filtre `WHERE tenant_id = $1`
 * a cada query.
 */
export async function getUsuaris(tenantId: number): Promise<UsuariTenant[]> {
  return queryPublic<UsuariTenant>(
    `SELECT id, nom, email, rol, actiu,
            darrer_acces AS "darrerAcces",
            creat_el     AS "creatEl"
     FROM public.users
     WHERE tenant_id = $1
     ORDER BY nom`,
    [tenantId]
  )
}

/**
 * Crea un usuari nou per al tenant.
 *
 * @param tenantId - Id del tenant
 * @param params - Nom, email, contrasenya en clar (es xifra aquí) i rol
 * @returns L'id de l'usuari creat
 *
 * @remarks La contrasenya es xifra amb hashPassword()
 * (src/lib/auth/password.ts, bcrypt cost >=12) abans de desar-la —
 * mai s'emmagatzema en clar.
 * @remarks email és UNIQUE a tota la taula (no només dins del
 * tenant) — un email duplicat llençarà un error de constraint que
 * l'endpoint ha de traduir a un missatge clar.
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: aïllat per tenant_id explícit (veure getUsuaris).
 */
export async function crearUsuari(
  tenantId: number,
  params: { nom: string; email: string; password: string; rol: Rol }
): Promise<{ id: number }> {
  const passwordHash = await hashPassword(params.password)
  const rows = await queryPublic<{ id: number }>(
    `INSERT INTO public.users (tenant_id, nom, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [tenantId, params.nom, params.email, passwordHash, params.rol]
  )
  return rows[0]
}

/**
 * Actualitza el nom, rol i estat actiu d'un usuari existent.
 *
 * @remarks NO permet canviar l'email ni la contrasenya (vegeu
 * canviarContrasenyaUsuari per a la contrasenya).
 * @remarks Control d'accés: Admin únicament. La comprovació de "no
 * pots desactivar-te ni degradar-te a tu mateix" es fa a l'endpoint,
 * no aquí — aquesta funció confia en el que li arriba ja validat.
 * @remarks Multitenancy: `AND tenant_id = $4` evita que un Admin
 * d'un tenant pugui editar usuaris d'un altre tenant encara que
 * n'endevinés l'id.
 */
export async function actualitzarUsuari(
  tenantId: number,
  id: number,
  params: { nom: string; rol: Rol; actiu: boolean }
): Promise<void> {
  await queryPublic(
    `UPDATE public.users
     SET nom = $1, rol = $2, actiu = $3
     WHERE id = $4 AND tenant_id = $5`,
    [params.nom, params.rol, params.actiu, id, tenantId]
  )
}

/**
 * Canvia la contrasenya d'un usuari.
 *
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: `AND tenant_id = $3`, mateix motiu que actualitzarUsuari.
 */
export async function canviarContrasenyaUsuari(
  tenantId: number,
  id: number,
  novaPassword: string
): Promise<void> {
  const passwordHash = await hashPassword(novaPassword)
  await queryPublic(
    `UPDATE public.users SET password_hash = $1 WHERE id = $2 AND tenant_id = $3`,
    [passwordHash, id, tenantId]
  )
}

/**
 * Crea una raça personalitzada per al tenant (es_global sempre FALSE
 * — les races globals ja venen precarregades i no es creen des d'aquí).
 *
 * @remarks Control d'accés: Admin únicament.
 * @remarks `nom_raca` té una constraint UNIQUE — un nom duplicat
 * (incloent-hi les races globals) llençarà un error que l'endpoint
 * ha de traduir a un missatge clar.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function crearRacaCustom(
  ctx: TenantContext,
  nomRaca: string
): Promise<{ id: number }> {
  const rows = await queryTenant<{ id: number }>(
    ctx,
    `INSERT INTO races_cataleg (nom_raca, es_global) VALUES ($1, FALSE) RETURNING id`,
    [nomRaca]
  )
  return rows[0]
}

/**
 * Elimina una raça personalitzada del tenant.
 *
 * @remarks La condició `AND es_global = FALSE` és la defensa real
 * contra l'eliminació accidental d'una raça global — encara que la
 * UI ja n'amaga el botó d'eliminar, aquesta consulta no eliminaria
 * res si per algun motiu s'hi arribés amb l'id d'una raça global.
 * @remarks animals.raca_id és `ON DELETE SET NULL` — els animals que
 * tinguessin aquesta raça assignada simplement en queden sense,
 * no s'eliminen ni bloquegen l'operació.
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function eliminarRacaCustom(ctx: TenantContext, id: number): Promise<void> {
  await queryTenant(ctx, `DELETE FROM races_cataleg WHERE id = $1 AND es_global = FALSE`, [id])
}

/**
 * Retorna els valors actuals de configuració general del tenant
 * (llindars d'estoc per defecte).
 *
 * @remarks configuracio_general sempre té exactament una fila
 * (id=1, CHECK constraint — docs/02_model_de_dades.md).
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getConfiguracioGeneral(ctx: TenantContext): Promise<ConfiguracioGeneral> {
  const rows = await queryTenant<{ estocMinimDefaultKg: string; estocMinimDefaultTones: string }>(
    ctx,
    `SELECT estoc_minim_default_kg    AS "estocMinimDefaultKg",
            estoc_minim_default_tones AS "estocMinimDefaultTones"
     FROM configuracio_general
     WHERE id = 1`
  )
  return {
    estocMinimDefaultKg: Number(rows[0].estocMinimDefaultKg),
    estocMinimDefaultTones: Number(rows[0].estocMinimDefaultTones),
  }
}

/**
 * Actualitza els llindars d'estoc per defecte del tenant.
 *
 * @remarks Aquests valors s'apliquen com a fallback a qualsevol
 * sitja/magatzem que no tingui un llindar específic propi
 * (docs/09_modul_logistica_farratges.md, secció 3.1).
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function actualitzarConfiguracioGeneral(
  ctx: TenantContext,
  params: { estocMinimDefaultKg: number; estocMinimDefaultTones: number }
): Promise<void> {
  await queryTenant(
    ctx,
    `UPDATE configuracio_general
     SET estoc_minim_default_kg = $1, estoc_minim_default_tones = $2
     WHERE id = 1`,
    [params.estocMinimDefaultKg, params.estocMinimDefaultTones]
  )
}

/**
 * Retorna el catàleg complet de races (globals + pròpies del tenant).
 *
 * @remarks Duplicada intencionadament de getRacesCataleg
 * (src/lib/db/queries/animals.ts) amb el tipus `esGlobal` explícit
 * al resultat — la versió d'animals.ts ja el retornava igual, però
 * es defineix aquí també per mantenir aquest fitxer autocontingut i
 * no crear una dependència creuada entre mòduls per a un SELECT tan
 * senzill.
 * @remarks Control d'accés: Admin únicament (aquesta pantalla de
 * gestió). La lectura per a desplegables d'altres mòduls (Animals)
 * segueix passant per getRacesCataleg, oberta als 3 rols.
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getRacesConfigurables(ctx: TenantContext): Promise<RacaCataleg[]> {
  return queryTenant<RacaCataleg>(
    ctx,
    `SELECT id, nom_raca AS "nomRaca", es_global AS "esGlobal"
     FROM races_cataleg
     ORDER BY es_global DESC, nom_raca`
  )
}
