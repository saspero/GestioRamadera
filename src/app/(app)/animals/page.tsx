'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { TaulaAnimals } from '@/components/animals/TaulaAnimals'
import { ModalAltaMassiva } from '@/components/animals/ModalAltaMassiva'
import { useSessio } from '@/lib/session/SessioContext'
import type { AnimalActiu } from '@/types/db'

/**
 * Pàgina del llistat d'animals actius, amb cercador i alta massiva.
 *
 * Abast d'aquesta primera versió (docs/08_modul_llistat_actius.md):
 * llistat + cercador + alta massiva per CSV. L'edició ràpida de
 * mètriques a la graella (secció 2.3-2.4) i les accions massives de
 * lot/cort (secció 3) queden per a una iteració posterior.
 *
 * @returns Pàgina d'animals amb taula, cercador i modal d'alta massiva
 *
 * @remarks Control d'accés: el llistat és visible per als 3 rols. El
 * botó d'alta massiva només es renderitza si rol === 'Admin'
 * (docs/08_modul_llistat_actius.md, secció "Rols amb accés"), llegit
 * via useSessio() (context ja resolt al servidor pel JWT — no cal cap
 * petició addicional per conèixer el rol). Aquesta comprovació és
 * només visual: els endpoints (/api/animals/catalegs, /bulk-import)
 * tornen a validar el rol igualment — defensa en profunditat.
 * @remarks Multitenancy: no toca la BD directament; tota la lectura
 * passa per GET /api/animals, que aplica el search_path del tenant.
 */
export default function AnimalsPage() {
  const { rol } = useSessio()
  const [animals, setAnimals] = useState<AnimalActiu[]>([])
  const [cerca, setCerca] = useState('')
  const [carregant, setCarregant] = useState(true)
  const [modalObert, setModalObert] = useState(false)

  const carregarAnimals = useCallback(async (termeCerca: string) => {
    setCarregant(true)
    try {
      const url = termeCerca
        ? `/api/animals?cerca=${encodeURIComponent(termeCerca)}`
        : '/api/animals'
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setAnimals(json.animals)
      }
    } finally {
      setCarregant(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => carregarAnimals(cerca), 250)
    return () => clearTimeout(timeout)
  }, [cerca, carregarAnimals])

  function handleImportacioCompletada() {
    setModalObert(false)
    carregarAnimals(cerca)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Animals</h1>
        {rol === 'Admin' && (
          <button
            onClick={() => setModalObert(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg min-h-[44px]"
          >
            <Plus size={18} aria-hidden="true" />
            Alta massiva
          </button>
        )}
      </div>

      <TaulaAnimals
        animals={animals}
        cerca={cerca}
        onCercaChange={setCerca}
        carregant={carregant}
      />

      {modalObert && (
        <ModalAltaMassiva
          onTancar={() => setModalObert(false)}
          onImportacioCompletada={handleImportacioCompletada}
        />
      )}
    </div>
  )
}
