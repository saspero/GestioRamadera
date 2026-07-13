'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { MoureAnimalsInput } from '@/types/lots'

/**
 * Hook que gestiona l'enviament d'una petició de moviment d'animals
 * entre lots. Compartit entre la pantalla de Lots (moure des del
 * detall d'un lot) i la pantalla d'Animals (selecció múltiple a la
 * taula).
 *
 * @returns Estat de la mutació i la funció per confirmar el moviment
 *
 * @remarks MIGRACIÓ REACT QUERY: useMutation en comptes d'estat
 * manual. Invalida queryKeys.animals.all (canvien de lot/cort) i
 * queryKeys.lots.all (canvia el recompte d'ambdós lots implicats)
 * en tenir èxit — les pàgines de Lots i Animals es refresquen soles,
 * sense necessitat que cap component pare cridi res explícitament.
 * @remarks Control d'accés: aquest hook no fa cap comprovació de rol.
 * L'endpoint POST /api/lots/moure torna a validar el rol igualment.
 */
export function useMoureAnimals() {
  const queryClient = useQueryClient()

  const mutacio = useMutation({
    mutationFn: async (params: MoureAnimalsInput) => {
      const res = await fetch('/api/lots/moure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en moure els animals')
      return json as { nombreMoguts: number }
    },
    onSuccess: (resultat) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.animals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all })
      toastExit(
        resultat.nombreMoguts === 1
          ? '1 animal mogut correctament'
          : `${resultat.nombreMoguts} animals moguts correctament`
      )
    },
    onError: (err) => toastError(err, 'Error en moure els animals'),
  })

  return {
    estat: mutacio.isPending ? 'enviant' : mutacio.isSuccess ? 'completat' : mutacio.isError ? 'error' : 'idle',
    errorMsg: mutacio.error instanceof Error ? mutacio.error.message : null,
    moureAnimals: mutacio.mutateAsync,
    reiniciar: mutacio.reset,
  }
}
