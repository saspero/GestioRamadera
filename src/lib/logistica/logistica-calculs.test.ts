import { describe, it, expect } from 'vitest'
import {
  calcularQuantitatEnTones,
  calcularPesEquivalentBales,
  resoldreLlindarAlerta,
  calcularEstatAlerta,
} from '@/lib/logistica/logistica-calculs'

/**
 * Tests de la lògica de negoci crítica del mòdul Logística
 * (docs/09_modul_logistica_farratges.md).
 *
 * @remarks Aquestes funcions es van extreure de
 * src/lib/db/queries/logistica.ts com a funcions pures precisament
 * per poder-les testejar sense connexió a base de dades — la
 * conversió de bales i el càlcul d'alertes són els punts on un error
 * silenciós tindria més impacte real (estoc incorrecte, alertes que
 * no salten).
 */
describe('calcularQuantitatEnTones', () => {
  it('converteix kg a tones dividint per 1000', () => {
    expect(calcularQuantitatEnTones(500, 'kg', null)).toBe(0.5)
  })

  it('retorna el mateix valor quan la unitat ja és Tones', () => {
    expect(calcularQuantitatEnTones(2.5, 'Tones', null)).toBe(2.5)
  })

  it('converteix bales a tones fent servir el pes mitjà per bala', () => {
    // 2 bales de 350 kg cada una = 700 kg = 0.7 tones
    expect(calcularQuantitatEnTones(2, 'Unitats', 350)).toBe(0.7)
  })

  it('llença un error si la unitat és Unitats però no hi ha pes mitjà configurat', () => {
    expect(() => calcularQuantitatEnTones(2, 'Unitats', null)).toThrow(
      'pes mitjà per bala'
    )
  })
})

describe('calcularPesEquivalentBales', () => {
  it('multiplica el nombre de bales pel pes mitjà', () => {
    expect(calcularPesEquivalentBales(2, 350)).toBe(700)
  })

  it('retorna 0 si el nombre de bales és 0', () => {
    expect(calcularPesEquivalentBales(0, 350)).toBe(0)
  })
})

describe('resoldreLlindarAlerta', () => {
  it('fa servir el llindar específic quan existeix', () => {
    expect(resoldreLlindarAlerta(1, 5)).toBe(1)
  })

  it('fa servir el llindar global quan no hi ha llindar específic', () => {
    expect(resoldreLlindarAlerta(null, 5)).toBe(5)
  })

  it('respecta un llindar específic de 0 (no el confon amb "no configurat")', () => {
    expect(resoldreLlindarAlerta(0, 5)).toBe(0)
  })
})

describe('calcularEstatAlerta', () => {
  it('retorna ESGOTAT quan l\'estoc és exactament 0', () => {
    expect(calcularEstatAlerta(0, 5)).toBe('ESGOTAT')
  })

  it('retorna BAIX quan l\'estoc és igual al llindar', () => {
    expect(calcularEstatAlerta(5, 5)).toBe('BAIX')
  })

  it('retorna BAIX quan l\'estoc és menor que el llindar', () => {
    expect(calcularEstatAlerta(3, 5)).toBe('BAIX')
  })

  it('retorna NORMAL quan l\'estoc supera el llindar', () => {
    expect(calcularEstatAlerta(10, 5)).toBe('NORMAL')
  })
})
