import { z } from 'zod'

/**
 * Camps de baixa per venda, segons docs/07_modul_arxiu_historic.md,
 * secció 3.1.
 */
export const baixaVendaSchema = z.object({
  motiu: z.literal('Venda'),
  dataBaixa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-DD'),
  pesViuKg: z.number().positive({ message: 'El pes en viu és obligatori' }),
  pesCanalKg: z.number().positive().optional(),
  preuKg: z.number().positive({ message: 'El preu per kg és obligatori' }),
  costTransport: z.number().nonnegative().optional(),
  compradorEscorxador: z.string().trim().max(255).optional().or(z.literal('')),
})

/**
 * Camps de baixa per mort, segons docs/07_modul_arxiu_historic.md,
 * secció 4.1. `causaMort` i `codiRecollidaCadavers` són obligatoris
 * (aquest últim necessari per a tràmits d'assegurança i DARP).
 */
export const baixaMortSchema = z.object({
  motiu: z.literal('Mort'),
  dataBaixa: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-DD'),
  causaMort: z.string().trim().min(1, 'La causa de la mort és obligatòria').max(255),
  codiRecollidaCadavers: z
    .string()
    .trim()
    .min(1, 'El codi de recollida de cadàvers és obligatori')
    .max(100),
})

export const registrarBaixaSchema = z.discriminatedUnion('motiu', [
  baixaVendaSchema,
  baixaMortSchema,
])

export type BaixaVendaInput = z.infer<typeof baixaVendaSchema>
export type BaixaMortInput = z.infer<typeof baixaMortSchema>
export type RegistrarBaixaInput = z.infer<typeof registrarBaixaSchema>
