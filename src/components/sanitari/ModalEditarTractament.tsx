'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { TractamentAmbMedicament } from '@/types/sanitari'

type ModalEditarTractamentProps = {
  tractament: TractamentAmbMedicament
  onTancar: () => void
  onDesat: () => void
}

/**
 * Modal d'edició d'un tractament ja aplicat.
 *
 * @param props.tractament - Tractament a editar
 * @param props.onTancar - Callback per tancar sense desar
 * @param props.onDesat - Callback en confirmar amb èxit
 * @returns Modal amb dosi aplicada, data de fi prevista i notes
 *
 * @remarks NOMÉS aquests tres camps són editables (decisió confirmada
 * amb l'usuari) — l'animal, el medicament i la data d'inici es
 * mostren de només lectura, sense cap camp per canviar-los.
 * @remarks Editar la dosi NO ajusta retroactivament l'estoc del
 * medicament ja descomptat en aplicar el tractament.
 * @remarks Control d'accés: només es munta des de la pàgina de
 * Sanitari quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalEditarTractament({ tractament, onTancar, onDesat }: ModalEditarTractamentProps) {
  const queryClient = useQueryClient()
  const [dosiAplicada, setDosiAplicada] = useState(
    tractament.dosiAplicada !== null ? String(tractament.dosiAplicada) : ''
  )
  const [dataFiPrevista, setDataFiPrevista] = useState(tractament.dataFiPrevista ?? '')
  const [notes, setNotes] = useState(tractament.notes ?? '')

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sanitari/tractaments/${tractament.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dosiAplicada: dosiAplicada.trim() ? Number(dosiAplicada) : undefined,
          dataFiPrevista: dataFiPrevista.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar el tractament')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.tractaments })
      toastExit('Tractament actualitzat')
      onDesat()
    },
    onError: (err) => toastError(err, 'Error en desar el tractament'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Desar"
      enviant={mutacio.isPending}
    />
  )

  return (
    <Modal titol={`Editar tractament — ${tractament.animalDib}`} onTancar={onTancar} peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
          <div>
            <p className="text-xs text-gray-400">Medicament</p>
            <p className="text-gray-700">{tractament.nomMedicament}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Data d&apos;inici</p>
            <p className="text-gray-700">{tractament.dataInici}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dosi aplicada</label>
          <input
            type="number"
            step="0.001"
            value={dosiAplicada}
            onChange={(e) => setDosiAplicada(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data de fi prevista</label>
          <input
            type="date"
            value={dataFiPrevista}
            onChange={(e) => setDataFiPrevista(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
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
