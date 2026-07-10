'use client'

import { useState } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { CercadorRapid } from '@/components/shared/CercadorRapid'
import { IndicadorSupressio } from '@/components/shared/IndicadorSupressio'
import { ModalMoureAnimals } from '@/components/lots/ModalMoureAnimals'
import type { AnimalActiu, EstatSalut } from '@/types/db'

const COLORS_SALUT: Record<EstatSalut, string> = {
  Sa: 'bg-green-100 text-green-700',
  'En tractament': 'bg-amber-100 text-amber-700',
  Observació: 'bg-blue-100 text-blue-700',
  Crític: 'bg-red-100 text-red-700',
}

type TaulaAnimalsProps = {
  animals: AnimalActiu[]
  cerca: string
  onCercaChange: (valor: string) => void
  carregant: boolean
  /** Si false (rol Treballador), s'amaga la selecció múltiple i l'acció de moure. */
  potMoure: boolean
  /** Callback cridat després d'un moviment amb èxit, per recarregar el llistat. */
  onAnimalsMoguts: () => void
}

/**
 * Taula del llistat d'animals actius amb cercador ràpid i, si el rol
 * ho permet, selecció múltiple per moure animals a un altre lot.
 *
 * @param props.animals - Animals a mostrar (ja filtrats pel backend si hi ha cerca)
 * @param props.cerca - Valor actual del cercador
 * @param props.onCercaChange - Callback en canviar el text de cerca
 * @param props.carregant - Indica si s'està carregant una nova cerca
 * @param props.potMoure - Si true, mostra checkboxes i el botó "Moure a lot"
 * @param props.onAnimalsMoguts - Callback per recarregar després d'un moviment
 * @returns Taula responsive amb el llistat d'animals
 *
 * @remarks Control d'accés: el llistat és visible per als 3 rols.
 * La selecció múltiple i el moviment de lot només per a Admin i
 * Veterinari (docs/14_modul_lots.md) — comprovació només visual, el
 * ModalMoureAnimals i el seu endpoint tornen a validar el rol.
 * @remarks Multitenancy: no toca la BD directament; rep les dades
 * ja carregades des de la pàgina pare via GET /api/animals. El
 * moviment passa per ModalMoureAnimals, component compartit amb el
 * mòdul Lots (src/components/lots/ModalMoureAnimals.tsx).
 * @remarks Abast pendent: edició ràpida de pes/llet a la graella
 * (Intro/Tab) i el selector de vista Per Cort/Per Lot encara no
 * estan implementats (docs/08_modul_llistat_actius.md, secció 0).
 */
export function TaulaAnimals({
  animals,
  cerca,
  onCercaChange,
  carregant,
  potMoure,
  onAnimalsMoguts,
}: TaulaAnimalsProps) {
  const [seleccionats, setSeleccionats] = useState<Set<number>>(new Set())
  const [modalMoureObert, setModalMoureObert] = useState(false)

  function toggleSeleccio(animalId: number) {
    setSeleccionats((prev) => {
      const nou = new Set(prev)
      nou.has(animalId) ? nou.delete(animalId) : nou.add(animalId)
      return nou
    })
  }

  function toggleSeleccioTots() {
    setSeleccionats((prev) =>
      prev.size === animals.length ? new Set() : new Set(animals.map((a) => a.id))
    )
  }

  function handleMogut() {
    setSeleccionats(new Set())
    setModalMoureObert(false)
    onAnimalsMoguts()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <CercadorRapid
            valor={cerca}
            onChange={onCercaChange}
            placeholder="Cercar per DIB..."
          />
        </div>
        {potMoure && seleccionats.size > 0 && (
          <button
            onClick={() => setModalMoureObert(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg min-h-[40px]"
          >
            <ArrowRightLeft size={16} aria-hidden="true" />
            Moure {seleccionats.size === 1 ? '1 animal' : `${seleccionats.size} animals`} a un lot
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
              {potMoure && (
                <th className="px-4 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={animals.length > 0 && seleccionats.size === animals.length}
                    onChange={toggleSeleccioTots}
                    aria-label="Seleccionar tots"
                  />
                </th>
              )}
              <th className="px-4 py-2 font-medium">DIB</th>
              <th className="px-4 py-2 font-medium">Raça</th>
              <th className="px-4 py-2 font-medium">Lot / Cort</th>
              <th className="px-4 py-2 font-medium">Estat de salut</th>
              <th className="px-4 py-2 font-medium text-right">Edat (dies)</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {carregant ? (
              <tr>
                <td colSpan={potMoure ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                  Carregant...
                </td>
              </tr>
            ) : animals.length === 0 ? (
              <tr>
                <td colSpan={potMoure ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                  {cerca ? 'Cap animal coincideix amb la cerca.' : 'No hi ha animals actius.'}
                </td>
              </tr>
            ) : (
              animals.map((animal) => (
                <tr key={animal.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  {potMoure && (
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={seleccionats.has(animal.id)}
                        onChange={() => toggleSeleccio(animal.id)}
                        aria-label={`Seleccionar ${animal.dib}`}
                      />
                    </td>
                  )}
                  <td className="px-4 py-2.5 font-medium text-gray-900">{animal.dib}</td>
                  <td className="px-4 py-2.5 text-gray-700">{animal.nomRaca ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {animal.nomLot ?? '—'}
                    {animal.codiCort && (
                      <span className="text-gray-400"> · {animal.codiCort}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLORS_SALUT[animal.estatSalut]}`}
                    >
                      {animal.estatSalut}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">
                    {animal.edatDies !== null ? formatNumber(animal.edatDies) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {animal.enSupressio && <IndicadorSupressio />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalMoureObert && (
        <ModalMoureAnimals
          animalIds={Array.from(seleccionats)}
          onTancar={() => setModalMoureObert(false)}
          onMogut={handleMogut}
        />
      )}
    </div>
  )
}
