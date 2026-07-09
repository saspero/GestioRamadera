import { HeartPulse } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { DistribucioSalutBlock } from '@/types/dashboard'

const COLORS_ESTAT: Record<DistribucioSalutBlock['estatSalut'], string> = {
  Sa: 'bg-green-500',
  'En tractament': 'bg-amber-500',
  Observació: 'bg-blue-500',
  Crític: 'bg-red-600',
}

/**
 * Distribució d'animals actius agrupats per estat de salut, amb
 * barres proporcionals per a una lectura visual ràpida.
 *
 * @param props.dades - Array amb el recompte per estat de salut
 * @returns Bloc visual amb la distribució, o missatge si no hi ha animals
 *
 * @remarks Control d'accés: visible per Admin i Veterinari, filtrat
 * prèviament al backend (àmbit sanitari).
 */
export function DistribucioSalutCard({ dades }: { dades: DistribucioSalutBlock[] }) {
  const total = dades.reduce((sum, d) => sum + d.total, 0)

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <HeartPulse size={18} aria-hidden="true" />
        Estat de salut dels animals
      </h2>
      {total === 0 ? (
        <p className="text-sm text-gray-500">No hi ha animals actius registrats.</p>
      ) : (
        <div className="space-y-2">
          {dades.map((d) => {
            const percentatge = total > 0 ? (d.total / total) * 100 : 0
            return (
              <div key={d.estatSalut}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">{d.estatSalut}</span>
                  <span className="text-gray-500">{formatNumber(d.total)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${COLORS_ESTAT[d.estatSalut]}`}
                    style={{ width: `${percentatge}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
