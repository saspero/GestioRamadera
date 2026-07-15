import { queryTenant, type TenantContext } from '../client'
import type { AnimalInactiu, FitxaArxiu } from '@/types/arxiu'

/**
 * Retorna els animals donats de baixa (venda o mort), amb filtres
 * opcionals de cerca per DIB, motiu i rang de dates.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param filtres - Cerca (DIB), motiu ('Tots'/'Venda'/'Mort') i rang de dates
 * @returns Array d'animals inactius, els més recents primer
 *
 * @remarks "Lot (últim)" (docs/07_modul_arxiu_historic.md, secció 2.1)
 * és el lot de la distribució més recent de l'animal (per
 * data_entrada), independentment de si data_sortida coincideix
 * exactament amb data_baixa — més robust que buscar una coincidència
 * exacta de dates.
 * @remarks Control d'accés: Admin i Veterinari (només lectura per a
 * Veterinari — sense accions d'escriptura en aquest mòdul, ja que
 * la baixa en si es registra des del mòdul Animals, no aquí).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getAnimalsInactius(
  ctx: TenantContext,
  filtres: { cerca?: string; motiu?: string; dataDes?: string; dataFins?: string }
): Promise<AnimalInactiu[]> {
  const condicions: string[] = [`a.estat_actiu = FALSE`]
  const params: unknown[] = []

  if (filtres.cerca) {
    params.push(`%${filtres.cerca}%`)
    condicions.push(`a.dib ILIKE $${params.length}`)
  }
  if (filtres.motiu && filtres.motiu !== 'Tots') {
    params.push(filtres.motiu)
    condicions.push(`b.motiu = $${params.length}`)
  }
  if (filtres.dataDes) {
    params.push(filtres.dataDes)
    condicions.push(`b.data_baixa >= $${params.length}`)
  }
  if (filtres.dataFins) {
    params.push(filtres.dataFins)
    condicions.push(`b.data_baixa <= $${params.length}`)
  }

  return queryTenant<AnimalInactiu>(
    ctx,
    `SELECT
       a.id, a.dib,
       r.nom_raca       AS "nomRaca",
       a.data_naixement AS "dataNaixement",
       b.data_baixa     AS "dataBaixa",
       b.motiu,
       (SELECT l.nom_lot
        FROM distribucio_animals da
        LEFT JOIN lots l ON l.id = da.lot_id
        WHERE da.animal_id = a.id
        ORDER BY da.data_entrada DESC
        LIMIT 1) AS "nomLotUltim"
     FROM baixes b
     JOIN animals a ON a.id = b.animal_id
     LEFT JOIN races_cataleg r ON r.id = a.raca_id
     WHERE ${condicions.join(' AND ')}
     ORDER BY b.data_baixa DESC, b.id DESC`,
    params
  )
}

/**
 * Retorna la fitxa completa d'un animal de l'arxiu: dades bàsiques,
 * historial complet de lots/corts, historial de pesos, historial de
 * tractaments, i dades de la baixa.
 *
 * @param ctx - Context del tenant (schema, usuari, rol)
 * @param animalId - Id de l'animal
 * @returns Fitxa completa, o null si l'animal no existeix o no és inactiu
 *
 * @remarks A diferència de getFitxaAnimal (mòdul Animals, només
 * l'ubicació ACTUAL), aquí es retorna l'historial COMPLET de
 * distribucions — un animal de l'arxiu ja no en té cap d'activa,
 * té sentit veure per on ha passat al llarg de la seva vida a la
 * granja.
 * @remarks Rendiment calculat en JS (no a la query): (pesCanalKg /
 * pesViuKg) × 100, només si pesCanalKg és informat
 * (docs/07_modul_arxiu_historic.md, secció 3.2).
 * @remarks NO inclou cost sanitari acumulat — fora d'abast (veure
 * docs/07_modul_arxiu_historic.md, secció 5, nota).
 * @remarks Control d'accés: Admin i Veterinari (lectura).
 * @remarks Multitenancy: aïllat via queryTenant/search_path.
 */
