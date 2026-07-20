'use client'

import type { MedicamentCataleg } from '@/types/sanitari'

type TaulaMedicamentsCatalegProps = {
  medicamentsCataleg: MedicamentCataleg[]
  carregant: boolean
}

/**
 * Taula del catàleg de medicaments (dades mestres, sense estoc).
 *
 * @param props.medicamentsCataleg - Medicaments del catàleg a mostrar
 * @param props.carregant - Indica si s'està carregant
 * @returns Taula amb nom, principi actiu, posologia i dies de supressió
 */
export function TaulaMedicamentsCataleg({ medicamentsCataleg, carregant }: TaulaMedicamentsCatalegProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">Nom</th>
            <th className="px-4 py-2 font-medium">Principi actiu</th>
            <th className="px-4 py-2 font-medium">Posologia estàndard</th>
            <th className="px-4 py-2 font-medium text-right">Dies supressió</th>
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Carregant...</td></tr>
          ) : medicamentsCataleg.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Cap medicament al catàleg.</td></tr>
          ) : (
            medicamentsCataleg.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{m.nomMedicament}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.principiActiu}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.posologiaStandard ?? '—'}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{m.diesSupressio}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
