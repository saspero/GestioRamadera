'use client'

import { Trash2 } from 'lucide-react'
import type { RacaCataleg } from '@/types/configuracio'

type TaulaRacesProps = {
  races: RacaCataleg[]
  carregant: boolean
  onEliminar: (raca: RacaCataleg) => void
}

/**
 * Taula del catàleg de races: globals (protegides, sense botó
 * d'eliminar) i pròpies del tenant (eliminables).
 *
 * @param props.races - Races a mostrar (globals + pròpies)
 * @param props.carregant - Indica si s'està carregant
 * @param props.onEliminar - Callback per eliminar una raça personalitzada
 * @returns Taula amb nom i origen (Global/Personalitzada)
 */
export function TaulaRaces({ races, carregant, onEliminar }: TaulaRacesProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">Nom</th>
            <th className="px-4 py-2 font-medium">Origen</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">Carregant...</td></tr>
          ) : races.length === 0 ? (
            <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">Cap raça al catàleg.</td></tr>
          ) : (
            races.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{r.nomRaca}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.esGlobal ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                    {r.esGlobal ? 'Global' : 'Personalitzada'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {!r.esGlobal && (
                    <button
                      onClick={() => onEliminar(r)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                      aria-label={`Eliminar ${r.nomRaca}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