export async function getFitxaArxiu(
  ctx: TenantContext,
  animalId: number
): Promise<FitxaArxiu | null> {
  const basiques = await queryTenant<{
    id: number
    dib: string
    nomRaca: string | null
    dataNaixement: string | null
    sexe: 'Mascle' | 'Femella' | null
    estatSalut: string
  }>(
    ctx,
    `SELECT
       a.id, a.dib,
       r.nom_raca       AS "nomRaca",
       a.data_naixement AS "dataNaixement",
       a.sexe,
       a.estat_salut    AS "estatSalut"
     FROM animals a
     LEFT JOIN races_cataleg r ON r.id = a.raca_id
     WHERE a.id = $1 AND a.estat_actiu = FALSE`,
    [animalId]
  )

  if (basiques.length === 0) return null

  const [historialDistribucions, historialPes, historialTractaments, baixaRows] = await Promise.all([
    queryTenant<{ nomLot: string | null; codiCort: string | null; dataEntrada: string; dataSortida: string | null }>(
      ctx,
      `SELECT l.nom_lot AS "nomLot", c.codi_cort AS "codiCort",
              da.data_entrada AS "dataEntrada", da.data_sortida AS "dataSortida"
       FROM distribucio_animals da
       LEFT JOIN lots l  ON l.id = da.lot_id
       LEFT JOIN corts c ON c.id = da.cort_id
       WHERE da.animal_id = $1
       ORDER BY da.data_entrada DESC`,
      [animalId]
    ),
    queryTenant<{ data: string; pesKg: string }>(
      ctx,
      `SELECT data, pes_kg AS "pesKg" FROM registre_pes WHERE animal_id = $1 ORDER BY data DESC`,
      [animalId]
    ),
    queryTenant<{
      id: number
      nomMedicament: string
      dataInici: string
      dataAlliberament: string | null
    }>(
      ctx,
      `SELECT t.id, m.nom_medicament AS "nomMedicament",
              t.data_inici AS "dataInici", t.data_alliberament AS "dataAlliberament"
       FROM tractaments t
       JOIN medicaments m ON m.id = t.medicament_id
       WHERE t.animal_id = $1
       ORDER BY t.data_inici DESC`,
      [animalId]
    ),
    queryTenant<{
      motiu: 'Venda' | 'Mort'
      dataBaixa: string
      pesViuKg: string | null
      pesCanalKg: string | null
      preuKg: string | null
      costTransport: string | null
      compradorEscorxador: string | null
      causaMort: string | null
      codiRecollidaCadavers: string | null
    }>(
      ctx,
      `SELECT motiu, data_baixa AS "dataBaixa",
              pes_viu_kg AS "pesViuKg", pes_canal_kg AS "pesCanalKg",
              preu_kg AS "preuKg", cost_transport AS "costTransport",
              comprador_escorxador AS "compradorEscorxador",
              causa_mort AS "causaMort", codi_recollida_cadavers AS "codiRecollidaCadavers"
       FROM baixes
       WHERE animal_id = $1
       ORDER BY data_baixa DESC
       LIMIT 1`,
      [animalId]
    ),
  ])

  // Un animal amb estat_actiu = FALSE hauria de tenir sempre
  // exactament una fila a `baixes` (registrarBaixa insereix totes
  // dues coses a la mateixa transacció — src/lib/db/queries/baixes.ts).
  // Si no n'hi ha cap, és una inconsistència de dades real: es
  // retorna null en comptes d'inventar un motiu per defecte.
  if (baixaRows.length === 0) return null
  const b = baixaRows[0]

  const pesViuKg = b.pesViuKg !== null ? Number(b.pesViuKg) : null
  const pesCanalKg = b.pesCanalKg !== null ? Number(b.pesCanalKg) : null

  return {
    ...basiques[0],
    historialDistribucions,
    historialPes: historialPes.map((p) => ({ ...p, pesKg: Number(p.pesKg) })),
    historialTractaments,
    baixa: {
      motiu: b.motiu,
      dataBaixa: b.dataBaixa,
      pesViuKg,
      pesCanalKg,
      preuKg: b.preuKg !== null ? Number(b.preuKg) : null,
      costTransport: b.costTransport !== null ? Number(b.costTransport) : null,
      compradorEscorxador: b.compradorEscorxador,
      rendiment: pesViuKg && pesCanalKg ? (pesCanalKg / pesViuKg) * 100 : null,
      causaMort: b.causaMort,
      codiRecollidaCadavers: b.codiRecollidaCadavers,
    },
  }
}
