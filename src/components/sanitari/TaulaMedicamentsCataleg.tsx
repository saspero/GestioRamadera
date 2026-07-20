'use client'

import { Pencil, Trash2 } from 'lucide-react'
import type { MedicamentCataleg } from '@/types/sanitari'

type TaulaMedicamentsCatalegProps = {
  medicamentsCataleg: MedicamentCataleg[]
  carregant: boolean
  /** Si false (rol Treballador), s'amaguen els botons d'editar i eliminar. */
  potEditar: boolean
  onEditar: (medicament: MedicamentCataleg) => void
  onEliminar: (medicament: MedicamentCataleg) => void
}

/**
 * Taula del catàleg de medicaments, amb un resum de la composició.
 *
 * @param props.medicamentsCataleg - Medicaments del catàleg a mostrar
 * @param props.carregant - Indica si s'està carregant
 * @param props.potEditar - Si true, mostra els botons d'editar/eliminar
 * @param props.onEditar - Callback per obrir el modal d'edició
 * @param props.onEliminar - Callback per eliminar un medicament del catàleg
 * @returns Taula amb codi, nom i resum de components
 *
 * @remarks Edició i eliminació afegides juliol 2026 — abans el
 * catàleg només es podia consultar i ampliar, no corregir ni
 * eliminar.
 */
export function TaulaMedicamentsCataleg({
  medicamentsCataleg,
  carregant,
  potEditar,
  onEditar,
  onEliminar,
}: TaulaMedicamentsCatalegProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">Nom</th>
            <th className="px-4 py-2 font-medium">Principi actiu</th>
            <th className="px-4 py-2 font-medium">Posologia estàndard</th>
            <th className="px-4 py-2 font-medium text-right">Dies supressió</th>
            {potEditar && <th className="px-4 py-2 font-medium"></th>}
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr><td colSpan={potEditar ? 5 : 4} className="px-4 py-6 text-center text-gray-500">Carregant...</td></tr>
          ) : medicamentsCataleg.length === 0 ? (
            <tr><td colSpan={potEditar ? 5 : 4} className="px-4 py-6 text-center text-gray-500">Cap medicament al catàleg.</td></tr>
          ) : (
            medicamentsCataleg.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{m.nomMedicament}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.principiActiu}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.posologiaStandard ?? '—'}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{m.diesSupressio}</td>
                {potEditar && (
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <button
                        onClick={() => onEditar(m)}
                        className="p-1.5 rounded-lg hover:bg-gray-100"
                        aria-label={`Editar ${m.nomMedicament}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => onEliminar(m)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                        aria-label={`Eliminar ${m.nomMedicament}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
