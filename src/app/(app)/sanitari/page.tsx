'use client'

import { useState } from 'react'
import { Plus, Upload, Syringe } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { TaulaMedicaments } from '@/components/sanitari/TaulaMedicaments'
import { TaulaMedicamentsCataleg } from '@/components/sanitari/TaulaMedicamentsCataleg'
import { TaulaTractaments } from '@/components/sanitari/TaulaTractaments'
import { ModalNouMedicament } from '@/components/sanitari/ModalNouMedicament'
import { ModalAfegirEntradaMedicament } from '@/components/sanitari/ModalAfegirEntradaMedicament'
import { ModalImportarMedicaments } from '@/components/sanitari/ModalImportarMedicaments'
import { ModalAplicarTractament } from '@/components/sanitari/ModalAplicarTractament'
import { useSessio } from '@/lib/session/SessioContext'
import { queryKeys } from '@/lib/query/queryKeys'
import type { Medicament, MedicamentCataleg, TractamentAmbMedicament } from '@/types/sanitari'

type Vista = 'inventari' | 'cataleg' | 'tractaments'

/**
 * Pàgina del mòdul Sanitari: estoc de medicaments (amb entrades
 * individuals i importació CSV), catàleg de medicaments (dades
 * mestres), i tractaments aplicats.
 *
 * @returns Pàgina amb selector de vista i les taules corresponents
 *
 * @remarks Catàleg separat de l'estoc (juliol 2026, migració
 * 10_migracio_cataleg_medicaments.sql, mateix patró que "Tipus de
 * Pinso" a Magatzems): "Nou medicament" (pestanya Catàleg) crea
 * només les dades mestres; "Afegir entrada" (pestanya Magatzem
 * sanitari) hi referencia un medicament ja existent al catàleg i
 * en registra una compra/lot concrets.
 * @remarks Control d'accés: lectura oberta als 3 rols. Les accions
 * d'escriptura només per a Admin i Veterinari.
 */
export default function SanitariPage() {
  const { rol } = useSessio()
  const potEditar = rol === 'Admin' || rol === 'Veterinari'

  const [vista, setVista] = useState<Vista>('inventari')
  const [modalNouMedicamentObert, setModalNouMedicamentObert] = useState(false)
  const [modalAfegirEntradaObert, setModalAfegirEntradaObert] = useState(false)
  const [modalImportarObert, setModalImportarObert] = useState(false)
  const [modalTractamentObert, setModalTractamentObert] = useState(false)

  const { data: medicaments = [], isLoading: carregantMedicaments } = useQuery<Medicament[]>({
    queryKey: queryKeys.sanitari.medicaments,
    queryFn: () => fetch('/api/sanitari/medicaments').then((res) => res.json()).then((j) => j.medicaments),
    enabled: vista === 'inventari',
  })

  const { data: medicamentsCataleg = [], isLoading: carregantCataleg } = useQuery<MedicamentCataleg[]>({
    queryKey: queryKeys.sanitari.medicamentsCataleg,
    queryFn: () =>
      fetch('/api/sanitari/medicaments-cataleg').then((res) => res.json()).then((j) => j.medicamentsCataleg),
    enabled: vista === 'cataleg',
  })

  const { data: tractaments = [], isLoading: carregantTractaments } = useQuery<TractamentAmbMedicament[]>({
    queryKey: queryKeys.sanitari.tractaments,
    queryFn: () => fetch('/api/sanitari/tractaments').then((res) => res.json()).then((j) => j.tractaments),
    enabled: vista === 'tractaments',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Sanitari</h1>
        {potEditar && (
          <div className="flex gap-2">
            {vista === 'inventari' && (
              <>
                <button
                  onClick={() => setModalImportarObert(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300
                             hover:bg-gray-50 text-gray-700 font-medium rounded-lg min-h-[44px]"
                >
                  <Upload size={18} aria-hidden="true" />
                  Carregar CSV
                </button>
                <button
                  onClick={() => setModalAfegirEntradaObert(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                             text-white font-medium rounded-lg min-h-[44px]"
                >
                  <Plus size={18} aria-hidden="true" />
                  Afegir entrada
                </button>
              </>
            )}
            {vista === 'cataleg' && (
              <button
                onClick={() => setModalNouMedicamentObert(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                           text-white font-medium rounded-lg min-h-[44px]"
              >
                <Plus size={18} aria-hidden="true" />
                Nou medicament
              </button>
            )}
            {vista === 'tractaments' && (
              <button
                onClick={() => setModalTractamentObert(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                           text-white font-medium rounded-lg min-h-[44px]"
              >
                <Syringe size={18} aria-hidden="true" />
                Aplicar tractament
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setVista('inventari')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'inventari' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Magatzem sanitari
        </button>
        <button
          onClick={() => setVista('cataleg')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'cataleg' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Catàleg
        </button>
        <button
          onClick={() => setVista('tractaments')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'tractaments' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Tractaments
        </button>
      </div>

      {vista === 'inventari' && (
        <TaulaMedicaments medicaments={medicaments} carregant={carregantMedicaments} />
      )}
      {vista === 'cataleg' && (
        <TaulaMedicamentsCataleg medicamentsCataleg={medicamentsCataleg} carregant={carregantCataleg} />
      )}
      {vista === 'tractaments' && (
        <TaulaTractaments tractaments={tractaments} carregant={carregantTractaments} />
      )}

      {modalNouMedicamentObert && (
        <ModalNouMedicament
          onTancar={() => setModalNouMedicamentObert(false)}
          onDesat={() => setModalNouMedicamentObert(false)}
        />
      )}

      {modalAfegirEntradaObert && (
        <ModalAfegirEntradaMedicament
          onTancar={() => setModalAfegirEntradaObert(false)}
          onDesat={() => setModalAfegirEntradaObert(false)}
        />
      )}

      {modalImportarObert && (
        <ModalImportarMedicaments
          onTancar={() => setModalImportarObert(false)}
          onImportacioCompletada={() => setModalImportarObert(false)}
        />
      )}

      {modalTractamentObert && (
        <ModalAplicarTractament
          onTancar={() => setModalTractamentObert(false)}
          onAplicat={() => setModalTractamentObert(false)}
        />
      )}
    </div>
  )
}
