'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { ConfiguracioGeneral } from '@/types/configuracio'

/**
 * Formulari inline (no modal) de la Configuració General del tenant:
 * llindars d'estoc per defecte en kg i tones.
 *
 * @returns Targeta amb els dos camps i un botó de desar
 *
 * @remarks Es fa servir un formulari inline en comptes d'un modal
 * perquè és una única fitxa de configuració que no té sentit "obrir
 * i tancar" — l'usuari hi arriba directament des de la pestanya.
 * @remarks Aquests valors s'apliquen com a fallback a qualsevol
 * sitja/magatzem que no tingui un llindar específic propi
 * (docs/09_modul_logistica_farratges.md, secció 3.1).
 * @remarks Control d'accés: es munta des de la pàgina de
 * Configuració, ja protegida per a Admin.
 */
export function FormConfiguracioGeneral() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<ConfiguracioGeneral>({
    queryKey: queryKeys.configuracio.general,
    queryFn: () => fetch('/api/configuracio/general').then((res) => res.json()),
  })

  const [estocMinimDefaultKg, setEstocMinimDefaultKg] = useState('')
  const [estocMinimDefaultTones, setEstocMinimDefaultTones] = useState('')

  useEffect(() => {
    if (data) {
      setEstocMinimDefaultKg(String(data.estocMinimDefaultKg))
      setEstocMinimDefaultTones(String(data.estocMinimDefaultTones))
    }
  }, [data])

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/configuracio/general', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estocMinimDefaultKg: Number(estocMinimDefaultKg),
          estocMinimDefaultTones: Number(estocMinimDefaultTones),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar la configuració')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracio.general })
      toastExit('Configuració desada correctament')
    },
    onError: (err) => toastError(err, 'Error en desar la configuració'),
  })

  if (isLoading) {
    return <p className="text-gray-500 text-center py-10">Carregant...</p>
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 max-w-md">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Llindars d&apos;estoc per defecte</h3>
      <p className="text-xs text-gray-400 mb-4">
        S&apos;apliquen a qualsevol sitja o magatzem que no tingui un llindar propi configurat.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Llindar per defecte de sitges (kg)
          </label>
          <input
            type="number"
            step="0.01"
            value={estocMinimDefaultKg}
            onChange={(e) => setEstocMinimDefaultKg(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Llindar per defecte de magatzems de farratge (tones)
          </label>
          <input
            type="number"
            step="0.001"
            value={estocMinimDefaultTones}
            onChange={(e) => setEstocMinimDefaultTones(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        {mutacio.isError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
          </p>
        )}

        <button
          type="submit"
          disabled={mutacio.isPending}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                     font-medium rounded-lg min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutacio.isPending ? 'Desant...' : 'Desar'}
        </button>
      </form>
    </div>
  )
}
