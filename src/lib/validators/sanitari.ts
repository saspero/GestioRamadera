import { z } from 'zod'

/**
 * Alta d'un medicament nou al catàleg (dades mestres, no estoc).
 * @remarks Reutilitzat també per a l'edició (actualitzarMedicamentCatalegSchema
 * és un àlies d'aquest mateix schema — els camps editables coincideixen).
 */
export const crearMedicamentCatalegSchema = z.object({
  nomMedicament: z.string().trim().min(1, 'El nom és obligatori').max(255),
  principiActiu: z.string().trim().min(1, 'El principi actiu és obligatori').max(255),
  posologiaStandard: z.string().trim().max(1000).optional().or(z.literal('')),
  diesSupressio: z.number().int().nonnegative({ message: 'Els dies de supressió no poden ser negatius' }),
})

/** Edició d'un medicament del catàleg — mateixos camps que la creació (juliol 2026). */
export const actualitzarMedicamentCatalegSchema = crearMedicamentCatalegSchema

/**
 * Alta d'una entrada d'estoc (compra/lot) d'un medicament ja existent
 * al catàleg.
 * @remarks Model d'estoc (juliol 2026, migració
 * 13_migracio_estoc_unitats_medicaments.sql): en comptes d'un total
 * introduït a mà (`quantitatEstoc`), ara es demana el nombre
 * d'ampolles/sobres (`nombreUnitats`) i quant conté cadascuna
 * (`quantitatPerUnitat`) — l'estoc total es calcula automàticament.
 */
export const afegirEntradaMedicamentSchema = z.object({
  medicamentCatalegId: z.number().int().positive({ message: 'Cal seleccionar un medicament del catàleg' }),
  lot: z.string().trim().min(1, 'El lot és obligatori').max(100),
  nombreUnitats: z.number().nonnegative({ message: 'El nombre d\'unitats no pot ser negatiu' }),
  unitatPaquet: z.string().trim().min(1, 'La unitat de paquet és obligatòria').max(20),
  quantitatPerUnitat: z.number().positive({ message: 'La quantitat per unitat ha de ser superior a 0' }),
  unitatContingut: z.string().trim().min(1, 'La unitat de contingut és obligatòria').max(20),
  preuCompra: z.number().nonnegative({ message: 'El preu no pot ser negatiu' }),
})

/**
 * Edició d'una entrada d'estoc ja existent (juliol 2026).
 * @remarks `medicamentCatalegId` NO és editable — es fixa en crear
 * l'entrada.
 */
export const actualitzarEntradaMedicamentSchema = afegirEntradaMedicamentSchema.omit({
  medicamentCatalegId: true,
})

/**
 * Validació d'una fila del CSV de medicaments.
 * @remarks Format ACTUALITZAT (juliol 2026) amb el nou model d'estoc
 * — `quantitat`+`unitat` passen a ser 4 columnes:
 * `nombre_unitats`, `unitat_paquet`, `quantitat_per_unitat`, `unitat_contingut`.
 */
export const filaCsvMedicamentSchema = z.object({
  nom_medicament: z.string().trim().min(1, 'Nom obligatori').max(255),
  principi_actiu: z.string().trim().min(1, 'Principi actiu obligatori').max(255),
  lot: z.string().trim().min(1, 'Lot obligatori').max(100),
  nombre_unitats: z.string().trim().regex(/^\d+([.,]\d+)?$/, 'Nombre d\'unitats no vàlid'),
  unitat_paquet: z.string().trim().min(1, 'Unitat de paquet obligatòria').max(20),
  quantitat_per_unitat: z.string().trim().regex(/^\d+([.,]\d+)?$/, 'Quantitat per unitat no vàlida'),
  unitat_contingut: z.string().trim().min(1, 'Unitat de contingut obligatòria').max(20),
  posologia: z.string().trim().max(1000).optional().or(z.literal('')),
  preu: z.string().trim().regex(/^\d+([.,]\d+)?$/, 'Preu no vàlid'),
  dies_supressio: z.string().trim().regex(/^\d+$/, 'Dies de supressió no vàlids'),
})

export const bulkImportMedicamentsSchema = z.object({
  medicaments: z.array(filaCsvMedicamentSchema).min(1, 'Cal almenys un medicament vàlid'),
})

/** Unitats de dosi disponibles (juliol 2026, abans era text lliure). */
const unitatDosiEnum = z.enum(['ml', 'g', 'mg', 'unitats', 'cc'])

/**
 * Aplicació d'un tractament, individual o per lot (mateix schema).
 * @remarks `animalIds` sempre és un array — amb un únic element per
 * al mode individual (docs/06_modul_sanitari.md, secció 4.1).
 * @remarks `unitatDosi` ara és un desplegable tancat (juliol 2026),
 * abans text lliure.
 */
export const aplicarTractamentSchema = z.object({
  animalIds: z.array(z.number().int().positive()).min(1, 'Cal seleccionar almenys un animal'),
  medicamentId: z.number().int().positive({ message: 'Cal seleccionar un medicament' }),
  dataInici: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-DD'),
  dataFiPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  dosiAplicada: z.number().positive().optional(),
  unitatDosi: unitatDosiEnum.optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

/**
 * Edició d'un tractament ja aplicat (juliol 2026).
 * @remarks Només dosi, data de fi prevista i notes — no l'animal, el
 * medicament ni la data d'inici (decisió confirmada amb l'usuari).
 */
export const actualitzarTractamentSchema = z.object({
  dosiAplicada: z.number().positive().optional(),
  dataFiPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

/**
 * Eliminació d'un tractament, amb motiu obligatori (juliol 2026).
 * @remarks Si `motiu === 'Altres'`, `motiuAltres` esdevé obligatori
 * (validat amb `.refine`, ja que Zod no ho pot expressar amb un
 * `.optional()` condicional directe).
 */
export const eliminarTractamentSchema = z
  .object({
    motiu: z.enum(['Error d\'entrada', 'Duplicat', 'Dosi incorrecta', 'Medicament incorrecte', 'Altres']),
    motiuAltres: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .refine((data) => data.motiu !== 'Altres' || (data.motiuAltres && data.motiuAltres.trim().length > 0), {
    message: 'Cal especificar el motiu quan es tria "Altres"',
    path: ['motiuAltres'],
  })

export type CrearMedicamentCatalegInput = z.infer<typeof crearMedicamentCatalegSchema>
export type ActualitzarMedicamentCatalegInput = z.infer<typeof actualitzarMedicamentCatalegSchema>
export type AfegirEntradaMedicamentInput = z.infer<typeof afegirEntradaMedicamentSchema>
export type ActualitzarEntradaMedicamentInput = z.infer<typeof actualitzarEntradaMedicamentSchema>
export type FilaCsvMedicamentInput = z.infer<typeof filaCsvMedicamentSchema>
export type BulkImportMedicamentsInput = z.infer<typeof bulkImportMedicamentsSchema>
export type AplicarTractamentInput = z.infer<typeof aplicarTractamentSchema>
export type ActualitzarTractamentInput = z.infer<typeof actualitzarTractamentSchema>
export type EliminarTractamentInput = z.infer<typeof eliminarTractamentSchema>
