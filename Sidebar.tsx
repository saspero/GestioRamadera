// Tipus TypeScript que reflecteixen les taules de la BD

export type Rol = 'Admin' | 'Veterinari' | 'Treballador'
export type TipusExplotacio = 'Llet' | 'Engreix' | 'Extensiu'
export type EstatSalut = 'Sa' | 'En tractament' | 'Observació' | 'Crític'
export type Sexe = 'Mascle' | 'Femella'
export type MotiuBaixa = 'Venda' | 'Mort'
export type UnitatMesura = 'kg' | 'Tones' | 'Unitats'
export type EstatMagatzem = 'Actiu' | 'Deshabilitat'

export type Tenant = {
  id:              number
  nomEmpresa:      string
  tipusExplotacio: TipusExplotacio
  schemaName:      string
  actiu:           boolean
  creatEl:         Date
}

export type User = {
  id:           number
  tenantId:     number
  nom:          string
  email:        string
  rol:          Rol
  actiu:        boolean
  darrerAcces:  Date | null
}

export type Animal = {
  id:            number
  crotalId:      string
  dib:           string | null
  racaId:        number | null
  dataNaixement: Date | null
  estatSalut:    EstatSalut
  sexe:          Sexe | null
  estatActiu:    boolean
  creatEl:       Date
  actualitzatEl: Date
}

export type AnimalActiu = Animal & {
  nomRaca:     string | null
  nomLot:      string | null
  codiCort:    string | null
  nomZona:     string | null
  dataEntrada: Date | null
  edatDies:    number | null
}

export type Medicament = {
  id:                number
  nomMedicament:     string
  principiActiu:     string
  lot:               string
  quantitatEstoc:    number
  unitatEstoc:       string
  posologiaStandard: string | null
  preuCompra:        number
  diesSupressio:     number
}

export type Tractament = {
  id:               number
  animalId:         number
  medicamentId:     number
  dataInici:        Date
  dataFiPrevista:   Date | null
  dataFiReal:       Date | null
  dosiAplicada:     number | null
  unitatDosi:       string | null
  dataAlliberament: Date | null
  notes:            string | null
  aplicatPer:       number | null
}
