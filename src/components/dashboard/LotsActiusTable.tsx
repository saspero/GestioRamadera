import { formatNumber } from '@/lib/format'
import type { LotActiuBlock } from '@/types/dashboard'

/**
 * Taula de resum dels lots actius: nombre d'animals, dies transcorreguts
 * des de la creació del lot i consum mitjà de pinso (repartiment
 * proporcional per animal actiu a la zona, veure documentació de
 * getLotsActius a src/lib/db/queries/dashboard.ts).
 *
 * @param props.dades - Array de blocs de lots actius
 * @returns Taula responsive amb els lots, o missatge si no n'hi ha cap
 *
 * @remarks Control d'accés: visible per als 3 rols (Admin, Veterinari,
 * Treballador), filtrat prèviament al backend.
 */
export function LotsActiusTable({ dades }: { dades: LotActiuBlock[] }) {
  if (dades.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Lots actius</h2>
        <p className="text-sm text-gray-500">No hi ha lots actius actualment.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900 mb-3">Lots actius</h2>
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 pr-4 font-medium">Lot</th>
              <th className="pb-2 pr-4 font-medium text-right">Animals</th>
              <th className="pb-2 pr-4 font-medium text-right">Dies</th>
              <th className="pb-2 font-medium text-right">Consum (kg/dia)</th>
            </tr>
          </thead>
          <tbody>
            {dades.map((lot) => (
              <tr key={lot.lotId} className="border-b border-gray-50 last:border-0">
                <td className="py-2 pr-4 text-gray-900 font-medium">{lot.nomLot}</td>
                <td className="py-2 pr-4 text-right text-gray-700">
                  {formatNumber(lot.nombreAnimals)}
                </td>
                <td className="py-2 pr-4 text-right text-gray-700">
                  {formatNumber(lot.diesDesDeCreacio)}
                </td>
                <td className="py-2 text-right text-gray-700">
                  {lot.consumMitjaKgDia !== null
                    ? `${formatNumber(lot.consumMitjaKgDia, 2)} kg`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
