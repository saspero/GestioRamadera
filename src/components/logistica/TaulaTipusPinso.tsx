'use client'

import { Pencil } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { TipusPinso } from '@/types/logistica'

type TaulaTipusPinsoProps = {
  tipusPinso: TipusPinso[]
  carregant: boolean
  onEditar: (tipus: TipusPinso) => void
}

/**
 * Taula del catàleg de tipus de pinso, amb un resum de la composició
 * (llista de components separats per coma).
 *
 * @param props.tipusPinso - Tipus de pinso a mostrar, amb components
 * @param props.carregant - Indica si s'està carregant
 * @param props.onEditar - Callback per obrir el modal d'edició
 * @returns Taula amb codi, nom i resum de components
 */
export function TaulaTipusPinso({ tipusPinso, carregant, onEditar }: TaulaTipusPinsoProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2 font-medium">Codi</th>
            <th className="px-4 py-2 font-medium">Nom</th>
            <th className="px-4 py-2 font-medium">Composició</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {carregant ? (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Carregant...</td></tr>
          ) : tipusPinso.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">Cap tipus de pinso al catàleg.</td></tr>
          ) : (
            tipusPinso.map((t) => (
              <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2.5 font-medium text-gray-900">{t.codi}</td>
                <td className="px-4 py-2.5 text-gray-700">{t.nom}</td>
                <td className="px-4 py-2.5 text-gray-600">
                  {t.components
                    .map((c) => `${c.nomComponent} (${formatNumber(c.percentatge)}%)`)
                    .join(', ')}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => onEditar(t)}
                    className="p-1.5 rounded-lg hover:bg-gray-100"
                    aria-label={`Editar ${t.nom}`}
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
  )
}
