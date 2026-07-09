import { PawPrint } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { TotalAnimalsBlock } from '@/types/dashboard'

/**
 * Targeta de resum amb el total d'animals actius a l'explotació.
 *
 * @param props.dades - Bloc de dades del total d'animals
 * @returns Targeta visual amb el recompte total
 *
 * @remarks Control d'accés: visible per als 3 rols (Admin, Veterinari,
 * Treballador), filtrat prèviament al backend (src/app/api/dashboard/route.ts).
 */
export function TotalAnimalsCard({ dades }: { dades: TotalAnimalsBlock }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
      <div className="p-3 bg-primary-50 rounded-lg text-primary-600">
        <PawPrint size={24} aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{formatNumber(dades.total)}</p>
        <p className="text-sm text-gray-500">Animals actius a l&apos;explotació</p>
      </div>
    </div>
  )
}
