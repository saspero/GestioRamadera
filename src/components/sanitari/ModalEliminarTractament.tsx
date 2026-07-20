'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { TractamentAmbMedicament, MotiuEliminacioTractament } from '@/types/sanitari'

type ModalEliminarTractamentProps = {
  tractament: TractamentAmbMedicament
  onTancar: () => void
  onEliminat: () => void
}

const MOTIUS: MotiuEliminacioTractament[] = [
  'Error d\'entrada',
  'Duplicat',
  'Dosi incorrecta',
  'Medicament incorrecte',
  'Altres',
]

/**
 * Modal d'eliminació d'un tractament, amb motiu obligatori.
 *
 * @param props.tractament - Tractament a eliminar
 * @param props.onTancar - Callback per tancar sense confirmar
 * @param props.onEliminat - Callback en confirmar amb èxit
 * @returns Modal amb desplegable de motiu (+ text lliure si "Altres")
 *
 * @remarks ELIMINACIÓ REAL (decisió confirmada amb l'usuari): si
 * l'animal encara estava en període de supressió per aquest
 * tractament, el bloqueig comercial s'aixeca a l'instant. Es mostra
 * un avís clar quan aplica.
 * @remarks Una còpia del tractament queda desada al log
 * d'eliminacions abans d'esborrar-lo (backend, no aquí).
 * @remarks Control d'accés: només es munta des de la pàgina de
 * Sanitari quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalEliminarTractament({ tractament, onTancar, onEliminat }: ModalEliminarTractamentProps) {
  const queryClient = useQueryClient()
  const [motiu, setMotiu] = useState<MotiuEliminacioTractament | ''>('')
  const [motiuAltres, setMotiuAltres] = useState('')

  const avui = new Date().toISOString().slice(0, 10)
  const encaraEnSupressio = tractament.dataAlliberament !== null && tractament.dataAlliberament > avui

  const potConfirmar = motiu !== '' && (motiu !== 'Altres' || motiuAltres.trim().length > 0)

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sanitari/tractaments/${tractament.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motiu, motiuAltres: motiuAltres.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en eliminar el tractament')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.tractaments })
      queryClient.invalidateQueries({ queryKey: queryKeys.animals.all })
      toastExit('Tractament eliminat')
      onEliminat()
    },
    onError: (err) => toastError(err, 'Error en eliminar el tractament'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Eliminar tractament"
      textEnviant="Eliminant..."
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
      variant="perill"
    />
  )

  return (
    <Modal titol={`Eliminar tractament — ${tractament.animalDib}`} onTancar={onTancar} mida="sm" peu={peu}>
      <div className="space-y-4">
        <div className="text-sm bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-gray-700">{tractament.nomMedicament} — {tractament.dataInici}</p>
        </div>

        {encaraEnSupressio && (
          <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2">
            Aquest animal encara està en període de supressió per aquest
            tractament (fins al {tractament.dataAlliberament}). En eliminar-lo,
            el bloqueig comercial s&apos;aixecarà immediatament.
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motiu *</label>
          <select
            value={motiu}
            onChange={(e) => setMotiu(e.target.value as MotiuEliminacioTractament)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          >
            <option value="">Selecciona un motiu</option>
            {MOTIUS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {motiu === 'Altres' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Especifica el motiu *</label>
            <textarea
              value={motiuAltres}
              onChange={(e) => setMotiuAltres(e.target.value)}
              rows={2}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
        )}

        {mutacio.isError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
          </p>
        )}
      </div>
    </Modal>
  )
}
