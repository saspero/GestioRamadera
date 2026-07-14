'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

type PaginacioControlsProps = {
  paginaActual: number
  totalPagines: number
  totalFiles: number
  onAnterior: () => void
  onSeguent: () => void
}

/**
 * Controls de paginació: "Anterior", "Següent", i indicador de
 * pàgina/total de files.
 *
 * @param props.paginaActual - Número de pàgina actual (1-indexat)
 * @param props.totalPagines - Nombre total de pàgines
 * @param props.totalFiles - Nombre total de files (per mostrar "de X registres")
 * @param props.onAnterior - Callback per anar a la pàgina anterior
 * @param props.onSeguent - Callback per anar a la pàgina següent
 * @returns Barra de paginació, amagada si només hi ha una pàgina
 *
 * @remarks Pensat per usar-se juntament amb usePaginacio()
 * (src/hooks/usePaginacio.ts). No es mostra si `totalPagines <= 1`
 * — evita ocupar espai a taules curtes que no el necessiten.
 */
export function PaginacioControls({
  paginaActual,
  totalPagines,
  totalFiles,
  onAnterior,
  onSeguent,
}: PaginacioControlsProps) {
  if (totalPagines <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
      <span>
        Pàgina {paginaActual} de {totalPagines} · {totalFiles} registres
      </span>
      <div className="flex gap-1">
        <button
          onClick={onAnterior}
          disabled={paginaActual === 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] min-w-[40px]"
          aria-label="Pàgina anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={onSeguent}
          disabled={paginaActual === totalPagines}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed min-h-[40px] min-w-[40px]"
          aria-label="Pàgina següent"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
