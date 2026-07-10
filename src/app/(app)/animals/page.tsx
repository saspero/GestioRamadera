'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, UserPlus } from 'lucide-react'
import { TaulaAnimals } from '@/components/animals/TaulaAnimals'
import { ModalAltaMassiva } from '@/components/animals/ModalAltaMassiva'
import { ModalAltaIndividual } from '@/components/animals/ModalAltaIndividual'
import { useSessio } from '@/lib/session/SessioContext'
import type { AnimalActiu } from '@/types/db'

/**
 * Pàgina del llistat d'animals actius, amb cercador, alta massiva,
 * alta individual, i selecció múltiple per moure animals a un altre lot.
 *
 * Abast d'aquesta versió (docs/08_modul_llistat_actius.md):
 * llistat + cercador + alta massiva per CSV + alta individual +
 * moviment de lot des de la taula (docs/14_modul_lots.md). L'edició
 * ràpida de mètriques a la graella (secció 2.3-2.4) i el selector de
 * vista Per Cort/Per Lot queden per a una iteració posterior.
 *
 * @returns Pàgina d'animals amb taula, cercador i modals d'alta i moviment
 *
 * @remarks Control d'accés: el llistat és visible per als 3 rols.
 * El botó d'alta massiva només per a Admin. El d'alta individual i
 * la selecció múltiple/moviment de lot per a Admin i Veterinari
 * (ampliació sobre el disseny original). Llegit via useSessio().
 * Aquesta comprovació és només visual: els endpoints tornen a
 * validar el rol igualment — defensa en profunditat.
 * @remarks Multitenancy: no toca la BD directament; tota la lectura
 * passa per GET /api/animals, que aplica el search_path del tenant.
 */
export default function AnimalsPage() {
  const { rol } = useSessio()
  const [animals, setAnimals] = useState<AnimalActiu[]>([])
  const [cerca, setCerca] = useState('')
  const [carregant, setCarregant] = useState(true)
  const [modalMassivaObert, setModalMassivaObert] = useState(false)
  const [modalIndividualObert, setModalIndividualObert] = useState(false)

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
    setModalMassivaObert(false)
    carregarAnimals(cerca)
  }

  function handleAltaIndividualCompletada() {
    setModalIndividualObert(false)
    carregarAnimals(cerca)
  }

  const potDonarAltaIndividual = rol === 'Admin' || rol === 'Veterinari'
  const potMoure = rol === 'Admin' || rol === 'Veterinari'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Animals</h1>
        <div className="flex gap-2">
          {potDonarAltaIndividual && (
            <button
              onClick={() => setModalIndividualObert(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300
                         hover:bg-gray-50 text-gray-700 font-medium rounded-lg min-h-[44px]"
            >
              <UserPlus size={18} aria-hidden="true" />
              Alta individual
            </button>
          )}
          {rol === 'Admin' && (
            <button
              onClick={() => setModalMassivaObert(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                         text-white font-medium rounded-lg min-h-[44px]"
            >
              <Plus size={18} aria-hidden="true" />
              Alta massiva
            </button>
          )}
        </div>
      </div>

      <TaulaAnimals
        animals={animals}
        cerca={cerca}
        onCercaChange={setCerca}
        carregant={carregant}
        potMoure={potMoure}
        onAnimalsMoguts={() => carregarAnimals(cerca)}
      />

      {modalMassivaObert && (
        <ModalAltaMassiva
          onTancar={() => setModalMassivaObert(false)}
          onImportacioCompletada={handleImportacioCompletada}
        />
      )}

      {modalIndividualObert && (
        <ModalAltaIndividual
          onTancar={() => setModalIndividualObert(false)}
          onAltaCompletada={handleAltaIndividualCompletada}
        />
      )}
    </div>
  )
}
