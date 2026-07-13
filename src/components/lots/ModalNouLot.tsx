'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'

type ModalNouLotProps = {
  onTancar: () => void
  onCreat: () => void
}

/**
 * Modal de creació d'un lot nou.
 *
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onCreat - Callback en confirmar amb èxit
 * @returns Modal amb un únic camp de text
 *
 * @remarks MIGRACIÓ REACT QUERY: abans rebia `onDesar` com a prop
 * (la crida fetch vivia a la pàgina pare); ara fa la seva pròpia
 * useMutation i invalida queryKeys.lots.all directament, seguint el
 * mateix patró que la resta de modals migrats. La pàgina de Lots ja
 * no necessita gestionar aquesta lògica.
 * @remarks Control d'accés: aquest component només es munta des de
 * la pàgina de Lots quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalNouLot({ onTancar, onCreat }: ModalNouLotProps) {
  const queryClient = useQueryClient()
  const [nom, setNom] = useState('')

  const mutacio = useMutation({
    mutationFn: async (nomLot: string) => {
      const res = await fetch('/api/lots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomLot }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en crear el lot')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all })
      toastExit('Lot creat correctament')
      onCreat()
    },
    onError: (err) => toastError(err, 'Error en crear el lot'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate(nom.trim())}
      textConfirmar="Crear lot"
      enviant={mutacio.isPending}
      disabled={!nom.trim()}
    />
  )

  return (
    <Modal titol="Nou lot" onTancar={onTancar} mida="sm" peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (nom.trim()) mutacio.mutate(nom.trim())
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom del lot *</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
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
