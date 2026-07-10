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
 * Ubicació amb les seves zones i corts ja agrupats, per a la vista
 * jeràrquica completa (Granja → Zona → Cort).
 */
export type UbicacioAmbJerarquia = Ubicacio & {
  zones: (ZonaInfraestructura & { corts: Cort[] })[]
}
