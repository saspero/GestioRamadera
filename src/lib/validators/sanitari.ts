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
 * Edició d'una entrada d'estoc ja existent (juliol 2026).
 * @remarks `medicamentCatalegId` NO és editable — a quin medicament
 * del catàleg correspon una entrada es fixa en crear-la, igual que
 * `ubicacioId` a una sitja o `zonaId` a un magatzem.
 */
export const actualitzarEntradaMedicamentSchema = afegirEntradaMedicamentSchema.omit({
  medicamentCatalegId: true,
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
export type AfegirEntradaMedicamentInput = z.infer<typeof afegirEntradaMedicamentSchema>
export type ActualitzarEntradaMedicamentInput = z.infer<typeof actualitzarEntradaMedicamentSchema>
export type FilaCsvMedicamentInput = z.infer<typeof filaCsvMedicamentSchema>
export type BulkImportMedicamentsInput = z.infer<typeof bulkImportMedicamentsSchema>
export type AplicarTractamentInput = z.infer<typeof aplicarTractamentSchema>
export type ActualitzarTractamentInput = z.infer<typeof actualitzarTractamentSchema>
export type EliminarTractamentInput = z.infer<typeof eliminarTractamentSchema>
