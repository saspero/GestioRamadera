'use client'

import { formatNumber, formatDate } from '@/lib/format'
import { CercadorRapid } from '@/components/shared/CercadorRapid'
import { IndicadorSupressio } from '@/components/shared/IndicadorSupressio'
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
}

/**
 * Taula del llistat d'animals actius amb cercador ràpid integrat.
 *
 * @param props.animals - Animals a mostrar (ja filtrats pel backend si hi ha cerca)
 * @param props.cerca - Valor actual del cercador
 * @param props.onCercaChange - Callback en canviar el text de cerca
 * @param props.carregant - Indica si s'està carregant una nova cerca
 * @returns Taula responsive amb el llistat d'animals
 *
 * @remarks Control d'accés: visible per als 3 rols. Aquesta primera
 * versió és de només lectura (edició ràpida de pes/llet i accions
 * massives queden per a una iteració posterior, veure
 * docs/08_modul_llistat_actius.md, seccions 2.3-2.4 i 3).
 * @remarks Multitenancy: no toca la BD directament; rep les dades
 * ja carregades des de la pàgina pare via GET /api/animals.
 */
export function TaulaAnimals({ animals, cerca, onCercaChange, carregant }: TaulaAnimalsProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <CercadorRapid
          valor={cerca}
          onChange={onCercaChange}
          placeholder="Cercar per crotal..."
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2 font-medium">Crotal</th>
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
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  Carregant...
                </td>
              </tr>
            ) : animals.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  {cerca ? 'Cap animal coincideix amb la cerca.' : 'No hi ha animals actius.'}
                </td>
              </tr>
            ) : (
              animals.map((animal) => (
                <tr key={animal.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{animal.crotalId}</td>
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
    </div>
  )
}
