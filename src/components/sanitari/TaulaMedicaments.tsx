'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { PaginacioControls } from '@/components/ui/PaginacioControls'
import { usePaginacio } from '@/hooks/usePaginacio'
import type { Medicament } from '@/types/sanitari'

type TaulaMedicamentsProps = {
  medicaments: Medicament[]
  carregant: boolean
  /** Si false (rol Treballador), s'amaguen els botons d'editar i eliminar. */
  potEditar: boolean
  onEditar: (medicament: Medicament) => void
  onEliminar: (medicament: Medicament) => void
}

/**
 * Taula de l'inventari de medicaments sanitaris.
 *
 * @param props.medicaments - Medicaments a mostrar
 * @param props.carregant - Indica si s'està carregant
 * @param props.potEditar - Si true, mostra els botons d'editar/eliminar
 * @param props.onEditar - Callback per obrir el modal d'edició
 * @param props.onEliminar - Callback per eliminar una entrada
 * @returns Taula responsive amb l'inventari, paginat
 *
 * @remarks Model d'estoc (juliol 2026): la columna "Estoc" mostra
 * ara el nombre d'unitats i el total calculat (Ex: "9,4 ampolles
 * (470 ml)"), en comptes d'un total introduït a mà.
 * @remarks Eliminació afegida juliol 2026.
 * @remarks PAGINACIÓ: usePaginacio(), 25 files per pàgina, només al
 * client.
 */
export function TaulaMedicaments({
  medicaments,
  carregant,
  potEditar,
  onEditar,
  onEliminar,
}: TaulaMedicamentsProps) {
  const { dadesPagina, paginaActual, totalPagines, totalFiles, paginaAnterior, paginaSeguent } =
    usePaginacio(medicaments, 25)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">Medicament</th>
            <th className="px-4 py-2 font-medium">Principi actiu</th>
            <th className="px-4 py-2 font-medium">Lot</th>
            <th className="px-4 py-2 font-medium text-right">Unitats</th>
            <th className="px-4 py-2 font-medium text-right">Total estoc</th>
            <th className="px-4 py-2 font-medium text-right">Preu</th>
            <th className="px-4 py-2 font-medium text-right">Dies supressió</th>
            {potEditar && <th className="px-4 py-2 font-medium"></th>}
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr>
              <td colSpan={potEditar ? 8 : 7} className="px-4 py-6 text-center text-gray-500">
                Carregant...
              </td>
            </tr>
          ) : dadesPagina.length === 0 ? (
            <tr>
              <td colSpan={potEditar ? 8 : 7} className="px-4 py-6 text-center text-gray-500">
                Cap medicament a l&apos;inventari.
              </td>
            </tr>
          ) : (
            dadesPagina.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{m.nomMedicament}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.principiActiu}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.lot}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">
                  {formatNumber(m.nombreUnitats, 1)} {m.unitatPaquet}
                </td>
                <td className={`px-4 py-2.5 text-right ${m.quantitatEstocTotal <= 0 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                  {formatNumber(m.quantitatEstocTotal)} {m.unitatContingut}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700">{formatNumber(m.preuCompra)} €</td>
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

      <PaginacioControls
        paginaActual={paginaActual}
        totalPagines={totalPagines}
        totalFiles={totalFiles}
        onAnterior={paginaAnterior}
        onSeguent={paginaSeguent}
      />
    </div>
  )
}
