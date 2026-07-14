'use client'

import { formatNumber } from '@/lib/format'
import { PaginacioControls } from '@/components/ui/PaginacioControls'
import { usePaginacio } from '@/hooks/usePaginacio'
import type { Medicament } from '@/types/sanitari'

type TaulaMedicamentsProps = {
  medicaments: Medicament[]
  carregant: boolean
}

/**
 * Taula de l'inventari de medicaments sanitaris.
 *
 * @param props.medicaments - Medicaments a mostrar
 * @param props.carregant - Indica si s'està carregant
 * @returns Taula responsive amb l'inventari, paginat
 *
 * @remarks PAGINACIÓ: usePaginacio(), 25 files per pàgina, només al
 * client.
 * @remarks Els medicaments amb estoc a 0 es mostren igualment
 * (segueixen visibles a l'historial, docs/06_modul_sanitari.md,
 * secció 2.2) però amb l'estoc destacat en vermell.
 */
export function TaulaMedicaments({ medicaments, carregant }: TaulaMedicamentsProps) {
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
            <th className="px-4 py-2 font-medium text-right">Estoc</th>
            <th className="px-4 py-2 font-medium text-right">Preu</th>
            <th className="px-4 py-2 font-medium text-right">Dies supressió</th>
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                Carregant...
              </td>
            </tr>
          ) : dadesPagina.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                Cap medicament a l&apos;inventari.
              </td>
            </tr>
          ) : (
            dadesPagina.map((m) => (
              <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{m.nomMedicament}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.principiActiu}</td>
                <td className="px-4 py-2.5 text-gray-700">{m.lot}</td>
                <td className={`px-4 py-2.5 text-right ${m.quantitatEstoc <= 0 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                  {formatNumber(m.quantitatEstoc)} {m.unitatEstoc}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-700">{formatNumber(m.preuCompra)} €</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{m.diesSupressio}</td>
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
