import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .email('Format d\'email incorrecte')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'La contrasenya és obligatòria')
    .max(128, 'Contrasenya massa llarga'),
})

export type LoginInput = z.infer<typeof loginSchema>
