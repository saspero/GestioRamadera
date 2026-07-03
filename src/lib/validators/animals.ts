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

export type CrearAnimalInput = z.infer<typeof crearAnimalSchema>
export type ActualitzarPesInput = z.infer<typeof actualitzarPesSchema>
