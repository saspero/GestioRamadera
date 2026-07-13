'use client'

import { useState, useEffect } from 'react'
import { Plus, UserPlus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { TaulaAnimals } from '@/components/animals/TaulaAnimals'
import { ModalAltaMassiva } from '@/components/animals/ModalAltaMassiva'
import { ModalAltaIndividual } from '@/components/animals/ModalAltaIndividual'
import { useSessio } from '@/lib/session/SessioContext'
import { queryKeys } from '@/lib/query/queryKeys'
import type { AnimalActiu } from '@/types/db'

/**
 * Pàgina del llistat d'animals actius, amb cercador, alta massiva,
 * alta individual, i selecció múltiple per moure animals a un altre lot.
 *
 * @returns Pàgina d'animals amb taula, cercador i modals d'alta i moviment
 *
 * @remarks MIGRACIÓ REACT QUERY: el llistat es carrega amb useQuery
 * (queryKeys.animals.llistat(cercaDebounced)) en comptes de
 * fetch+useEffect+useState manual. El terme de cerca es debounça
 * 250ms abans d'entrar a la query key, exactament com abans, però
 * ara la petició es cancel·la/coalesceix automàticament si l'usuari
 * segueix escrivint (React Query ho gestiona sol). Totes les
 * mutacions dels components fills (altes, moviments, baixa) ja
 * invaliden queryKeys.animals.all internament — aquesta pàgina no
 * necessita cap callback manual de recàrrega.
 * @remarks Control d'accés: el llistat és visible per als 3 rols.
 * El botó d'alta massiva només per a Admin. El d'alta individual i
 * la selecció múltiple/moviment de lot per a Admin i Veterinari.
 * Aquesta comprovació és només visual — els endpoints tornen a
 * validar el rol igualment.
 */
export default function AnimalsPage() {
  const { rol } = useSessio()
  const [cerca, setCerca] = useState('')
  const [cercaDebounced, setCercaDebounced] = useState('')
  const [modalMassivaObert, setModalMassivaObert] = useState(false)
  const [modalIndividualObert, setModalIndividualObert] = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => setCercaDebounced(cerca), 250)
    return () => clearTimeout(timeout)
  }, [cerca])

  const { data: animals = [], isLoading } = useQuery<AnimalActiu[]>({
    queryKey: queryKeys.animals.llistat(cercaDebounced),
    queryFn: () => {
      const url = cercaDebounced
        ? `/api/animals?cerca=${encodeURIComponent(cercaDebounced)}`
        : '/api/animals'
      return fetch(url).then((res) => res.json()).then((json) => json.animals)
    },
  })

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
        carregant={isLoading}
        potMoure={potMoure}
        onAnimalsMoguts={() => {}}
      />

      {modalMassivaObert && (
        <ModalAltaMassiva
          onTancar={() => setModalMassivaObert(false)}
          onImportacioCompletada={() => setModalMassivaObert(false)}
        />
      )}

      {modalIndividualObert && (
        <ModalAltaIndividual
          onTancar={() => setModalIndividualObert(false)}
          onAltaCompletada={() => setModalIndividualObert(false)}
        />
      )}
    </div>
  )
}
