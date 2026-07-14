'use client'

import { Pencil } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { Sitja, MagatzemFarratge } from '@/types/logistica'

type TaulaSitgesMagatzemsProps = {
  sitges: Sitja[]
  magatzems: MagatzemFarratge[]
  carregant: boolean
  onEditarSitja: (sitja: Sitja) => void
  onEditarMagatzem: (magatzem: MagatzemFarratge) => void
}

/**
 * Llistat de sitges i magatzems de farratge gestionables, en dues
 * taules independents dins de la mateixa pestanya "Magatzems".
 *
 * @param props.sitges - Sitges a mostrar
 * @param props.magatzems - Magatzems de farratge a mostrar
 * @param props.carregant - Indica si s'està carregant
 * @param props.onEditarSitja - Callback per obrir el modal d'edició d'una sitja
 * @param props.onEditarMagatzem - Callback per obrir el modal d'edició d'un magatzem
 * @returns Dues taules: Sitges i Magatzems de farratge
 *
 * @remarks Aquesta pantalla és el punt on abans faltava tota la
 * gestió: sense sitges/magatzems creats, el desplegable d'Origen del
 * formulari de Consums Massius sortia buit.
 */
export function TaulaSitgesMagatzems({
  sitges,
  magatzems,
  carregant,
  onEditarSitja,
  onEditarMagatzem,
}: TaulaSitgesMagatzemsProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <div className="px-4 py-2 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Sitges</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2 font-medium">Nom</th>
              <th className="px-4 py-2 font-medium">Granja</th>
              <th className="px-4 py-2 font-medium">Tipus de pinso</th>
              <th className="px-4 py-2 font-medium text-right">Estoc (kg)</th>
              <th className="px-4 py-2 font-medium">Estat</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {carregant ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Carregant...</td></tr>
            ) : sitges.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Cap sitja donada d&apos;alta.</td></tr>
            ) : (
              sitges.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{s.nom}</td>
                  <td className="px-4 py-2.5 text-gray-700">{s.nomUbicacio}</td>
                  <td className="px-4 py-2.5 text-gray-700">{s.nomTipusPinso ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{formatNumber(s.estocActualKg)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.estat === 'Actiu' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.estat}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => onEditarSitja(s)}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      aria-label={`Editar ${s.nom}`}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <div className="px-4 py-2 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Magatzems de farratge</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2 font-medium">Tipus de farratge</th>
              <th className="px-4 py-2 font-medium">Cobert</th>
              <th className="px-4 py-2 font-medium text-right">Estoc (tones)</th>
              <th className="px-4 py-2 font-medium">Estat</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {carregant ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Carregant...</td></tr>
            ) : magatzems.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Cap magatzem donat d&apos;alta.</td></tr>
            ) : (
              magatzems.map((m) => (
                <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{m.tipusFarratge}</td>
                  <td className="px-4 py-2.5 text-gray-700">{m.nomZona}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{formatNumber(m.estocActualTones)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.estat === 'Actiu' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.estat}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => onEditarMagatzem(m)}
                      className="p-1.5 rounded-lg hover:bg-gray-100"
                      aria-label={`Editar ${m.tipusFarratge}`}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
