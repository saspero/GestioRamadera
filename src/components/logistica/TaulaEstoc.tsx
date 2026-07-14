'use client'

import { formatNumber } from '@/lib/format'
import { PaginacioControls } from '@/components/ui/PaginacioControls'
import { usePaginacio } from '@/hooks/usePaginacio'
import type { EstocMagatzemComplet } from '@/types/logistica'

type TaulaEstocProps = {
  estoc: EstocMagatzemComplet[]
  carregant: boolean
  /** Si false (rol Treballador), s'amaga el toggle d'estat. */
  potGestionar: boolean
  onCanviarEstat: (item: EstocMagatzemComplet) => void
}

const COLORS_ALERTA: Record<string, string> = {
  NORMAL: 'bg-gray-100 text-gray-600',
  BAIX: 'bg-amber-100 text-amber-700',
  ESGOTAT: 'bg-red-100 text-red-700',
}

/**
 * Taula de Control d'Estoc de magatzems i sitges, amb barra visual
 * de capacitat i toggle d'estat Actiu/Deshabilitat.
 *
 * @param props.estoc - Magatzems/sitges a mostrar (actius i deshabilitats)
 * @param props.carregant - Indica si s'està carregant
 * @param props.potGestionar - Si true, mostra el toggle d'estat (només Admin)
 * @param props.onCanviarEstat - Callback en clicar el toggle
 * @returns Taula responsive amb columnes segons docs/09_modul_logistica_farratges.md, secció 5, paginada
 *
 * @remarks PAGINACIÓ: usePaginacio(), 25 files per pàgina, només al
 * client.
 * @remarks El toggle d'estat és exclusiu d'Admin
 * (docs/09_modul_logistica_farratges.md, secció 4.2) — Treballador
 * només consulta, sense poder desactivar espais.
 */
export function TaulaEstoc({ estoc, carregant, potGestionar, onCanviarEstat }: TaulaEstocProps) {
  const { dadesPagina, paginaActual, totalPagines, totalFiles, paginaAnterior, paginaSeguent } =
    usePaginacio(estoc, 25)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">Magatzem / Sitja</th>
            <th className="px-4 py-2 font-medium">Tipus</th>
            <th className="px-4 py-2 font-medium">Estoc</th>
            <th className="px-4 py-2 font-medium">% Ocupació</th>
            <th className="px-4 py-2 font-medium">Estat</th>
            <th className="px-4 py-2 font-medium">Alerta</th>
            {potGestionar && <th className="px-4 py-2 font-medium"></th>}
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr>
              <td colSpan={potGestionar ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                Carregant...
              </td>
            </tr>
          ) : dadesPagina.length === 0 ? (
            <tr>
              <td colSpan={potGestionar ? 7 : 6} className="px-4 py-6 text-center text-gray-500">
                Cap magatzem donat d&apos;alta.
              </td>
            </tr>
          ) : (
            dadesPagina.map((item) => {
              const percentatge =
                item.capacitat && item.capacitat > 0
                  ? Math.min(100, Math.round((item.estocActual / item.capacitat) * 100))
                  : null
              return (
                <tr key={`${item.tipus}-${item.id}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{item.nom}</td>
                  <td className="px-4 py-2.5 text-gray-700">{item.tipusProducte ?? '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {formatNumber(item.estocActual)} {item.unitat}
                    {item.capacitat !== null && (
                      <span className="text-gray-400"> / {formatNumber(item.capacitat)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {percentatge !== null ? (
                      <div className="flex items-center gap-2 w-32">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${percentatge >= 80 ? 'bg-green-500' : percentatge >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${percentatge}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{percentatge}%</span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.estat === 'Actiu' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {item.estat}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLORS_ALERTA[item.estatAlerta]}`}>
                      {item.estatAlerta}
                    </span>
                  </td>
                  {potGestionar && (
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => onCanviarEstat(item)}
                        className="text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
                      >
                        {item.estat === 'Actiu' ? 'Deshabilitar' : 'Activar'}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })
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
