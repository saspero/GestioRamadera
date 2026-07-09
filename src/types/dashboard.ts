/**
 * Tipus de resposta del Dashboard, consolidats en un únic endpoint.
 *
 * @remarks Cada bloc és opcional (`?`) perquè el backend només inclou
 * els blocs corresponents al rol de l'usuari autenticat (veure
 * src/app/api/dashboard/route.ts). Un bloc absent significa "aquest
 * rol no hi té accés", no "sense dades".
 */
export type DashboardResponse = {
  totalAnimals?: TotalAnimalsBlock
  lotsActius?: LotActiuBlock[]
  estocMagatzems?: EstocMagatzemBlock[]
  animalsEnSupressio?: AnimalEnSupressioBlock[]
  alertesEstoc?: AlertaEstocBlock[]
  ultimesBaixes?: BaixaRecentBlock[]
  distribucioSalut?: DistribucioSalutBlock[]
}

/** Total d'animals actius a l'explotació. */
export type TotalAnimalsBlock = {
  total: number
}

/**
 * Resum d'un lot actiu: consum mitjà de pinso repartit proporcionalment
 * i dies transcorreguts des de la creació del lot.
 */
export type LotActiuBlock = {
  lotId: number
  nomLot: string
  nombreAnimals: number
  diesDesDeCreacio: number
  /** Consum mitjà de pinso en kg/dia, repartit proporcionalment per animal actiu a la zona. Null si no hi ha dades de consum. */
  consumMitjaKgDia: number | null
}

/** Estat d'estoc d'una sitja o magatzem de farratge. */
export type EstocMagatzemBlock = {
  id: number
  nom: string
  tipus: 'sitja' | 'magatzem'
  estocActual: number
  unitat: 'kg' | 'tones'
  estatAlerta: 'NORMAL' | 'BAIX' | 'ESGOTAT'
}

/** Animal amb bloqueig comercial actiu per període de supressió. */
export type AnimalEnSupressioBlock = {
  animalId: number
  crotalId: string
  nomMedicament: string
  dataAlliberament: string
  diesRestants: number
}

/** Alerta d'estoc baix o esgotat (subconjunt crític d'EstocMagatzemBlock). */
export type AlertaEstocBlock = EstocMagatzemBlock

/** Baixa recent (venda o mort) per al resum del Dashboard. */
export type BaixaRecentBlock = {
  animalId: number
  crotalId: string
  motiu: 'Venda' | 'Mort'
  dataBaixa: string
}

/** Recompte d'animals actius agrupats per estat de salut. */
export type DistribucioSalutBlock = {
  estatSalut: 'Sa' | 'En tractament' | 'Observació' | 'Crític'
  total: number
}
