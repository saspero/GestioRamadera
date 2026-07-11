import { queryTenant, type TenantContext } from '../client'
import type { RegistrarBaixaInput } from '@/lib/validators/baixes'

/**
 * Comprova si un animal té un bloqueig comercial actiu per període
 * de supressió (docs/07_modul_arxiu_historic.md, secció 3.3).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param animalId - Id de l'animal a comprovar
 * @returns Dades del bloqueig si n'hi ha un actiu, o null si no
 *
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function comprovarBloquejComercial(
  ctx: TenantContext,
  animalId: number
): Promise<{ dib: string; dataAlliberament: string; nomMedicament: string } | null> {
  const rows = await queryTenant<{
    dib: string
    dataAlliberament: string
    nomMedicament: string
  }>(
    ctx,
    `SELECT dib, data_alliberament AS "dataAlliberament", nom_medicament AS "nomMedicament"
     FROM v_animals_en_supressio
     WHERE animal_id = $1`,
    [animalId]
  )
  return rows[0] ?? null
}

/**
 * Registra la baixa d'un animal (venda o mort), seguint exactament
 * el flux documentat a docs/07_modul_arxiu_historic.md, seccions
 * 3.4 (venda) i 4.3 (mort).
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param animalId - Id de l'animal a donar de baixa
 * @param params - Camps de venda o mort, ja validats amb Zod
 * @returns Promise que es resol un cop registrada la baixa
 *
 * @remarks Control d'accés: Admin i Veterinari (ampliació sobre el
 * disseny original, que reservava el registre de baixes exclusivament
 * a Admin — veure docs/08_modul_llistat_actius.md, secció sobre la
 * fitxa d'animal). Comprovat a l'endpoint.
 * @remarks Multitenancy: aïllat via queryTenant/search_path. Els tres
 * passos (INSERT baixes, UPDATE animals, UPDATE distribucio_animals)
 * s'executen en una única crida a queryTenant — una sola transacció
 * BEGIN/COMMIT — evitant estats intermedis si qualsevol pas fallés.
 * @remarks Per a mort, estat_salut es posa a 'Crític' igual que
 * especifica el document original (secció 4.3, pas 2).
 */
export async function registrarBaixa(
  ctx: TenantContext,
  animalId: number,
  params: RegistrarBaixaInput
): Promise<void> {
  if (params.motiu === 'Venda') {
    await queryTenant(
      ctx,
      `WITH nova_baixa AS (
         INSERT INTO baixes (
           animal_id, motiu, data_baixa, pes_viu_kg, pes_canal_kg,
           preu_kg, cost_transport, comprador_escorxador, registrat_per
         )
         VALUES ($1, 'Venda', $2, $3, $4, $5, $6, $7, $8)
       ),
       actualitza_animal AS (
         UPDATE animals SET estat_actiu = FALSE WHERE id = $1
       )
       UPDATE distribucio_animals
       SET data_sortida = $2
       WHERE animal_id = $1 AND data_sortida IS NULL`,
      [
        animalId,
        params.dataBaixa,
        params.pesViuKg,
        params.pesCanalKg ?? null,
        params.preuKg,
        params.costTransport ?? null,
        params.compradorEscorxador || null,
        ctx.userId,
      ]
    )
  } else {
    await queryTenant(
      ctx,
      `WITH nova_baixa AS (
         INSERT INTO baixes (
           animal_id, motiu, data_baixa, causa_mort,
           codi_recollida_cadavers, registrat_per
         )
         VALUES ($1, 'Mort', $2, $3, $4, $5)
       ),
       actualitza_animal AS (
         UPDATE animals SET estat_actiu = FALSE, estat_salut = 'Crític' WHERE id = $1
       )
       UPDATE distribucio_animals
       SET data_sortida = $2
       WHERE animal_id = $1 AND data_sortida IS NULL`,
      [animalId, params.dataBaixa, params.causaMort, params.codiRecollidaCadavers, ctx.userId]
    )
  }
}
