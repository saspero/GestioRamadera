import { TriangleAlert } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { AlertaEstocBlock } from '@/types/dashboard'

/**
 * Bloc d'alertes crítiques d'estoc (baix o esgotat). Es renderitza
 * buit (null) si no hi ha cap alerta activa, per no ocupar espai
 * innecessari al Dashboard.
 *
 * @param props.dades - Array d'alertes d'estoc (ja filtrades a BAIX/ESGOTAT)
 * @returns Bloc d'alerta visual, o null si no hi ha alertes
 *
 * @remarks Control d'accés: visible per Admin i Treballador, filtrat
 * prèviament al backend.
 */
export function AlertesEstocCard({ dades }: { dades: AlertaEstocBlock[] }) {
  if (dades.length === 0) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <h2 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
        <TriangleAlert size={18} aria-hidden="true" />
        Alertes d&apos;estoc
      </h2>
      <ul className="space-y-1">
        {dades.map((m) => (
          <li key={`${m.tipus}-${m.id}`} className="text-sm text-red-800">
            <strong>{m.nom}</strong>
            {m.estatAlerta === 'ESGOTAT'
              ? ' — estoc esgotat'
              : ` — estoc baix (${formatNumber(m.estocActual, m.unitat === 'tones' ? 2 : 0)} ${m.unitat})`}
          </li>
        ))}
      </ul>
    </div>
  )
}
