'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMoureAnimals } from '@/hooks/useMoureAnimals'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'

type LotOpcio = { id: number; nomLot: string }
type CortOpcio = { id: number; codiCort: string; nomZona: string }

type ModalMoureAnimalsProps = {
  animalIds: number[]
  lotOrigenId?: number
  onTancar: () => void
  onMogut: () => void
}

/**
 * Modal per moure un o més animals a un altre lot, amb cort de
 * destí opcional.
 *
 * @param props.animalIds - Animals seleccionats a moure
 * @param props.lotOrigenId - Lot actual, s'exclou del desplegable
 * @param props.onTancar - Callback per tancar el modal sense confirmar
 * @param props.onMogut - Callback en confirmar amb èxit
 * @returns Modal amb desplegables de lot destí i cort destí opcional
 *
 * @remarks MIGRACIÓ REACT QUERY: lots (queryKeys.lots.llistat) i
 * corts (queryKeys.animals.catalegs, compartit amb ModalAltaMassiva
 * i ModalAltaIndividual) es carreguen amb useQuery — si un altre
 * modal ja els ha demanat recentment, s'obtenen de cache sense una
 * nova petició. La invalidació de queryKeys.animals.all/lots.all en
 * confirmar el moviment ja la fa useMoureAnimals() internament.
 * @remarks Component compartit: es munta tant des de
 * src/app/(app)/lots/page.tsx com des de
 * src/components/animals/TaulaAnimals.tsx.
 * @remarks Control d'accés: només es munta des de components ja
 * protegits per a Admin/Veterinari. L'endpoint torna a validar el rol.
 */
export function ModalMoureAnimals({
  animalIds,
  lotOrigenId,
  onTancar,
  onMogut,
}: ModalMoureAnimalsProps) {
  const { estat, errorMsg, moureAnimals } = useMoureAnimals()

  const { data: lots = [] } = useQuery<LotOpcio[]>({
    queryKey: queryKeys.lots.llistat,
    queryFn: () => fetch('/api/lots').then((res) => res.json()).then((json) => json.lots ?? []),
  })
  const { data: corts = [] } = useQuery<CortOpcio[]>({
    queryKey: queryKeys.animals.catalegs,
    queryFn: () => fetch('/api/animals/catalegs').then((res) => res.json()).then((json) => json.corts ?? []),
  })

  const [lotDestiId, setLotDestiId] = useState<number | ''>('')
  const [canviarCort, setCanviarCort] = useState(false)
  const [cortDestiId, setCortDestiId] = useState<number | ''>('')

  const lotsDisponibles = lots.filter((l) => l.id !== lotOrigenId)
  const potConfirmar = lotDestiId !== '' && (!canviarCort || cortDestiId !== '')

  async function handleConfirmar() {
    if (lotDestiId === '') return
    try {
      await moureAnimals({
        animalIds,
        lotDestiId: Number(lotDestiId),
        cortDestiId: canviarCort && cortDestiId !== '' ? Number(cortDestiId) : undefined,
      })
      onMogut()
    } catch {
      // L'error ja queda reflectit a errorMsg del hook i al toast
    }
  }

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={handleConfirmar}
      textConfirmar="Confirmar moviment"
      textEnviant="Movent..."
      enviant={estat === 'enviant'}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal
      titol={`Moure ${animalIds.length === 1 ? '1 animal' : `${animalIds.length} animals`}`}
      onTancar={onTancar}
      mida="sm"
      peu={peu}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lot de destí *</label>
          <select
            value={lotDestiId}
            onChange={(e) => setLotDestiId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={estat === 'enviant'}
          >
            <option value="">Selecciona un lot</option>
            {lotsDisponibles.map((l) => (
              <option key={l.id} value={l.id}>{l.nomLot}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={canviarCort}
            onChange={(e) => setCanviarCort(e.target.checked)}
            disabled={estat === 'enviant'}
          />
          Canviar també la cort de destí
        </label>

        {canviarCort && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cort de destí *</label>
            <select
              value={cortDestiId}
              onChange={(e) => setCortDestiId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={estat === 'enviant'}
            >
              <option value="">Selecciona una cort</option>
              {corts.map((c) => (
                <option key={c.id} value={c.id}>{c.nomZona} — {c.codiCort}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Si no en selecciones cap, cada animal mantindrà la seva cort actual.
            </p>
          </div>
        )}

        {errorMsg && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {errorMsg}
          </p>
        )}
      </div>
    </Modal>
  )
}
