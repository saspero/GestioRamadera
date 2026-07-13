/**
 * Converteix una quantitat consumida (en la unitat indicada) a
 * l'equivalent en tones, per poder descomptar-la de l'estoc de
 * magatzems_farratge (que sempre es guarda en tones).
 *
 * @param quantitat - Quantitat introduïda al formulari
 * @param unitat - Unitat de mesura seleccionada
 * @param pesMitjaBalaKg - Pes mitjà per bala del magatzem, en kg
 * (obligatori si `unitat === 'Unitats'`, ignorat en cas contrari)
 * @returns Quantitat equivalent en tones
 * @throws Error si `unitat === 'Unitats'` i `pesMitjaBalaKg` és null
 *
 * @remarks Lògica de bales (docs/09_modul_logistica_farratges.md,
 * secció 2.2): quantitat_kg_real = quantitat_bales × pes_mitja_bala_kg.
 * Aquesta funció retorna el resultat en TONES (no kg), ja que
 * magatzems_farratge.estoc_actual_tones és la unitat d'emmagatzematge
 * a la BD — la conversió final a "quantitat_kg_real" (sempre en kg,
 * per a la columna moviments_farratge.quantitat_kg_real) es fa
 * multiplicant per 1000 al cridant.
 * @remarks Extreta de src/lib/db/queries/logistica.ts
 * (registrarConsum) com a funció pura, testejable sense connexió a
 * BD — abans la lògica estava inline dins de la funció async.
 */
export function calcularQuantitatEnTones(
  quantitat: number,
  unitat: 'kg' | 'Tones' | 'Unitats',
  pesMitjaBalaKg: number | null
): number {
  if (unitat === 'Unitats') {
    if (pesMitjaBalaKg === null) {
      throw new Error('Aquest magatzem no té configurat el pes mitjà per bala')
    }
    return (quantitat * pesMitjaBalaKg) / 1000
  }
  if (unitat === 'kg') {
    return quantitat / 1000
  }
  return quantitat // ja és en Tones
}

/**
 * Calcula el pes equivalent en kg d'un nombre de bales, per mostrar
 * el missatge informatiu al formulari ("2 bales = 700 kg") abans de
 * confirmar el consum.
 *
 * @param nombreBales - Nombre de bales introduït
 * @param pesMitjaBalaKg - Pes mitjà per bala del magatzem, en kg
 * @returns Pes equivalent en kg
 *
 * @remarks docs/09_modul_logistica_farratges.md, secció 2.2, pas 3.
 */
export function calcularPesEquivalentBales(nombreBales: number, pesMitjaBalaKg: number): number {
  return nombreBales * pesMitjaBalaKg
}

/**
 * Resol el llindar d'alerta efectiu d'un magatzem/sitja, seguint la
 * jerarquia: valor específic del magatzem si existeix, si no el
 * valor global de configuracio_general.
 *
 * @param llindarEspecific - estoc_minim propi del magatzem (null si no configurat)
 * @param llindarGlobal - estoc_minim_default del tenant
 * @returns El llindar efectiu a aplicar
 *
 * @remarks docs/09_modul_logistica_farratges.md, secció 3.1
 * (Model de Configuració en Cascada). Aquesta mateixa lògica ja
 * s'aplica dins de la query SQL amb COALESCE() — aquesta funció
 * pura reflecteix exactament el mateix comportament per poder-lo
 * testejar sense base de dades.
 */
export function resoldreLlindarAlerta(
  llindarEspecific: number | null,
  llindarGlobal: number
): number {
  return llindarEspecific ?? llindarGlobal
}

/**
 * Determina l'estat d'alerta d'un magatzem segons el seu estoc
 * actual i el llindar efectiu.
 *
 * @param estocActual - Estoc actual del magatzem
 * @param llindar - Llindar d'alerta efectiu (ja resolt amb resoldreLlindarAlerta)
 * @returns 'ESGOTAT' si l'estoc és 0, 'BAIX' si és menor o igual al
 * llindar, 'NORMAL' en cas contrari
 *
 * @remarks docs/09_modul_logistica_farratges.md, secció 3.2.
 */
export function calcularEstatAlerta(
  estocActual: number,
  llindar: number
): 'NORMAL' | 'BAIX' | 'ESGOTAT' {
  if (estocActual === 0) return 'ESGOTAT'
  if (estocActual <= llindar) return 'BAIX'
  return 'NORMAL'
}
