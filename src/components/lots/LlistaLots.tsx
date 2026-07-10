'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ArrowRightLeft } from 'lucide-react'
import { formatDate } from '@/lib/format'
import type { LotResum, AnimalDelLot } from '@/types/lots'

type ListaLotsProps = {
  lots: LotResum[]
  potEditar: boolean
  /** Callback per obrir el modal de moviment amb un únic animal preseleccionat. */
  onMoureAnimal: (animalId: number, lotOrigenId: number) => void
}

/**
 * Llista de lots amb detall expandible: en clicar un lot, es
 * carreguen i mostren els seus animals actius.
 *
 * @param props.lots - Llistat de lots amb recompte, ja carregat
 * @param props.potEditar - Si false (rol Treballador), s'amaguen
 * les accions de moure animals
 * @param props.onMoureAnimal - Callback per obrir el modal de
 * moviment amb un animal concret preseleccionat
 * @returns Llista expansible amb el detall d'animals per lot
 *
 * @remarks Cada expansió fa una crida pròpia a
 * GET /api/lots/[id]/animals — no es precarrega tot d'un cop per
 * evitar sobrecarregar la pàgina amb tenants que tinguin molts lots.
 * @remarks Control d'accés: aquest component és de només presentació;
 * la protecció real és a l'endpoint de moviment.
 */
export function LlistaLots({ lots, potEditar, onMoureAnimal }: ListaLotsProps) {
  const [lotExpandit, setLotExpandit] = useState<number | null>(null)
  const [animalsPerLot, setAnimalsPerLot] = useState<Record<number, AnimalDelLot[]>>({})
  const [carregantLot, setCarregantLot] = useState<number | null>(null)

  async function toggleLot(lotId: number) {
    if (lotExpandit === lotId) {
      setLotExpandit(null)
      return
    }
    setLotExpandit(lotId)
    if (!animalsPerLot[lotId]) {
      setCarregantLot(lotId)
      try {
        const res = await fetch(`/api/lots/${lotId}/animals`)
        const json = await res.json()
        setAnimalsPerLot((prev) => ({ ...prev, [lotId]: json.animals ?? [] }))
      } finally {
        setCarregantLot(null)
      }
    }
  }

  if (lots.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        Encara no hi ha cap lot creat.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {lots.map((lot) => {
        const obert = lotExpandit === lot.id
        const animals = animalsPerLot[lot.id]
        return (
          <div key={lot.id} className="bg-white rounded-lg border border-gray-200">
            <button
              onClick={() => toggleLot(lot.id)}
              className="w-full flex items-center gap-2 px-3 py-3 text-left"
            >
              {obert ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span className="font-semibold text-gray-900 flex-1">{lot.nomLot}</span>
              <span className="text-sm text-gray-500">
                {lot.nombreAnimals} {lot.nombreAnimals === 1 ? 'animal' : 'animals'}
              </span>
              <span className="text-xs text-gray-400">{formatDate(lot.dataCreacio)}</span>
            </button>

            {obert && (
              <div className="border-t border-gray-100 px-3 py-2">
                {carregantLot === lot.id ? (
                  <p className="text-sm text-gray-400 py-2">Carregant...</p>
                ) : !animals || animals.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">Cap animal actiu en aquest lot.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1.5 font-medium">DIB</th>
                        <th className="py-1.5 font-medium">Raça</th>
                        <th className="py-1.5 font-medium">Cort</th>
                        <th className="py-1.5 font-medium">Des de</th>
                        <th className="py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {animals.map((animal) => (
                        <tr key={animal.id} className="border-t border-gray-50">
                          <td className="py-1.5 text-gray-900">{animal.dib}</td>
                          <td className="py-1.5 text-gray-600">{animal.nomRaca ?? '—'}</td>
                          <td className="py-1.5 text-gray-600">{animal.codiCort ?? '—'}</td>
                          <td className="py-1.5 text-gray-600">
                            {animal.dataEntrada ? formatDate(animal.dataEntrada) : '—'}
                          </td>
                          <td className="py-1.5 text-right">
                            {potEditar && (
                              <button
                                onClick={() => onMoureAnimal(animal.id, lot.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs
                                           bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                              >
                                <ArrowRightLeft size={12} aria-hidden="true" />
                                Moure
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
