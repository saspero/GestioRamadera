import { z } from 'zod'

export const crearUsuariSchema = z.object({
  nom: z.string().trim().min(1, 'El nom és obligatori').max(255),
  email: z.string().trim().email('Format d\'email no vàlid').max(255),
  password: z.string().min(8, 'La contrasenya ha de tenir almenys 8 caràcters').max(100),
  rol: z.enum(['Admin', 'Veterinari', 'Treballador']),
})

export const actualitzarUsuariSchema = z.object({
  nom: z.string().trim().min(1, 'El nom és obligatori').max(255),
  rol: z.enum(['Admin', 'Veterinari', 'Treballador']),
  actiu: z.boolean(),
})

export const canviarContrasenyaSchema = z.object({
  password: z.string().min(8, 'La contrasenya ha de tenir almenys 8 caràcters').max(100),
})

export const crearRacaSchema = z.object({
  nomRaca: z.string().trim().min(1, 'El nom és obligatori').max(100),
})

export const actualitzarConfiguracioGeneralSchema = z.object({
  estocMinimDefaultKg: z.number().nonnegative({ message: 'No pot ser negatiu' }),
  estocMinimDefaultTones: z.number().nonnegative({ message: 'No pot ser negatiu' }),
})

export type CrearUsuariInput = z.infer<typeof crearUsuariSchema>
export type ActualitzarUsuariInput = z.infer<typeof actualitzarUsuariSchema>
export type CanviarContrasenyaInput = z.infer<typeof canviarContrasenyaSchema>
export type CrearRacaInput = z.infer<typeof crearRacaSchema>
export type ActualitzarConfiguracioGeneralInput = z.infer<typeof actualitzarConfiguracioGeneralSchema>
