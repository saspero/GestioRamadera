import { z } from 'zod'

export const crearUbicacioSchema = z.object({
  nom: z.string().trim().min(1, 'El nom és obligatori').max(255, 'Nom massa llarg'),
  codiPasturaExtensiu: z.string().trim().max(50).optional().or(z.literal('')),
})

export const actualitzarUbicacioSchema = crearUbicacioSchema

export const crearZonaSchema = z.object({
  ubicacioId: z.number().int().positive({ message: 'Cal seleccionar una granja' }),
  nom: z.string().trim().min(1, 'El nom és obligatori').max(255, 'Nom massa llarg'),
  tipusZona: z.enum(['NAU_ANIMALS', 'COBERT_EMMAGATZEMATGE', 'PASTURA'], {
    errorMap: () => ({ message: 'Cal seleccionar un tipus de zona vàlid' }),
  }),
})

export const actualitzarZonaSchema = z.object({
  nom: z.string().trim().min(1, 'El nom és obligatori').max(255, 'Nom massa llarg'),
})

export const crearCortSchema = z.object({
  zonaId: z.number().int().positive({ message: 'Cal seleccionar una zona' }),
  codiCort: z.string().trim().min(1, 'El codi és obligatori').max(50, 'Codi massa llarg'),
  capacitatMaxima: z.number().int().positive().optional(),
})

export const actualitzarCortSchema = z.object({
  codiCort: z.string().trim().min(1, 'El codi és obligatori').max(50, 'Codi massa llarg'),
  capacitatMaxima: z.number().int().positive().optional(),
})

export type CrearUbicacioInput = z.infer<typeof crearUbicacioSchema>
export type CrearZonaInput = z.infer<typeof crearZonaSchema>
export type CrearCortInput = z.infer<typeof crearCortSchema>
