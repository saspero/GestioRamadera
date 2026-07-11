'use client'

import { useState, useMemo } from 'react'
import { ArrowRightLeft, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { CercadorRapid } from '@/components/shared/CercadorRapid'
import { IndicadorSupressio } from '@/components/shared/IndicadorSupressio'
import { ModalMoureAnimals } from '@/components/lots/ModalMoureAnimals'
import { FiltresAnimalsSelector, type ValorsFiltre } from '@/components/animals/FiltresAnimalsSelector'
import { FitxaAnimalModal } from '@/components/animals/FitxaAnimalModal'
import type { AnimalActiu, EstatSalut } from '@/types/db'

const COLORS_SALUT: Record<EstatSalut, string> = {
  Sa: 'bg-green-100 text-green-700',
  'En tractament': 'bg-amber-100 text-amber-700',
  Observació: 'bg-blue-100 text-blue-700',
  Crític: 'bg-red-100 text-red-700',
}

type ColumnaOrdenable = 'dib' | 'nomRaca' | 'nomLot' | 'estatSalut' | 'edatDies'
type DireccioOrdre = 'asc' | 'desc'

type TaulaAnimalsProps = {
  animals: AnimalActiu[]
  cerca: string
  onCercaChange: (valor: string) => void
  carregant: boolean
  /** Si false (rol Treballador), s'amaguen la selecció múltiple, l'acció de moure, i el botó de baixa a la fitxa. */
  potMoure: boolean
  /** Callback cridat després d'un moviment o una baixa amb èxit, per recarregar el llistat. */
  onAnimalsMoguts: () => void
}

/**
 * Taula del llistat d'animals actius amb cercador, filtres en
 * cascada (Granja/Zona/Lot), ordenació de columnes, selecció
 * múltiple per moure a un lot, i obertura de la fitxa completa en
 * clicar una fila.
 *
 * @param props.animals - Animals a mostrar (ja filtrats pel backend si hi ha cerca de text)
 * @param props.cerca - Valor actual del cercador de DIB
 * @param props.onCercaChange - Callback en canviar el text de cerca
 * @param props.carregant - Indica si s'està carregant una nova cerca
 * @param props.potMoure - Si true, mostra checkboxes, "Moure a lot" i el botó de baixa a la fitxa
 * @param props.onAnimalsMoguts - Callback per recarregar després d'un moviment o una baixa
 * @returns Taula responsive amb filtres, ordenació i fitxa d'animal
 *
 * @remarks Control d'accés: el llistat és visible per als 3 rols.
 * La selecció múltiple, el moviment de lot i el botó de baixa a la
 * fitxa només per a Admin i Veterinari — comprovació només visual,
 * els endpoints corresponents tornen a validar el rol.
 * @remarks Filtres Granja/Zona/Lot i ordenació de columnes: es fan
 * ÍNTEGRAMENT AL CLIENT sobre les dades ja carregades — no generen
 * cap petició addicional al backend (docs/08_modul_llistat_actius.md).
 * @remarks Multitenancy: no toca la BD directament; rep les dades
 * ja carregades des de la pàgina pare via GET /api/animals. El
 * moviment i la baixa passen per components compartits amb altres
 * mòduls (ModalMoureAnimals, FitxaAnimalModal → ModalBaixa).
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
  const [filtres, setFiltres] = useState<ValorsFiltre>({
    ubicacioId: null,
    zonaId: null,
    lotId: null,
  })
  const [ordre, setOrdre] = useState<{ columna: ColumnaOrdenable; direccio: DireccioOrdre } | null>(null)
  const [animalObertId, setAnimalObertId] = useState<number | null>(null)

  const animalsFiltrats = useMemo(() => {
    return animals.filter((a) => {
      if (filtres.ubicacioId !== null && a.ubicacioId !== filtres.ubicacioId) return false
      if (filtres.zonaId !== null && a.zonaId !== filtres.zonaId) return false
      if (filtres.lotId !== null && a.lotId !== filtres.lotId) return false
      return true
    })
  }, [animals, filtres])

  const animalsOrdenats = useMemo(() => {
    if (!ordre) return animalsFiltrats
    const factor = ordre.direccio === 'asc' ? 1 : -1
    return [...animalsFiltrats].sort((a, b) => {
      const va = a[ordre.columna]
      const vb = b[ordre.columna]
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
      return String(va).localeCompare(String(vb)) * factor
    })
  }, [animalsFiltrats, ordre])

  function handleOrdenar(columna: ColumnaOrdenable) {
    setOrdre((prev) => {
      if (prev?.columna !== columna) return { columna, direccio: 'asc' }
      if (prev.direccio === 'asc') return { columna, direccio: 'desc' }
      return null
    })
  }

  function IconaOrdre({ columna }: { columna: ColumnaOrdenable }) {
    if (ordre?.columna !== columna) return <ArrowUpDown size={12} className="text-gray-300" />
    return ordre.direccio === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  function toggleSeleccio(animalId: number) {
    setSeleccionats((prev) => {
      const nou = new Set(prev)
      nou.has(animalId) ? nou.delete(animalId) : nou.add(animalId)
      return nou
    })
  }

  function toggleSeleccioTots() {
    setSeleccionats((prev) =>
      prev.size === animalsOrdenats.length
        ? new Set()
        : new Set(animalsOrdenats.map((a) => a.id))
    )
  }

  function handleMogut() {
    setSeleccionats(new Set())
    setModalMoureObert(false)
    onAnimalsMoguts()
  }

  const capçaleres: { key: ColumnaOrdenable; label: string; alinea?: 'right' }[] = [
    { key: 'dib', label: 'DIB' },
    { key: 'nomRaca', label: 'Raça' },
    { key: 'nomLot', label: 'Lot / Cort' },
    { key: 'estatSalut', label: 'Estat de salut' },
    { key: 'edatDies', label: 'Edat (dies)', alinea: 'right' },
  ]

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
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
        <FiltresAnimalsSelector valors={filtres} onChange={setFiltres} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
              {potMoure && (
                <th className="px-4 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={animalsOrdenats.length > 0 && seleccionats.size === animalsOrdenats.length}
                    onChange={toggleSeleccioTots}
                    aria-label="Seleccionar tots"
                  />
                </th>
              )}
              {capçaleres.map((c) => (
                <th key={c.key} className={`px-4 py-2 font-medium ${c.alinea === 'right' ? 'text-right' : ''}`}>
                  <button
                    onClick={() => handleOrdenar(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-gray-900 ${c.alinea === 'right' ? 'flex-row-reverse' : ''}`}
                  >
                    {c.label}
                    <IconaOrdre columna={c.key} />
                  </button>
                </th>
              ))}
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
            ) : animalsOrdenats.length === 0 ? (
              <tr>
                <td colSpan={potMoure ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                  {cerca ? 'Cap animal coincideix amb la cerca.' : 'No hi ha animals actius.'}
                </td>
              </tr>
            ) : (
              animalsOrdenats.map((animal) => (
                <tr
                  key={animal.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setAnimalObertId(animal.id)}
                >
                  {potMoure && (
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
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

      {animalObertId !== null && (
        <FitxaAnimalModal
          animalId={animalObertId}
          potDonarBaixa={potMoure}
          onTancar={() => setAnimalObertId(null)}
          onBaixaRegistrada={onAnimalsMoguts}
        />
      )}
    </div>
  )
}
