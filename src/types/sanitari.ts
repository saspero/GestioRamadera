/**
 * Medicament de l'inventari sanitari (una entrada d'estoc/compra).
 * @remarks nomMedicament/principiActiu/posologiaStandard/diesSupressio
 * són ara dades del catàleg (medicaments_cataleg), incloses aquí via
 * JOIN per conveniència de la UI — no viuen físicament en aquesta
 * taula des de la migració 10_migracio_cataleg_medicaments.sql.
 */
export type Medicament = {
  id: number
  medicamentCatalegId: number
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
 * Dades mestres d'un medicament del catàleg (nom, principi actiu,
 * posologia, dies de supressió) — separades de l'estoc des de
 * juliol 2026.
 */
export type MedicamentCataleg = {
  id: number
  nomMedicament: string
  principiActiu: string
  posologiaStandard: string | null
  diesSupressio: number
}

/** Unitats disponibles per a la dosi d'un tractament (juliol 2026, desplegable). */
export type UnitatDosi = 'ml' | 'g' | 'mg' | 'unitats' | 'cc'

/**
 * Motiu d'eliminació d'un tractament (juliol 2026). Si el motiu és
 * "Altres", cal informar `motiuAltres` amb text lliure.
 */
export type MotiuEliminacioTractament =
  | 'Error d\'entrada'
  | 'Duplicat'
  | 'Dosi incorrecta'
  | 'Medicament incorrecte'
  | 'Altres'

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

/**
 * Fila individual del CSV d'importació massiva de medicaments.
 * @remarks Format sense canvis (decisió confirmada): cada fila
 * segueix incloent totes les dades (nom, principi actiu, posologia,
 * dies de supressió) encara que el medicament ja existeixi al
 * catàleg — si ja hi és, aquestes dades s'ignoren i només s'afegeix
 * l'entrada d'estoc; si és nou, es crea el catàleg i l'estoc alhora.
 */
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
  unitatDosi?: UnitatDosi
  notes?: string
}

/**
 * Payload per editar un tractament ja aplicat (juliol 2026).
 * @remarks Només dosi aplicada, data de fi prevista i notes són
 * editables — no l'animal, el medicament ni la data d'inici
 * (decisió confirmada amb l'usuari).
 * @remarks Editar la dosi NO ajusta retroactivament l'estoc que ja
 * es va descomptar en aplicar el tractament originalment — mateix
 * criteri que l'estoc negatiu (gestió manual si cal corregir-ho).
 */
export type ActualitzarTractamentInput = {
  dosiAplicada?: number
  dataFiPrevista?: string
  notes?: string
}

/** Payload per eliminar un tractament, amb el motiu obligatori. */
export type EliminarTractamentInput = {
  motiu: MotiuEliminacioTractament
  motiuAltres?: string
}
