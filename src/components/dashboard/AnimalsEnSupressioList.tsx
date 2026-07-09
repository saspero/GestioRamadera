import { ShieldAlert } from 'lucide-react'
import type { AnimalEnSupressioBlock } from '@/types/dashboard'

/**
 * Llista d'animals actualment en període de supressió (bloqueig
 * comercial actiu per tractament veterinari).
 *
 * @param props.dades - Array d'animals en supressió
 * @returns Llista amb els animals, o missatge si no n'hi ha cap
 *
 * @remarks Control d'accés: visible per Admin i Veterinari, filtrat
 * prèviament al backend (àmbit sanitari).
 */
export function AnimalsEnSupressioList({ dades }: { dades: AnimalEnSupressioBlock[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <ShieldAlert size={18} aria-hidden="true" />
        Animals en període de supressió
      </h2>
      {dades.length === 0 ? (
        <p className="text-sm text-gray-500">Cap animal amb bloqueig comercial actiu.</p>
      ) : (
        <ul className="space-y-2">
          {dades.map((a) => (
            <li key={a.animalId} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">
                <strong>{a.crotalId}</strong> — {a.nomMedicament}
              </span>
              <span className="text-amber-700 font-medium">
                {a.diesRestants} {a.diesRestants === 1 ? 'dia' : 'dies'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
