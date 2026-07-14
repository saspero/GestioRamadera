export type UnitatMesura = 'kg' | 'Tones' | 'Unitats'
export type EstatMagatzem = 'Actiu' | 'Deshabilitat'
export type EstatAlerta = 'NORMAL' | 'BAIX' | 'ESGOTAT'
export type TipusOrigen = 'sitja' | 'magatzem'

/**
 * Magatzem o sitja amb l'estoc actual i l'estat d'alerta ja resolt.
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

/**
 * Zona seleccionable com a destí (Nau d'animals o Pastura —
 * excloent explícitament COBERT_EMMAGATZEMATGE, que no consumeix
 * aliment, només l'emmagatzema).
 */
export type ZonaDesti = {
  id: number
  nom: string
  tipusZona: 'NAU_ANIMALS' | 'PASTURA'
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

/** Component (ingredient) d'un tipus de pinso, amb el seu percentatge. */
export type ComponentPinso = {
  id: number
  nomComponent: string
  percentatge: number
}

/** Tipus de pinso del catàleg, amb la seva composició completa. */
export type TipusPinso = {
  id: number
  codi: string
  nom: string
  components: ComponentPinso[]
}

/** Sitja gestionable (creació/edició), amb el nom del tipus de pinso per a la llista. */
export type Sitja = {
  id: number
  nom: string
  ubicacioId: number
  nomUbicacio: string
  tipusPinsoId: number | null
  nomTipusPinso: string | null
  capacitatKg: number | null
  estocActualKg: number
  estocMinimKg: number | null
  estat: EstatMagatzem
}

/** Magatzem de farratge gestionable (creació/edició). */
export type MagatzemFarratge = {
  id: number
  zonaId: number
  nomZona: string
  tipusFarratge: string
  capacitatMaximaTones: number | null
  estocActualTones: number
  estocMinimTones: number | null
  pesMitjaBalaKg: number | null
  estat: EstatMagatzem
}
