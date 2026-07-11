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

/**
 * @remarks `dib` és l'únic identificador de l'animal — el DIB i el
 * crotal físic a l'orella són la mateixa dada.
 */
export type Animal = {
  id:            number
  dib:           string
  racaId:        number | null
  dataNaixement: Date | null
  estatSalut:    EstatSalut
  sexe:          Sexe | null
  estatActiu:    boolean
  creatEl:       Date
  actualitzatEl: Date
}

/**
 * Animal actiu tal com el retorna getAnimalsActius() (join amb raça,
 * lot, cort, zona i ubicació), més l'indicador de bloqueig comercial.
 *
 * @remarks Definit de manera independent de `Animal` (no com a
 * extensió) perquè les queries que l'alimenten (getAnimalsActius,
 * cercarPerDib a src/lib/db/queries/animals.ts) no seleccionen
 * estatActiu, creatEl ni actualitzatEl — per definició, tot animal
 * actiu ja té estat_actiu = TRUE. Prometre aquests camps aquí donaria
 * una falsa sensació de tipatge complet quan en realitat mai arriben
 * del backend.
 * @remarks Des de la versió que afegeix filtres en cascada
 * (Granja/Zona/Lot) a la pantalla d'Animals, aquest tipus exposa
 * també els ids (lotId, cortId, zonaId, ubicacioId), no només els
 * noms — necessaris per fer el filtratge exacte als desplegables.
 * La query ja no es basa en la vista v_animals_actius (que només
 * exposava els noms), sinó en un JOIN directe (docs/08_modul_llistat_actius.md).
 */
export type AnimalActiu = {
  id:            number
  dib:           string
  nomRaca:       string | null
  dataNaixement: Date | null
  estatSalut:    EstatSalut
  sexe:          Sexe | null
  nomLot:        string | null
  lotId:         number | null
  codiCort:      string | null
  cortId:        number | null
  nomZona:       string | null
  zonaId:        number | null
  nomUbicacio:   string | null
  ubicacioId:    number | null
  dataEntrada:   Date | null
  edatDies:      number | null
  /** True si l'animal té un tractament actiu amb bloqueig comercial vigent. */
  enSupressio:   boolean
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
