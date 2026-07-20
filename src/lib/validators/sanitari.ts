import { z } from 'zod'

/**
 * Alta d'un medicament nou al catàleg (dades mestres, no estoc).
 * @remarks Substitueix l'antic crearMedicamentSchema (que barrejava
 * dades mestres i d'estoc en un únic formulari) — des de la migració
 * 10_migracio_cataleg_medicaments.sql, "Nou medicament" només crea
 * l'entrada del catàleg; l'estoc es dona d'alta per separat amb
 * afegirEntradaMedicamentSchema.
 */
export const crearMedicamentCatalegSchema = z.object({
  nomMedicament: z.string().trim().min(1, 'El nom és obligatori').max(255),
  principiActiu: z.string().trim().min(1, 'El principi actiu és obligatori').max(255),
  posologiaStandard: z.string().trim().max(1000).optional().or(z.literal('')),
  diesSupressio: z.number().int().nonnegative({ message: 'Els dies de supressió no poden ser negatius' }),
})

/**
 * Alta d'una entrada d'estoc (compra/lot) d'un medicament ja existent
 * al catàleg.
 * @remarks `quantitatEstoc` correspon al "nombre d'ampolles o sobres"
 * (o la unitat que correspongui) — el camp és el mateix, només canvia
 * l'etiqueta mostrada a la UI segons el context.
 */
export const afegirEntradaMedicamentSchema = z.object({
  medicamentCatalegId: z.number().int().positive({ message: 'Cal seleccionar un medicament del catàleg' }),
  lot: z.string().trim().min(1, 'El lot és obligatori').max(100),
  quantitatEstoc: z.number().nonnegative({ message: 'L\'estoc no pot ser negatiu' }),
  unitatEstoc: z.string().trim().min(1, 'La unitat és obligatòria').max(20),
  preuCompra: z.number().nonnegative({ message: 'El preu no pot ser negatiu' }),
})

/**
 * Validació d'una fila del CSV de medicaments.
 * @remarks Format SENSE CANVIS (decisió confirmada): cada fila
 * segueix portant totes les dades encara que el medicament ja
 * existeixi al catàleg — la lògica de crear/reutilitzar el catàleg
 * es resol a importarMedicamentsMassiu()
 * (src/lib/db/queries/sanitari.ts), no aquí.
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

export type CrearMedicamentCatalegInput = z.infer<typeof crearMedicamentCatalegSchema>
export type AfegirEntradaMedicamentInput = z.infer<typeof afegirEntradaMedicamentSchema>
export type FilaCsvMedicamentInput = z.infer<typeof filaCsvMedicamentSchema>
export type BulkImportMedicamentsInput = z.infer<typeof bulkImportMedicamentsSchema>
export type AplicarTractamentInput = z.infer<typeof aplicarTractamentSchema>
