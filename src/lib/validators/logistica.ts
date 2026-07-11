import { z } from 'zod'

/**
 * Registre d'un consum massiu. `unitat` és lliure a nivell de schema
 * (kg/Tones/Unitats) — la restricció que les sitges només acceptin
 * 'kg' es valida a l'endpoint, no aquí, perquè depèn de l'origenTipus.
 */
export const registrarConsumSchema = z.object({
  origenTipus: z.enum(['sitja', 'magatzem']),
  origenId: z.number().int().positive({ message: 'Cal seleccionar un origen' }),
  zonaDestiId: z.number().int().positive({ message: 'Cal seleccionar un destí' }),
  quantitat: z.number().positive({ message: 'La quantitat ha de ser superior a 0' }),
  unitat: z.enum(['kg', 'Tones', 'Unitats']),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-DD'),
})

export const canviarEstatMagatzemSchema = z.object({
  tipus: z.enum(['sitja', 'magatzem']),
  estat: z.enum(['Actiu', 'Deshabilitat']),
})

export type RegistrarConsumInput = z.infer<typeof registrarConsumSchema>
export type CanviarEstatMagatzemInput = z.infer<typeof canviarEstatMagatzemSchema>
