import { z } from 'zod'

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

/**
 * Component (ingredient) d'un tipus de pinso. La suma dels
 * percentatges de tots els components d'un mateix tipus de pinso
 * s'hauria d'aproximar a 100, però no es bloqueja estrictament aquí
 * — es valida de manera informativa a la interfície, per permetre
 * desar composicions parcials mentre es completa la fitxa.
 */
export const componentPinsoSchema = z.object({
  nomComponent: z.string().trim().min(1, 'El nom del component és obligatori').max(255),
  percentatge: z.number().positive({ message: 'El percentatge ha de ser superior a 0' }).max(100),
})

export const crearTipusPinsoSchema = z.object({
  codi: z.string().trim().min(1, 'El codi és obligatori').max(50),
  nom: z.string().trim().min(1, 'El nom és obligatori').max(255),
  components: z.array(componentPinsoSchema).min(1, 'Cal indicar almenys un component'),
})

export const actualitzarTipusPinsoSchema = crearTipusPinsoSchema

export const crearSitjaSchema = z.object({
  nom: z.string().trim().min(1, 'El nom és obligatori').max(255),
  ubicacioId: z.number().int().positive({ message: 'Cal seleccionar una granja' }),
  tipusPinsoId: z.number().int().positive().optional(),
  capacitatKg: z.number().positive().optional(),
  estocActualKg: z.number().nonnegative({ message: 'L\'estoc no pot ser negatiu' }),
  estocMinimKg: z.number().nonnegative().optional(),
  zonaVinculadaId: z.number().int().positive().optional(),
})

export const actualitzarSitjaSchema = crearSitjaSchema.omit({ ubicacioId: true })

export const crearMagatzemSchema = z.object({
  zonaId: z.number().int().positive({ message: 'Cal seleccionar una zona' }),
  tipusFarratge: z.string().trim().min(1, 'El tipus de farratge és obligatori').max(100),
  capacitatMaximaTones: z.number().positive().optional(),
  estocActualTones: z.number().nonnegative({ message: 'L\'estoc no pot ser negatiu' }),
  estocMinimTones: z.number().nonnegative().optional(),
  pesMitjaBalaKg: z.number().positive().optional(),
  zonaVinculadaId: z.number().int().positive().optional(),
})

export const actualitzarMagatzemSchema = crearMagatzemSchema.omit({ zonaId: true })

/**
 * Repartiment manual d'una entrada d'estoc entre diversos silos o
 * magatzems del mateix tipus (Ex: un camió de 16 tones repartit
 * entre 3 sitges).
 */
export const registrarEntradaEstocSchema = z.object({
  tipus: z.enum(['sitja', 'magatzem']),
  repartiment: z
    .array(
      z.object({
        id: z.number().int().positive(),
        quantitat: z.number().positive({ message: 'La quantitat ha de ser superior a 0' }),
      })
    )
    .min(1, 'Cal repartir la quantitat en almenys un magatzem'),
  /** Només aplicable si tipus === 'sitja'. Opcional — si s'informa, s'aplica a totes les sitges del repartiment. */
  tipusPinsoId: z.number().int().positive().optional(),
})

export type RegistrarConsumInput = z.infer<typeof registrarConsumSchema>
export type CanviarEstatMagatzemInput = z.infer<typeof canviarEstatMagatzemSchema>
export type ComponentPinsoInput = z.infer<typeof componentPinsoSchema>
export type CrearTipusPinsoInput = z.infer<typeof crearTipusPinsoSchema>
export type CrearSitjaInput = z.infer<typeof crearSitjaSchema>
export type CrearMagatzemInput = z.infer<typeof crearMagatzemSchema>
export type RegistrarEntradaEstocInput = z.infer<typeof registrarEntradaEstocSchema>
