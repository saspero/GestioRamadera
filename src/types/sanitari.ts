/**
 * Medicament de l'inventari sanitari.
 */
export type Medicament = {
  id: number
  nomMedicament: string
  principiActiu: string
  lot: string
  quantitatEstoc: number
  unitatEstoc: string
  posologiaStandard: string | null
  preuCompra: number
  diesSupressio: number
}

/**
 * Tractament aplicat a un animal, amb el nom del medicament per a
 * la vista de llistat (evita un JOIN addicional al client).
 */
export type TractamentAmbMedicament = {
  id: number
  animalId: number
  animalDib: string
  nomMedicament: string
  dataInici: string
  dataFiPrevista: string | null
  dataAlliberament: string | null
  dosiAplicada: number | null
  unitatDosi: string | null
  notes: string | null
}

/** Fila individual del CSV d'importació massiva de medicaments. */
export type FilaCsvMedicament = {
  nom_medicament: string
  principi_actiu: string
  lot: string
  quantitat: string
  unitat: string
  posologia: string
  preu: string
  dies_supressio: string
}

/**
 * Payload per aplicar un tractament, individual o per lot.
 * @remarks Si `lotId` s'informa, s'aplica a tots els animals actius
 * del lot amb la mateixa dosi/data (docs/06_modul_sanitari.md,
 * secció 4.2 — confirmat que ambdós formularis comparteixen els
 * mateixos camps, sense personalització per animal).
 */
export type AplicarTractamentInput = {
  animalIds: number[]
  medicamentId: number
  dataInici: string
  dataFiPrevista?: string
  dosiAplicada?: number
  unitatDosi?: string
  notes?: string
}
