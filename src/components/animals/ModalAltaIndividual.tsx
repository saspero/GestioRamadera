'use client'

import { useState } from 'react'
import { CircleCheckBig } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'

type Catalegs = {
  races: { id: number; nomRaca: string }[]
  lots: { id: number; nomLot: string }[]
  corts: { id: number; codiCort: string; nomZona: string }[]
}

type ModalAltaIndividualProps = {
  onTancar: () => void
  onAltaCompletada: () => void
}

/**
 * Modal d'alta individual d'un animal, amb formulari directe
 * (DIB, raça, data de naixement, sexe, lot i cort).
 *
 * @param props.onTancar - Callback per tancar el modal sense confirmar
 * @param props.onAltaCompletada - Callback en confirmar amb èxit
 * @returns Modal amb el formulari d'alta individual
 *
 * @remarks MIGRACIÓ REACT QUERY: catàlegs (races/lots/corts) via
 * useQuery — es comparteix cache amb ModalAltaMassiva i
 * ModalMoureAnimals, que criden el mateix endpoint. L'alta en si és
 * una useMutation que invalida queryKeys.animals.all i
 * queryKeys.lots.all (el lot pot canviar de recompte) en tenir èxit.
 * @remarks Control d'accés: es munta des de la pàgina d'animals quan
 * rol === 'Admin' || 'Veterinari'. L'endpoint torna a validar el rol.
 */
export function ModalAltaIndividual({ onTancar, onAltaCompletada }: ModalAltaIndividualProps) {
  const queryClient = useQueryClient()

  const { data: catalegs } = useQuery<Catalegs>({
    queryKey: queryKeys.animals.catalegs,
    queryFn: () => fetch('/api/animals/catalegs').then((res) => res.json()),
  })

  const [dib, setDib] = useState('')
  const [racaId, setRacaId] = useState<number | ''>('')
  const [dataNaixement, setDataNaixement] = useState('')
  const [sexe, setSexe] = useState<'' | 'Mascle' | 'Femella'>('')
  const [lotId, setLotId] = useState<number | ''>('')
  const [cortId, setCortId] = useState<number | ''>('')

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/animals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dib: dib.trim(),
          racaId: racaId || undefined,
          dataNaixement: dataNaixement || undefined,
          sexe: sexe || undefined,
          lotId,
          cortId,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en donar d\'alta l\'animal')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.animals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all })
      toastExit('Animal donat d\'alta correctament')
    },
    onError: (err) => toastError(err, 'Error en donar d\'alta l\'animal'),
  })

  const potConfirmar = dib.trim().length > 0 && lotId !== '' && cortId !== ''

  const peu = mutacio.isSuccess ? (
    <button
      onClick={onAltaCompletada}
      className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                 font-medium rounded-lg min-h-[44px]"
    >
      Tancar i actualitzar llistat
    </button>
  ) : (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Donar d'alta"
      textEnviant="Desant..."
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol="Alta individual d'animal" onTancar={onTancar} peu={peu}>
      {mutacio.isSuccess ? (
        <div className="text-center py-8">
          <CircleCheckBig size={48} className="mx-auto text-green-600 mb-3" />
          <p className="text-lg font-semibold text-gray-900">Animal donat d&apos;alta correctament</p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (potConfirmar) mutacio.mutate()
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DIB *</label>
            <input
              type="text"
              value={dib}
              onChange={(e) => setDib(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
            <select
              value={racaId}
              onChange={(e) => setRacaId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            >
              <option value="">Sense especificar</option>
              {catalegs?.races.map((r) => (
                <option key={r.id} value={r.id}>{r.nomRaca}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de naixement</label>
            <input
              type="date"
              value={dataNaixement}
              onChange={(e) => setDataNaixement(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sexe</label>
            <select
              value={sexe}
              onChange={(e) => setSexe(e.target.value as typeof sexe)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            >
              <option value="">Sense especificar</option>
              <option value="Mascle">Mascle</option>
              <option value="Femella">Femella</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lot *</label>
            <select
              value={lotId}
              onChange={(e) => setLotId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            >
              <option value="">Selecciona un lot</option>
              {catalegs?.lots.map((l) => (
                <option key={l.id} value={l.id}>{l.nomLot}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cort / Nau *</label>
            <select
              value={cortId}
              onChange={(e) => setCortId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            >
              <option value="">Selecciona una cort</option>
              {catalegs?.corts.map((c) => (
                <option key={c.id} value={c.id}>{c.nomZona} — {c.codiCort}</option>
              ))}
            </select>
          </div>

          {mutacio.isError && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}
