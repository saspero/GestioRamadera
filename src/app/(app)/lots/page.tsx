'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { LlistaLots } from '@/components/lots/LlistaLots'
import { ModalNouLot } from '@/components/lots/ModalNouLot'
import { ModalMoureAnimals } from '@/components/lots/ModalMoureAnimals'
import { useSessio } from '@/lib/session/SessioContext'
import { queryKeys } from '@/lib/query/queryKeys'
import type { LotResum } from '@/types/lots'

/**
 * Pàgina de gestió de Lots: llistat amb detall expandible d'animals
 * i moviment d'animals entre lots.
 *
 * @returns Pàgina amb llista de lots, creació de lots nous, i modal
 * de moviment d'animals
 *
 * @remarks MIGRACIÓ REACT QUERY: el llistat es carrega amb useQuery
 * (queryKeys.lots.llistat). ModalNouLot i ModalMoureAnimals ja fan
 * la seva pròpia useMutation amb invalidació de
 * queryKeys.lots.all/animals.all — aquesta pàgina no necessita
 * gestionar la recàrrega manualment (per això `onCreat`/`onMogut`
 * ara només tanquen el modal corresponent).
 * @remarks Control d'accés: lectura oberta als 3 rols; creació de
 * lots i moviment d'animals restringits a Admin i Veterinari
 * (docs/14_modul_lots.md). Aquesta comprovació és només visual.
 */
export default function LotsPage() {
  const { rol } = useSessio()
  const potEditar = rol === 'Admin' || rol === 'Veterinari'

  const { data: lots = [], isLoading } = useQuery<LotResum[]>({
    queryKey: queryKeys.lots.llistat,
    queryFn: () => fetch('/api/lots').then((res) => res.json()).then((json) => json.lots),
  })

  const [modalNouLotObert, setModalNouLotObert] = useState(false)
  const [moviment, setMoviment] = useState<{ animalId: number; lotOrigenId: number } | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Lots</h1>
        {potEditar && (
          <button
            onClick={() => setModalNouLotObert(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg min-h-[44px]"
          >
            <Plus size={18} aria-hidden="true" />
            Nou lot
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-gray-500 text-center py-10">Carregant...</p>
      ) : (
        <LlistaLots
          lots={lots}
          potEditar={potEditar}
          onMoureAnimal={(animalId, lotOrigenId) => setMoviment({ animalId, lotOrigenId })}
        />
      )}

      {modalNouLotObert && (
        <ModalNouLot
          onTancar={() => setModalNouLotObert(false)}
          onCreat={() => setModalNouLotObert(false)}
        />
      )}

      {moviment && (
        <ModalMoureAnimals
          animalIds={[moviment.animalId]}
          lotOrigenId={moviment.lotOrigenId}
          onTancar={() => setMoviment(null)}
          onMogut={() => setMoviment(null)}
        />
      )}
    </div>
  )
}
