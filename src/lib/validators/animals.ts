import { z } from 'zod'

export const crearAnimalSchema = z.object({
  crotalId:      z.string().min(1).max(20),
  dib:           z.string().max(50).optional(),
  racaId:        z.number().int().positive().optional(),
  dataNaixement: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-DD').optional(),
  sexe:          z.enum(['Mascle', 'Femella']).optional(),
})

export const actualitzarPesSchema = z.object({
  animalId: z.number().int().positive(),
  data:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pesKg:    z.number().positive().max(2000),
})

/**
 * Validació d'una fila individual del CSV d'alta massiva.
 *
 * @remarks No inclou racaId, lotId ni cortId: aquests s'assignen
 * globalment a tot el bloc importat en un segon pas (docs/08_modul_llistat_actius.md,
 * secció 4.2 — "no s'especifiquen per fila").
 */
export const filaAltaMassivaSchema = z.object({
  crotal_id: z.string().trim().min(1, 'Crotal obligatori').max(20, 'Crotal massa llarg'),
  dib: z.string().trim().max(50).optional().or(z.literal('')),
  data_naixement: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-DD')
    .optional()
    .or(z.literal('')),
  sexe: z.enum(['Mascle', 'Femella']).optional().or(z.literal('')),
})

/**
 * Assignació base aplicada a tot el bloc d'animals importats
 * (pas 2 del flux d'altes massives).
 */
export const assignacioBaseSchema = z.object({
  racaId: z.number().int().positive({ message: 'Cal seleccionar una raça' }),
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
