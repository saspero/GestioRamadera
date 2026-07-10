import { Archive } from 'lucide-react'
import { formatDate } from '@/lib/format'
import type { BaixaRecentBlock } from '@/types/dashboard'

/**
 * Llista de les baixes (vendes i morts) més recents.
 *
 * @param props.dades - Array de baixes recents, ja ordenades per data descendent
 * @returns Llista amb les baixes, o missatge si no n'hi ha cap
 *
 * @remarks Control d'accés: visible per Admin i Veterinari, filtrat
 * prèviament al backend, coherent amb l'accés al mòdul d'Arxiu.
 */
export function UltimesBaixesList({ dades }: { dades: BaixaRecentBlock[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Archive size={18} aria-hidden="true" />
        Últimes baixes
      </h2>
      {dades.length === 0 ? (
        <p className="text-sm text-gray-500">Cap baixa registrada recentment.</p>
      ) : (
        <ul className="space-y-2">
          {dades.map((b) => (
            <li key={b.animalId} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{b.dib}</span>
              <span className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    b.motiu === 'Venda'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {b.motiu}
                </span>
                <span className="text-gray-500">{formatDate(b.dataBaixa)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
