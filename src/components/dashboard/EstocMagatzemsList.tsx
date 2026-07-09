import { Warehouse } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { EstocMagatzemBlock } from '@/types/dashboard'

const COLORS_ALERTA: Record<EstocMagatzemBlock['estatAlerta'], string> = {
  NORMAL: 'bg-green-100 text-green-700',
  BAIX: 'bg-yellow-100 text-yellow-700',
  ESGOTAT: 'bg-red-100 text-red-700',
}

const ETIQUETES_ALERTA: Record<EstocMagatzemBlock['estatAlerta'], string> = {
  NORMAL: 'Normal',
  BAIX: 'Estoc baix',
  ESGOTAT: 'Esgotat',
}

/**
 * Llista de l'estoc actual de totes les sitges i magatzems de farratge,
 * amb indicador visual de l'estat d'alerta.
 *
 * @param props.dades - Array de blocs d'estoc de magatzem
 * @returns Llista responsive amb l'estoc, o missatge si no n'hi ha cap
 *
 * @remarks Control d'accés: visible per Admin i Treballador, filtrat
 * prèviament al backend (Veterinari no hi té accés).
 */
export function EstocMagatzemsList({ dades }: { dades: EstocMagatzemBlock[] }) {
  if (dades.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 mb-2">Estoc de magatzems</h2>
        <p className="text-sm text-gray-500">No hi ha magatzems actius configurats.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Warehouse size={18} aria-hidden="true" />
        Estoc de magatzems
      </h2>
      <ul className="space-y-2">
        {dades.map((m) => (
          <li key={`${m.tipus}-${m.id}`} className="flex items-center justify-between text-sm">
            <span className="text-gray-700">{m.nom}</span>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">
                {formatNumber(m.estocActual, m.unitat === 'tones' ? 2 : 0)} {m.unitat}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${COLORS_ALERTA[m.estatAlerta]}`}
              >
                {ETIQUETES_ALERTA[m.estatAlerta]}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
