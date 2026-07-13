'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ArrowRightLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { formatDate } from '@/lib/format'
import { queryKeys } from '@/lib/query/queryKeys'
import type { LotResum, AnimalDelLot } from '@/types/lots'

type ListaLotsProps = {
  lots: LotResum[]
  potEditar: boolean
  onMoureAnimal: (animalId: number, lotOrigenId: number) => void
}

/**
 * Fila expandible d'un únic lot, amb el seu propi useQuery pel
 * detall d'animals — extreta com a component separat perquè cada
 * fila necessita el seu propi hook (React no permet useQuery
 * condicional dins d'un bucle .map() del component pare).
 */
function FilaLot({
  lot,
  potEditar,
  onMoureAnimal,
}: {
  lot: LotResum
  potEditar: boolean
  onMoureAnimal: (animalId: number, lotOrigenId: number) => void
}) {
  const [obert, setObert] = useState(false)

  const { data: animals, isLoading } = useQuery<AnimalDelLot[]>({
    queryKey: queryKeys.lots.animals(lot.id),
    queryFn: () => fetch(`/api/lots/${lot.id}/animals`).then((res) => res.json()).then((j) => j.animals ?? []),
    enabled: obert,
  })

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <button
        onClick={() => setObert((v) => !v)}
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
          {isLoading ? (
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
 * @remarks MIGRACIÓ REACT QUERY: el detall d'animals de cada lot es
 * carrega amb useQuery (queryKeys.lots.animals(lotId)), amb
 * `enabled` lligat a l'estat d'expansió — la primera vegada que
 * s'expandeix un lot es fa la petició, però si es torna a expandir
 * (col·lapsar i tornar a obrir) es reutilitza la cache sense tornar
 * a demanar-ho al servidor (fins que caduqui o s'invalidi per un
 * moviment). Cada fila necessita el seu propi hook, per això s'ha
 * extret com a component <FilaLot> — React no permet cridar
 * useQuery dins d'un bucle del component pare.
 * @remarks Control d'accés: aquest component és de només presentació;
 * la protecció real és a l'endpoint de moviment.
 */
export function LlistaLots({ lots, potEditar, onMoureAnimal }: ListaLotsProps) {
  if (lots.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        Encara no hi ha cap lot creat.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {lots.map((lot) => (
        <FilaLot key={lot.id} lot={lot} potEditar={potEditar} onMoureAnimal={onMoureAnimal} />
      ))}
    </div>
  )
}
