'use client'

import { Pencil, Trash2 } from 'lucide-react'
import { formatDate, formatNumber } from '@/lib/format'
import { PaginacioControls } from '@/components/ui/PaginacioControls'
import { usePaginacio } from '@/hooks/usePaginacio'
import type { TractamentAmbMedicament } from '@/types/sanitari'

type TaulaTractamentsProps = {
  tractaments: TractamentAmbMedicament[]
  carregant: boolean
  /** Si false (rol Treballador), s'amaguen els botons d'editar i eliminar. */
  potEditar: boolean
  onEditar: (tractament: TractamentAmbMedicament) => void
  onEliminar: (tractament: TractamentAmbMedicament) => void
}

/**
 * Taula de tractaments aplicats, amb indicador de bloqueig comercial
 * actiu quan la data d'alliberament encara és futura.
 *
 * @param props.tractaments - Tractaments a mostrar
 * @param props.carregant - Indica si s'està carregant
 * @param props.potEditar - Si true, mostra els botons d'editar/eliminar
 * @param props.onEditar - Callback per obrir el modal d'edició
 * @param props.onEliminar - Callback per obrir el modal d'eliminació (amb motiu)
 * @returns Taula responsive amb l'històric de tractaments, paginat
 *
 * @remarks Edició i eliminació afegides juliol 2026 — l'eliminació
 * obre un modal propi que exigeix un motiu (docs/06_modul_sanitari.md,
 * actualització).
 * @remarks PAGINACIÓ: usePaginacio(), 25 files per pàgina, només al
 * client — l'historial de tractaments creix sense límit amb el
 * temps, per això és una de les taules prioritzades.
 * @remarks docs/06_modul_sanitari.md, secció 4.3: mentre
 * data_alliberament sigui futura, l'animal no pot ser venut. Aquesta
 * taula mostra l'estat visualment (badge vermell) per a referència
 * ràpida.
 */
export function TaulaTractaments({
  tractaments,
  carregant,
  potEditar,
  onEditar,
  onEliminar,
}: TaulaTractamentsProps) {
  const avui = new Date().toISOString().slice(0, 10)
  const { dadesPagina, paginaActual, totalPagines, totalFiles, paginaAnterior, paginaSeguent } =
    usePaginacio(tractaments, 25)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">Animal</th>
            <th className="px-4 py-2 font-medium">Medicament</th>
            <th className="px-4 py-2 font-medium">Data inici</th>
            <th className="px-4 py-2 font-medium">Dosi</th>
            <th className="px-4 py-2 font-medium">Alliberament</th>
            {potEditar && <th className="px-4 py-2 font-medium"></th>}
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr>
              <td colSpan={potEditar ? 6 : 5} className="px-4 py-6 text-center text-gray-500">
                Carregant...
              </td>
            </tr>
          ) : dadesPagina.length === 0 ? (
            <tr>
              <td colSpan={potEditar ? 6 : 5} className="px-4 py-6 text-center text-gray-500">
                Cap tractament registrat.
              </td>
            </tr>
          ) : (
            dadesPagina.map((t) => {
              const enSupressio = t.dataAlliberament !== null && t.dataAlliberament > avui
              return (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{t.animalDib}</td>
                  <td className="px-4 py-2.5 text-gray-700">{t.nomMedicament}</td>
                  <td className="px-4 py-2.5 text-gray-700">{formatDate(t.dataInici)}</td>
                  <td className="px-4 py-2.5 text-gray-700">
                    {t.dosiAplicada !== null ? `${formatNumber(t.dosiAplicada)} ${t.unitatDosi ?? ''}` : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.dataAlliberament ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${enSupressio ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {formatDate(t.dataAlliberament)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  {potEditar && (
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => onEditar(t)}
                          className="p-1.5 rounded-lg hover:bg-gray-100"
                          aria-label={`Editar tractament de ${t.animalDib}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => onEliminar(t)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                          aria-label={`Eliminar tractament de ${t.animalDib}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
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
