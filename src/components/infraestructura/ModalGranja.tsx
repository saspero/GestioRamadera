'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { Ubicacio } from '@/types/infraestructura'

type ModalGranjaProps = {
  /** Si s'informa, el modal edita aquesta granja; si no, en crea una de nova. */
  granjaExistent?: Ubicacio
  onTancar: () => void
  onSalvat: () => void
}

/**
 * Modal de creació/edició d'una Granja (ubicació).
 *
 * @param props.granjaExistent - Si es passa, el formulari s'omple amb
 * les seves dades i actua en mode edició
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onSalvat - Callback en confirmar amb èxit
 * @returns Modal amb formulari de nom i codi de pastura extensiu
 *
 * @remarks MIGRACIÓ REACT QUERY: abans rebia `onDesar` com a prop
 * (la mutació vivia a useInfraestructura); ara fa la seva pròpia
 * useMutation (POST si és nova, PATCH si `granjaExistent`) i
 * invalida queryKeys.infraestructura.all directament.
 * @remarks Control d'accés: aquest component només es munta des de
 * la pàgina de Granja/Corts quan rol === 'Admin' || 'Veterinari'.
 * L'endpoint torna a validar el rol igualment.
 */
export function ModalGranja({ granjaExistent, onTancar, onSalvat }: ModalGranjaProps) {
  const queryClient = useQueryClient()
  const [nom, setNom] = useState(granjaExistent?.nom ?? '')
  const [codiPastura, setCodiPastura] = useState(granjaExistent?.codiPasturaExtensiu ?? '')

  const mutacio = useMutation({
    mutationFn: async () => {
      const body = { nom: nom.trim(), codiPasturaExtensiu: codiPastura.trim() || undefined }
      const url = granjaExistent
        ? `/api/infraestructura/${granjaExistent.id}`
        : '/api/infraestructura'
      const res = await fetch(url, {
        method: granjaExistent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar la granja')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.infraestructura.all })
      toastExit(granjaExistent ? 'Granja actualitzada' : 'Granja creada correctament')
      onSalvat()
    },
    onError: (err) => toastError(err, 'Error en desar la granja'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Desar"
      enviant={mutacio.isPending}
      disabled={!nom.trim()}
    />
  )

  return (
    <Modal titol={granjaExistent ? 'Editar granja' : 'Nova granja'} onTancar={onTancar} mida="sm" peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (nom.trim()) mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Codi de pastura extensiu
          </label>
          <input
            type="text"
            value={codiPastura}
            onChange={(e) => setCodiPastura(e.target.value)}
            placeholder="Opcional, només per a explotacions extensives"
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
