export type UnitatMesura = 'kg' | 'Tones' | 'Unitats'
export type EstatMagatzem = 'Actiu' | 'Deshabilitat'
export type EstatAlerta = 'NORMAL' | 'BAIX' | 'ESGOTAT'
export type TipusOrigen = 'sitja' | 'magatzem'

/**
 * Magatzem o sitja amb l'estoc actual i l'estat d'alerta ja resolt
 * (reutilitza la vista v_estoc_magatzems, ja existent des del
 * lliurament del Dashboard).
 */
export type EstocMagatzemComplet = {
  tipus: TipusOrigen
  id: number
  nom: string
  tipusProducte: string | null
  estocActual: number
  unitat: 'kg' | 'tones'
  capacitat: number | null
  estocMinimEfectiu: number
  estat: EstatMagatzem
  estatAlerta: EstatAlerta
}

/** Origen seleccionable al formulari de consums massius. */
export type OrigenConsum = {
  tipus: TipusOrigen
  id: number
  nom: string
  /** Present només si tipus==='magatzem'; necessari per a la lògica de bales. */
  pesMitjaBalaKg: number | null
}

/** Zona seleccionable com a destí (Nau/Cort/Pastura — sempre a nivell de zona). */
export type ZonaDesti = {
  id: number
  nom: string
  tipusZona: 'NAU_ANIMALS' | 'COBERT_EMMAGATZEMATGE' | 'PASTURA'
}

/** Catàlegs necessaris per al formulari de consums massius. */
export type CatalegsConsum = {
  origens: OrigenConsum[]
  destins: ZonaDesti[]
}

/** Payload per registrar un consum massiu. */
export type RegistrarConsumInput = {
  origenTipus: TipusOrigen
  origenId: number
  zonaDestiId: number
  quantitat: number
  unitat: UnitatMesura
  data: string
}
