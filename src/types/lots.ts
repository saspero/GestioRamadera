/**
 * Lot amb el recompte d'animals actius que conté.
 */
export type LotResum = {
  id: number
  nomLot: string
  dataCreacio: string
  nombreAnimals: number
}

/**
 * Animal actiu dins d'un lot concret, per al detall expandible.
 * @remarks Subconjunt d'AnimalActiu (src/types/db.ts) amb només els
 * camps rellevants per a la vista de detall del lot.
 */
export type AnimalDelLot = {
  id: number
  dib: string
  nomRaca: string | null
  codiCort: string | null
  dataEntrada: string | null
}

/**
 * Payload per moure un o més animals a un altre lot, opcionalment
 * canviant també la cort de destí.
 */
export type MoureAnimalsInput = {
  animalIds: number[]
  lotDestiId: number
  /** Si s'omet, cada animal manté la seva cort actual. */
  cortDestiId?: number
}
