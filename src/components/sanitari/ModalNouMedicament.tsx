'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'

type ModalNouMedicamentProps = {
  onTancar: () => void
  onDesat: () => void
}

/**
 * Modal de creació d'un medicament nou al catàleg (dades mestres —
 * nom, principi actiu, posologia, dies de supressió).
 *
 * @param props.onTancar - Callback per tancar sense desar
 * @param props.onDesat - Callback en confirmar amb èxit
 * @returns Modal amb el formulari de dades mestres del medicament
 *
 * @remarks Reescrit (juliol 2026, migració
 * 10_migracio_cataleg_medicaments.sql): abans aquest modal creava
 * alhora el catàleg i una entrada d'estoc (lot/quantitat/preu). Ara
 * només crea l'entrada de catàleg — l'estoc es dona d'alta per
 * separat amb ModalAfegirEntradaMedicament, seleccionant aquest
 * medicament del catàleg.
 * @remarks Control d'accés: només es munta des de la pàgina de
 * Sanitari quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalNouMedicament({ onTancar, onDesat }: ModalNouMedicamentProps) {
  const queryClient = useQueryClient()
  const [nomMedicament, setNomMedicament] = useState('')
  const [principiActiu, setPrincipiActiu] = useState('')
  const [posologiaStandard, setPosologiaStandard] = useState('')
  const [diesSupressio, setDiesSupressio] = useState('')

  const potConfirmar = nomMedicament.trim() && principiActiu.trim() && diesSupressio.trim()

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sanitari/medicaments-cataleg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomMedicament: nomMedicament.trim(),
          principiActiu: principiActiu.trim(),
          posologiaStandard: posologiaStandard.trim() || undefined,
          diesSupressio: Number(diesSupressio),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en crear el medicament')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.medicamentsCataleg })
      toastExit('Medicament creat al catàleg')
      onDesat()
    },
    onError: (err) => toastError(err, 'Error en crear el medicament'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Crear medicament"
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol="Nou medicament" onTancar={onTancar} peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (potConfirmar) mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom del medicament *</label>
          <input
            type="text"
            value={nomMedicament}
            onChange={(e) => setNomMedicament(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Principi actiu *</label>
          <input
            type="text"
            value={principiActiu}
            onChange={(e) => setPrincipiActiu(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Posologia estàndard</label>
          <textarea
            value={posologiaStandard}
            onChange={(e) => setPosologiaStandard(e.target.value)}
            placeholder="Opcional"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dies de supressió *</label>
          <input
            type="number"
            min="0"
            value={diesSupressio}
            onChange={(e) => setDiesSupressio(e.target.value)}
            required
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
