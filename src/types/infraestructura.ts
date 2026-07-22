/**
 * Tipus de zona dins d'una ubicació (granja).
 * @remarks Ha de coincidir amb l'ENUM tipus_zona_enum de la BD.
 */
export type TipusZona = 'NAU_ANIMALS' | 'COBERT_EMMAGATZEMATGE' | 'PASTURA'

/**
 * Ubicació física (granja/finca). Nivell superior de la jerarquia
 * d'infraestructura: Granja → Zona → Cort.
 */
export type Ubicacio = {
  id: number
  nom: string
  codiPasturaExtensiu: string | null
}

/**
 * Zona dins d'una ubicació (nau, cobert d'emmagatzematge o pastura).
 */
export type ZonaInfraestructura = {
  id: number
  ubicacioId: number
  nom: string
  tipusZona: TipusZona
}

/**
 * Cort física dins d'una zona de tipus NAU_ANIMALS.
 * @remarks La BD garanteix amb un trigger que zonaId només pot
 * referenciar una zona de tipus NAU_ANIMALS — la UI ha de filtrar
 * el desplegable de zones en conseqüència per evitar errors 500.
 */
export type Cort = {
  id: number
  zonaId: number
  codiCort: string
  capacitatMaxima: number | null
}

/**
 * Cort amb el nombre d'animals actius que hi ha assignats
 * actualment, per a la vista jeràrquica.
 * @remarks Nou (juliol 2026). NOMÉS s'utilitza dins de
 * UbicacioAmbJerarquia — el tipus base `Cort` (usat també als
 * formularis de creació/edició de ModalCort) es manté intacte.
 */
export type CortAmbComptador = Cort & { nombreAnimals: number }

/**
 * Zona amb el nombre d'animals (suma de les seves corts) i les
 * corts ja amb el seu propi comptador.
 * @remarks Nou (juliol 2026). El tipus base `ZonaInfraestructura`
 * es manté intacte per als formularis.
 */
export type ZonaAmbComptador = ZonaInfraestructura & {
  nombreAnimals: number
  corts: CortAmbComptador[]
}

/**
 * Ubicació amb les seves zones i corts ja agrupats, per a la vista
 * jeràrquica completa (Granja → Zona → Cort), cadascuna amb el
 * nombre d'animals que hi ha actualment.
 *
 * @remarks nombreAnimals (juliol 2026) es calcula sempre com la
 * suma dels nivells inferiors: el d'una zona és la suma de les
 * seves corts, i el d'una ubicació és la suma de les seves zones.
 */
export type UbicacioAmbJerarquia = Ubicacio & {
  nombreAnimals: number
  zones: ZonaAmbComptador[]
}
