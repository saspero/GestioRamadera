'use client'

import { formatDate } from '@/lib/format'
import { PaginacioControls } from '@/components/ui/PaginacioControls'
import { usePaginacio } from '@/hooks/usePaginacio'
import type { AnimalInactiu } from '@/types/arxiu'

type TaulaArxiuProps = {
  animals: AnimalInactiu[]
  carregant: boolean
  onObrirFitxa: (animalId: number) => void
}

const COLORS_MOTIU: Record<string, string> = {
  Venda: 'bg-green-100 text-green-700',
  Mort: 'bg-gray-200 text-gray-700',
}

/**
 * Taula unificada d'animals donats de baixa (venda o mort),
 * paginada (docs/07_modul_arxiu_historic.md, secció 2.1).
 *
 * @param props.animals - Animals inactius a mostrar (ja filtrats pel backend)
 * @param props.carregant - Indica si s'està carregant
 * @param props.onObrirFitxa - Callback en clicar una fila, per obrir la fitxa completa
 * @returns Taula responsive amb DIB, raça, dates, motiu i últim lot
 *
 * @remarks Els filtres (cerca, motiu, rang de dates) es resolen al
 * backend, no aquí — a diferència d'Animals, on el filtratge de
 * Granja/Zona/Lot és client-side. Aquí el filtratge per motiu i
 * dates es fa a la query SQL perquè el volum d'històric pot créixer
 * molt amb els anys i no té sentit carregar-lo tot per filtrar-lo
 * després al navegador.
 * @remarks Paginació 25/pàgina, només client, sobre el resultat ja
 * filtrat pel backend (mateix patró que la resta de taules llargues).
 */
export function TaulaArxiu({ animals, carregant, onObrirFitxa }: TaulaArxiuProps) {
  const { dadesPagina, paginaActual, totalPagines, totalFiles, paginaAnterior, paginaSeguent } =
    usePaginacio(animals, 25)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">DIB</th>
            <th className="px-4 py-2 font-medium">Raça</th>
            <th className="px-4 py-2 font-medium">Data naixement</th>
            <th className="px-4 py-2 font-medium">Data baixa</th>
            <th className="px-4 py-2 font-medium">Motiu</th>
            <th className="px-4 py-2 font-medium">Lot (últim)</th>
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Carregant...</td>
            </tr>
          ) : dadesPagina.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Cap animal a l&apos;arxiu.</td>
            </tr>
          ) : (
            dadesPagina.map((animal) => (
              <tr
                key={animal.id}
                className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer"
                onClick={() => onObrirFitxa(animal.id)}
              >
                <td className="px-4 py-2.5 font-medium text-gray-900">{animal.dib}</td>
                <td className="px-4 py-2.5 text-gray-700">{animal.nomRaca ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-700">
                  {animal.dataNaixement ? formatDate(animal.dataNaixement) : '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-700">{formatDate(animal.dataBaixa)}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLORS_MOTIU[animal.motiu]}`}>
                    {animal.motiu}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-gray-700">{animal.nomLotUltim ?? '—'}</td>
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
