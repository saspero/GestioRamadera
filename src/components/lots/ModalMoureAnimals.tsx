'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useMoureAnimals } from '@/hooks/useMoureAnimals'

type LotOpcio = { id: number; nomLot: string }
type CortOpcio = { id: number; codiCort: string; nomZona: string }

type ModalMoureAnimalsProps = {
  /** Ids dels animals a moure. */
  animalIds: number[]
  /** Lot d'origen, exclòs del desplegable de destí (no té sentit moure al mateix lot). */
  lotOrigenId?: number
  onTancar: () => void
  onMogut: () => void
}

/**
 * Modal per moure un o més animals a un altre lot, amb cort de
 * destí opcional (si no s'especifica, cada animal manté la seva
 * cort actual).
 *
 * @param props.animalIds - Animals seleccionats a moure
 * @param props.lotOrigenId - Lot actual, s'exclou del desplegable
 * @param props.onTancar - Callback per tancar el modal sense confirmar
 * @param props.onMogut - Callback en confirmar amb èxit
 * @returns Modal amb desplegables de lot destí i cort destí opcional
 *
 * @remarks Component compartit: es munta tant des de
 * src/app/(app)/lots/page.tsx (moure des del detall d'un lot) com
 * des de src/components/animals/TaulaAnimals.tsx (selecció múltiple).
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
  const [lots, setLots] = useState<LotOpcio[]>([])
  const [corts, setCorts] = useState<CortOpcio[]>([])
  const [lotDestiId, setLotDestiId] = useState<number | ''>('')
  const [canviarCort, setCanviarCort] = useState(false)
  const [cortDestiId, setCortDestiId] = useState<number | ''>('')

  useEffect(() => {
    fetch('/api/lots')
      .then((res) => res.json())
      .then((json) => setLots(json.lots ?? []))
      .catch(() => setLots([]))

    fetch('/api/animals/catalegs')
      .then((res) => res.json())
      .then((json) => setCorts(json.corts ?? []))
      .catch(() => setCorts([]))
  }, [])

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
      // L'error ja queda reflectit a errorMsg del hook
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Moure {animalIds.length === 1 ? '1 animal' : `${animalIds.length} animals`}
          </h2>
          <button
            onClick={onTancar}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
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

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onTancar}
            className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 font-medium rounded-lg min-h-[44px]"
          >
            Cancel·lar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!potConfirmar || estat === 'enviant'}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                       font-medium rounded-lg min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {estat === 'enviant' ? 'Movent...' : 'Confirmar moviment'}
          </button>
        </div>
      </div>
    </div>
  )
}
