import { describe, it, expect } from 'vitest'
import { formatNumber, formatDate } from '@/lib/format'

/**
 * Test de validació de les funcions de format (src/lib/format.ts).
 *
 * @remarks Aquest és el primer test del projecte — serveix també
 * per confirmar que la instal·lació de Vitest (resolució d'àlies
 * @/, entorn jsdom) funciona correctament de cap a cap.
 * @remarks Format numèric del projecte: separador decimal amb coma,
 * separador de milers amb punt (docs/README.md, "Convencions de la
 * Documentació") — aquests tests confirmen que formatNumber()
 * compleix aquesta convenció.
 */
describe('formatNumber', () => {
  it('formata un enter sense decimals', () => {
    expect(formatNumber(42)).toBe('42')
  })

  it('fa servir la coma com a separador decimal', () => {
    expect(formatNumber(3.5)).toBe('3,5')
  })

  it('fa servir el punt com a separador de milers', () => {
    expect(formatNumber(1234)).toBe('1.234')
  })

  it('combina separador de milers i decimal alhora', () => {
    expect(formatNumber(1234.56)).toBe('1.234,56')
  })

  it('gestiona el zero correctament', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatDate', () => {
  it('formata una data en format ISO (string) a format localitzat', () => {
    const resultat = formatDate('2026-07-15')
    // No assumim un format exacte de locale (pot variar per entorn),
    // però confirmem que els tres components de la data hi són presents.
    expect(resultat).toContain('2026')
    expect(resultat).toContain('7')
    expect(resultat).toContain('15')
  })

  it('accepta un objecte Date directament', () => {
    const resultat = formatDate(new Date('2026-01-01'))
    expect(resultat).toContain('2026')
  })
})
