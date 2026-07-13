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
 * Modal de creació manual d'un medicament (fora del flux CSV).
 *
 * @param props.onTancar - Callback per tancar sense desar
 * @param props.onDesat - Callback en confirmar amb èxit
 * @returns Modal amb el formulari complet de la fitxa del medicament
 *
 * @remarks MIGRACIÓ REACT QUERY: useMutation pròpia, invalida
 * queryKeys.sanitari.medicaments en tenir èxit.
 * @remarks Camps segons docs/06_modul_sanitari.md, secció 2.1.
 * @remarks Control d'accés: només es munta des de la pàgina de
 * Sanitari quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalNouMedicament({ onTancar, onDesat }: ModalNouMedicamentProps) {
  const queryClient = useQueryClient()
  const [nomMedicament, setNomMedicament] = useState('')
  const [principiActiu, setPrincipiActiu] = useState('')
  const [lot, setLot] = useState('')
  const [quantitatEstoc, setQuantitatEstoc] = useState('')
  const [unitatEstoc, setUnitatEstoc] = useState('ml')
  const [posologiaStandard, setPosologiaStandard] = useState('')
  const [preuCompra, setPreuCompra] = useState('')
  const [diesSupressio, setDiesSupressio] = useState('')

  const potConfirmar =
    nomMedicament.trim() &&
    principiActiu.trim() &&
    lot.trim() &&
    quantitatEstoc.trim() &&
    unitatEstoc.trim() &&
    preuCompra.trim() &&
    diesSupressio.trim()

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sanitari/medicaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomMedicament: nomMedicament.trim(),
          principiActiu: principiActiu.trim(),
          lot: lot.trim(),
          quantitatEstoc: Number(quantitatEstoc),
          unitatEstoc: unitatEstoc.trim(),
          posologiaStandard: posologiaStandard.trim() || undefined,
          preuCompra: Number(preuCompra),
          diesSupressio: Number(diesSupressio),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en crear el medicament')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.medicaments })
      toastExit('Medicament creat correctament')
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Lot *</label>
          <input
            type="text"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantitat *</label>
            <input
              type="number"
              step="0.001"
              value={quantitatEstoc}
              onChange={(e) => setQuantitatEstoc(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unitat *</label>
            <input
              type="text"
              value={unitatEstoc}
              onChange={(e) => setUnitatEstoc(e.target.value)}
              placeholder="ml, g, unitats..."
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preu de compra (€) *</label>
            <input
              type="number"
              step="0.01"
              value={preuCompra}
              onChange={(e) => setPreuCompra(e.target.value)}
              required
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
