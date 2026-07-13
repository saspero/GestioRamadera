'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { Cort } from '@/types/infraestructura'

type ModalCortProps = {
  /** Zona on es crearà la cort (obligatori en mode creació; ha de ser NAU_ANIMALS). */
  zonaId: number
  /** Si s'informa, el modal edita aquesta cort; si no, en crea una de nova. */
  cortExistent?: Cort
  onTancar: () => void
  onSalvat: () => void
}

/**
 * Modal de creació/edició d'una Cort dins d'una Zona de tipus NAU_ANIMALS.
 *
 * @param props.zonaId - Zona on es crearà la cort
 * @param props.cortExistent - Si es passa, el formulari s'omple amb
 * les seves dades i actua en mode edició
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onSalvat - Callback en confirmar amb èxit
 * @returns Modal amb formulari de codi i capacitat màxima
 *
 * @remarks MIGRACIÓ REACT QUERY: useMutation pròpia (POST si és nova,
 * PATCH si `cortExistent`), invalida queryKeys.infraestructura.all.
 * Si l'endpoint retorna 422 (zona no és NAU_ANIMALS), el missatge
 * es mostra tal qual, igual que abans.
 * @remarks Control d'accés: aquest component només es munta des de
 * la pàgina de Granja/Corts quan rol === 'Admin' || 'Veterinari', i
 * només s'obre des d'una zona ja filtrada com a NAU_ANIMALS.
 */
export function ModalCort({ zonaId, cortExistent, onTancar, onSalvat }: ModalCortProps) {
  const queryClient = useQueryClient()
  const [codiCort, setCodiCort] = useState(cortExistent?.codiCort ?? '')
  const [capacitat, setCapacitat] = useState(
    cortExistent?.capacitatMaxima != null ? String(cortExistent.capacitatMaxima) : ''
  )

  const mutacio = useMutation({
    mutationFn: async () => {
      const body = {
        codiCort: codiCort.trim(),
        capacitatMaxima: capacitat.trim() ? Number(capacitat) : undefined,
      }
      const url = cortExistent
        ? `/api/infraestructura/corts/${cortExistent.id}`
        : '/api/infraestructura/corts'
      const res = await fetch(url, {
        method: cortExistent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cortExistent ? body : { zonaId, ...body }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar la cort')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.infraestructura.all })
      toastExit(cortExistent ? 'Cort actualitzada' : 'Cort creada correctament')
      onSalvat()
    },
    onError: (err) => toastError(err, 'Error en desar la cort'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Desar"
      enviant={mutacio.isPending}
      disabled={!codiCort.trim()}
    />
  )

  return (
    <Modal titol={cortExistent ? 'Editar cort' : 'Nova cort'} onTancar={onTancar} mida="sm" peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (codiCort.trim()) mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Codi de la cort *</label>
          <input
            type="text"
            value={codiCort}
            onChange={(e) => setCodiCort(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Capacitat màxima</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={capacitat}
            onChange={(e) => setCapacitat(e.target.value)}
            placeholder="Nombre d'animals (opcional)"
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
