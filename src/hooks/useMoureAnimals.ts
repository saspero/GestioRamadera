'use client'

import { useState, useCallback } from 'react'
import type { MoureAnimalsInput } from '@/types/lots'

type EstatMoviment = 'idle' | 'enviant' | 'completat' | 'error'

/**
 * Hook que gestiona l'enviament d'una petició de moviment d'animals
 * entre lots. Compartit entre la pantalla de Lots (moure des del
 * detall d'un lot) i la pantalla d'Animals (selecció múltiple a la
 * taula).
 *
 * @returns Estat de l'enviament i la funció per confirmar el moviment
 *
 * @remarks Control d'accés: aquest hook no fa cap comprovació de rol
 * — assumeix que només es munta des de components ja protegits per
 * a Admin/Veterinari. L'endpoint POST /api/lots/moure torna a validar
 * el rol igualment.
 */
export function useMoureAnimals() {
  const [estat, setEstat] = useState<EstatMoviment>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const moureAnimals = useCallback(async (params: MoureAnimalsInput) => {
    setEstat('enviant')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/lots/moure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en moure els animals')
      setEstat('completat')
      return json as { nombreMoguts: number }
    } catch (err) {
      const missatge = err instanceof Error ? err.message : 'Error desconegut'
      setErrorMsg(missatge)
      setEstat('error')
      throw err
    }
  }, [])

  const reiniciar = useCallback(() => {
    setEstat('idle')
    setErrorMsg(null)
  }, [])

  return { estat, errorMsg, moureAnimals, reiniciar }
}
