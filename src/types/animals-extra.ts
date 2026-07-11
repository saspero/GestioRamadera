/** Opció genèrica per a un desplegable de filtre. */
export type OpcioFiltre = { id: number; nom: string }

/**
 * Catàlegs necessaris per als desplegables de filtre en cascada
 * (Granja → Zona → Lot) de la pantalla d'Animals.
 */
export type FiltresAnimals = {
  ubicacions: OpcioFiltre[]
  /** Cada zona porta el seu ubicacioId per filtrar el desplegable de Zona quan es tria una Granja. */
  zones: (OpcioFiltre & { ubicacioId: number })[]
  lots: OpcioFiltre[]
}

/** Un registre de pes de l'historial de l'animal. */
export type RegistrePesHistoric = {
  data: string
  pesKg: number
}

/** Un tractament de l'historial mèdic de l'animal. */
export type TractamentHistoric = {
  id: number
  nomMedicament: string
  dataInici: string
  dataAlliberament: string | null
  dosiAplicada: number | null
  unitatDosi: string | null
  notes: string | null
}

/**
 * Fitxa completa d'un animal: dades bàsiques + ubicació actual +
 * historial de pesos + historial de tractaments.
 */
export type FitxaAnimal = {
  id: number
  dib: string
  nomRaca: string | null
  dataNaixement: string | null
  sexe: 'Mascle' | 'Femella' | null
  estatSalut: 'Sa' | 'En tractament' | 'Observació' | 'Crític'
  estatActiu: boolean
  nomUbicacio: string | null
  nomZona: string | null
  codiCort: string | null
  nomLot: string | null
  dataEntradaLot: string | null
  edatDies: number | null
  historialPes: RegistrePesHistoric[]
  historialTractaments: TractamentHistoric[]
}
