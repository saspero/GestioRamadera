export type MotiuBaixa = 'Venda' | 'Mort'

/** Fila de la taula unificada d'inactius (docs/07_modul_arxiu_historic.md, secció 2.1). */
export type AnimalInactiu = {
  id: number
  dib: string
  nomRaca: string | null
  dataNaixement: string | null
  dataBaixa: string
  motiu: MotiuBaixa
  nomLotUltim: string | null
}

/** Filtres aplicables al llistat d'inactius. */
export type FiltresArxiu = {
  cerca: string
  motiu: 'Tots' | MotiuBaixa
  dataDes: string
  dataFins: string
}

/** Una entrada de l'historial de lots/corts d'un animal (totes, no només l'actual). */
export type HistorialDistribucio = {
  nomLot: string | null
  codiCort: string | null
  dataEntrada: string
  dataSortida: string | null
}

/** Dades de la baixa (venda o mort), amb tots els camps del motiu corresponent. */
export type DadesBaixa = {
  motiu: MotiuBaixa
  dataBaixa: string
  // Venda
  pesViuKg: number | null
  pesCanalKg: number | null
  preuKg: number | null
  costTransport: number | null
  compradorEscorxador: string | null
  /** (pesCanalKg / pesViuKg) × 100, calculat només si pesCanalKg és informat. */
  rendiment: number | null
  // Mort
  causaMort: string | null
  codiRecollidaCadavers: string | null
}

/**
 * Fitxa completa d'un animal de l'arxiu (docs/07_modul_arxiu_historic.md, secció 5).
 * @remarks NO inclou cost sanitari acumulat — fora d'abast (gap de
 * dades: no es guarda la quantitat original comprada d'un
 * medicament, només l'estoc actual, que varia amb el temps).
 */
export type FitxaArxiu = {
  id: number
  dib: string
  nomRaca: string | null
  dataNaixement: string | null
  sexe: 'Mascle' | 'Femella' | null
  estatSalut: string
  historialDistribucions: HistorialDistribucio[]
  historialPes: { data: string; pesKg: number }[]
  historialTractaments: {
    id: number
    nomMedicament: string
    dataInici: string
    dataAlliberament: string | null
  }[]
  baixa: DadesBaixa
}
