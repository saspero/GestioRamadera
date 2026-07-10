import { z } from 'zod'

export const crearLotSchema = z.object({
  nomLot: z.string().trim().min(1, 'El nom és obligatori').max(100, 'Nom massa llarg'),
})

export const moureAnimalsSchema = z.object({
  animalIds: z.array(z.number().int().positive()).min(1, 'Cal seleccionar almenys un animal'),
  lotDestiId: z.number().int().positive({ message: 'Cal seleccionar un lot de destí' }),
  cortDestiId: z.number().int().positive().optional(),
})

export type CrearLotInput = z.infer<typeof crearLotSchema>
export type MoureAnimalsInput = z.infer<typeof moureAnimalsSchema>
