import { z } from 'zod'

/**
 * Alta/edició manual d'un medicament (formulari individual, no CSV).
 * @remarks Camps obligatoris segons docs/06_modul_sanitari.md, secció 2.1.
 */
export const crearMedicamentSchema = z.object({
  nomMedicament: z.string().trim().min(1, 'El nom és obligatori').max(255),
  principiActiu: z.string().trim().min(1, 'El principi actiu és obligatori').max(255),
  lot: z.string().trim().min(1, 'El lot és obligatori').max(100),
  quantitatEstoc: z.number().nonnegative({ message: 'L\'estoc no pot ser negatiu' }),
  unitatEstoc: z.string().trim().min(1, 'La unitat és obligatòria').max(20),
  posologiaStandard: z.string().trim().max(1000).optional().or(z.literal('')),
  preuCompra: z.number().nonnegative({ message: 'El preu no pot ser negatiu' }),
  diesSupressio: z.number().int().nonnegative({ message: 'Els dies de supressió no poden ser negatius' }),
})

/**
 * Validació d'una fila del CSV de medicaments.
 * @remarks Els valors numèrics arriben com a string amb coma decimal
 * (docs/06_modul_sanitari.md, secció 3.2) — la conversió a número es
 * fa a la capa d'aplicació, no aquí (aquest schema valida el format
 * de text abans de parsejar-lo).
 */
export const filaCsvMedicamentSchema = z.object({
  nom_medicament: z.string().trim().min(1, 'Nom obligatori').max(255),
  principi_actiu: z.string().trim().min(1, 'Principi actiu obligatori').max(255),
  lot: z.string().trim().min(1, 'Lot obligatori').max(100),
  quantitat: z.string().trim().regex(/^\d+([.,]\d+)?$/, 'Quantitat no vàlida'),
  unitat: z.string().trim().min(1, 'Unitat obligatòria').max(20),
  posologia: z.string().trim().max(1000).optional().or(z.literal('')),
  preu: z.string().trim().regex(/^\d+([.,]\d+)?$/, 'Preu no vàlid'),
  dies_supressio: z.string().trim().regex(/^\d+$/, 'Dies de supressió no vàlids'),
})

export const bulkImportMedicamentsSchema = z.object({
  medicaments: z.array(filaCsvMedicamentSchema).min(1, 'Cal almenys un medicament vàlid'),
})

/**
 * Aplicació d'un tractament, individual o per lot (mateix schema).
 * @remarks `animalIds` sempre és un array — amb un únic element per
 * al mode individual (docs/06_modul_sanitari.md, secció 4.1).
 */
export const aplicarTractamentSchema = z.object({
  animalIds: z.array(z.number().int().positive()).min(1, 'Cal seleccionar almenys un animal'),
  medicamentId: z.number().int().positive({ message: 'Cal seleccionar un medicament' }),
  dataInici: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-DD'),
  dataFiPrevista: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  dosiAplicada: z.number().positive().optional(),
  unitatDosi: z.string().trim().max(20).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

export type CrearMedicamentInput = z.infer<typeof crearMedicamentSchema>
export type FilaCsvMedicamentInput = z.infer<typeof filaCsvMedicamentSchema>
export type BulkImportMedicamentsInput = z.infer<typeof bulkImportMedicamentsSchema>
export type AplicarTractamentInput = z.infer<typeof aplicarTractamentSchema>
