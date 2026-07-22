import { z } from 'zod'

/**
 * @remarks `dib` és l'únic identificador de l'animal (veure
 * docs/08_modul_llistat_actius.md, secció 0 — el DIB i el crotal
 * físic a l'orella són la mateixa dada, no dos camps separats).
 */
export const crearAnimalSchema = z.object({
  dib:           z.string().trim().min(1, 'DIB obligatori').max(50, 'DIB massa llarg'),
  racaId:        z.number().int().positive({ message: 'Cal seleccionar una raça' }).optional(),
  dataNaixement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-DD').optional().or(z.literal('')),
  sexe:          z.enum(['Mascle', 'Femella']).optional().or(z.literal('')),
  lotId:         z.number().int().positive({ message: 'Cal seleccionar un lot' }),
  cortId:        z.number().int().positive({ message: 'Cal seleccionar una cort' }),
})

export const actualitzarPesSchema = z.object({
  animalId: z.number().int().positive(),
  data:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pesKg:    z.number().positive().max(2000),
})

/**
 * Validació d'una fila individual del CSV d'alta massiva.
 *
 * @remarks No inclou racaId ni cortId: aquests s'assignen globalment
 * a tot el bloc importat en un segon pas (docs/08_modul_llistat_actius.md,
 * secció 4.2). El camp `lot_nom` SÍ és opcional per fila: si s'indica,
 * substitueix el lot per defecte del pas 2 només per a aquest animal
 * (ampliació sobre el disseny original, per permetre repartir animals
 * en diversos lots dins d'una mateixa importació).
 */
export const filaAltaMassivaSchema = z.object({
  dib: z.string().trim().min(1, 'DIB obligatori').max(50, 'DIB massa llarg'),
  data_naixement: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-DD')
    .optional()
    .or(z.literal('')),
  sexe: z.enum(['Mascle', 'Femella']).optional().or(z.literal('')),
  lot_nom: z.string().trim().max(100).optional().or(z.literal('')),
})

/**
 * Assignació base aplicada a tot el bloc d'animals importats
 * (pas 2 del flux d'altes massives). Actua com a valor PER DEFECTE
 * per als animals que no indiquin `lot_nom` propi a la seva fila.
 *
 * @remarks `racaId` opcional des de juliol 2026 (decisió confirmada
 * amb l'usuari) — abans era obligatori a l'alta massiva, tot i que
 * ja era opcional a l'alta individual (crearAnimalSchema).
 */
export const assignacioBaseSchema = z.object({
  racaId: z.number().int().positive().optional(),
  lotId: z.number().int().positive().nullable(),
  lotNouNom: z.string().trim().min(1).max(100).nullable(),
  cortId: z.number().int().positive({ message: 'Cal seleccionar una cort' }),
}).refine(
  (data) => data.lotId !== null || (data.lotNouNom !== null && data.lotNouNom.length > 0),
  { message: 'Cal seleccionar un lot existent o indicar el nom d\'un lot nou' }
)

/**
 * Payload complet enviat a POST /api/animals/bulk-import: les files
 * ja validades individualment + l'assignació base del bloc.
 */
export const bulkImportSchema = z.object({
  animals: z.array(filaAltaMassivaSchema).min(1, 'Cal almenys un animal vàlid'),
  assignacio: assignacioBaseSchema,
})

export type CrearAnimalInput = z.infer<typeof crearAnimalSchema>
export type ActualitzarPesInput = z.infer<typeof actualitzarPesSchema>
export type FilaAltaMassiva = z.infer<typeof filaAltaMassivaSchema>
export type AssignacioBase = z.infer<typeof assignacioBaseSchema>
export type BulkImportInput = z.infer<typeof bulkImportSchema>
