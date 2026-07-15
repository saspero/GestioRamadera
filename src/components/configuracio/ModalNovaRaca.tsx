'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'

type ModalNovaRacaProps = {
  onTancar: () => void
  onCreada: () => void
}

/**
 * Modal de creació d'una raça personalitzada per al catàleg.
 *
 * @param props.onTancar - Callback per tancar sense desar
 * @param props.onCreada - Callback en confirmar amb èxit
 * @returns Modal amb un únic camp de nom
 *
 * @remarks Les races creades des d'aquí sempre tenen `esGlobal =
 * false` — les races globals ja venen precarregades i no es creen
 * des de la interfície.
 * @remarks Control d'accés: Admin únicament.
 */
export function ModalNovaRaca({ onTancar, onCreada }: ModalNovaRacaProps) {
  const queryClient = useQueryClient()
  const [nomRaca, setNomRaca] = useState('')

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/configuracio/races', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomRaca: nomRaca.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en crear la raça')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracio.races })
      toastExit('Raça creada correctament')
      onCreada()
    },
    onError: (err) => toastError(err, 'Error en crear la raça'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Crear raça"
      enviant={mutacio.isPending}
      disabled={!nomRaca.trim()}
    />
  )

  return (
    <Modal titol="Nova raça" onTancar={onTancar} mida="sm" peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (nomRaca.trim()) mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la raça *</label>
          <input
            type="text"
            value={nomRaca}
            onChange={(e) => setNomRaca(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        {mutacio.isError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
          </p>
        )}
      </form>
    </Modal>
  )
}
