'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { LlistaLots } from '@/components/lots/LlistaLots'
import { ModalNouLot } from '@/components/lots/ModalNouLot'
import { ModalMoureAnimals } from '@/components/lots/ModalMoureAnimals'
import { useSessio } from '@/lib/session/SessioContext'
import type { LotResum } from '@/types/lots'

/**
 * Pàgina de gestió de Lots: llistat amb detall expandible d'animals
 * i moviment d'animals entre lots.
 *
 * @returns Pàgina amb llista de lots, creació de lots nous, i modal
 * de moviment d'animals
 *
 * @remarks Control d'accés: lectura oberta als 3 rols; creació de
 * lots i moviment d'animals restringits a Admin i Veterinari
 * (docs/14_modul_lots.md). Aquesta comprovació és només visual —
 * els endpoints tornen a validar el rol igualment.
 * @remarks Multitenancy: no toca la BD directament; tota la lectura
 * i escriptura passa pels endpoints /api/lots/*, aïllats via
 * search_path del tenant.
 */
export default function LotsPage() {
  const { rol } = useSessio()
  const potEditar = rol === 'Admin' || rol === 'Veterinari'

  const [lots, setLots] = useState<LotResum[]>([])
  const [carregant, setCarregant] = useState(true)
  const [modalNouLotObert, setModalNouLotObert] = useState(false)
  const [moviment, setMoviment] = useState<{ animalId: number; lotOrigenId: number } | null>(null)

  const carregarLots = useCallback(async () => {
    setCarregant(true)
    try {
      const res = await fetch('/api/lots')
      if (res.ok) {
        const json = await res.json()
        setLots(json.lots)
      }
    } finally {
      setCarregant(false)
    }
  }, [])

  useEffect(() => {
    carregarLots()
  }, [carregarLots])

  async function handleCrearLot(nomLot: string) {
    const res = await fetch('/api/lots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nomLot }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Error en crear el lot')
    await carregarLots()
  }

  function handleMogut() {
    setMoviment(null)
    carregarLots()
  }

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

      {carregant ? (
        <p className="text-gray-500 text-center py-10">Carregant...</p>
      ) : (
        <LlistaLots
          lots={lots}
          potEditar={potEditar}
          onMoureAnimal={(animalId, lotOrigenId) => setMoviment({ animalId, lotOrigenId })}
        />
      )}

      {modalNouLotObert && (
        <ModalNouLot onTancar={() => setModalNouLotObert(false)} onDesar={handleCrearLot} />
      )}

      {moviment && (
        <ModalMoureAnimals
          animalIds={[moviment.animalId]}
          lotOrigenId={moviment.lotOrigenId}
          onTancar={() => setMoviment(null)}
          onMogut={handleMogut}
        />
      )}
    </div>
  )
}
