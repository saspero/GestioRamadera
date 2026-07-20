'use client'

import { useState } from 'react'
import { Plus, Upload, Syringe } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TaulaMedicaments } from '@/components/sanitari/TaulaMedicaments'
import { TaulaMedicamentsCataleg } from '@/components/sanitari/TaulaMedicamentsCataleg'
import { TaulaTractaments } from '@/components/sanitari/TaulaTractaments'
import { ModalNouMedicament } from '@/components/sanitari/ModalNouMedicament'
import { ModalAfegirEntradaMedicament } from '@/components/sanitari/ModalAfegirEntradaMedicament'
import { ModalImportarMedicaments } from '@/components/sanitari/ModalImportarMedicaments'
import { ModalAplicarTractament } from '@/components/sanitari/ModalAplicarTractament'
import { ModalEditarTractament } from '@/components/sanitari/ModalEditarTractament'
import { ModalEliminarTractament } from '@/components/sanitari/ModalEliminarTractament'
import { useSessio } from '@/lib/session/SessioContext'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { Medicament, MedicamentCataleg, TractamentAmbMedicament } from '@/types/sanitari'

type Vista = 'inventari' | 'cataleg' | 'tractaments'

/**
 * Pàgina del mòdul Sanitari: estoc de medicaments (amb entrades
 * individuals, edició, eliminació i importació CSV), catàleg de
 * medicaments (amb edició i eliminació), i tractaments aplicats
 * (amb edició i eliminació).
 *
 * @returns Pàgina amb selector de vista i les taules corresponents
 *
 * @remarks Model d'estoc (juliol 2026, migració
 * 13_migracio_estoc_unitats_medicaments.sql): l'estoc total es
 * calcula com nombre d'unitats × quantitat per unitat, ja no
 * s'introdueix a mà.
 * @remarks Eliminació d'entrades i de medicaments del catàleg
 * (juliol 2026): totes dues delegen en un `window.confirm()` simple
 * abans de cridar l'endpoint (mateix patró que l'eliminació de
 * races a Configuració) — si hi ha dependències (tractaments que
 * referencien una entrada, o entrades que referencien un catàleg),
 * l'endpoint ho rebutja amb un 409 i un missatge clar.
 * @remarks Control d'accés: lectura oberta als 3 rols. Les accions
 * d'escriptura només per a Admin i Veterinari.
 */
export default function SanitariPage() {
  const { rol } = useSessio()
  const potEditar = rol === 'Admin' || rol === 'Veterinari'
  const queryClient = useQueryClient()

  const [vista, setVista] = useState<Vista>('inventari')
  const [modalNouMedicamentObert, setModalNouMedicamentObert] = useState(false)
  const [medicamentCatalegEditar, setMedicamentCatalegEditar] = useState<MedicamentCataleg | null>(null)
  const [modalAfegirEntradaObert, setModalAfegirEntradaObert] = useState(false)
  const [medicamentEditar, setMedicamentEditar] = useState<Medicament | null>(null)
  const [modalImportarObert, setModalImportarObert] = useState(false)
  const [modalTractamentObert, setModalTractamentObert] = useState(false)
  const [tractamentEditar, setTractamentEditar] = useState<TractamentAmbMedicament | null>(null)
  const [tractamentEliminar, setTractamentEliminar] = useState<TractamentAmbMedicament | null>(null)

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

  const mutacioEliminarEntrada = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sanitari/medicaments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Error en eliminar l\'entrada')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.medicaments })
      toastExit('Entrada eliminada')
    },
    onError: (err) => toastError(err, 'Error en eliminar l\'entrada'),
  })

  const mutacioEliminarCataleg = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/sanitari/medicaments-cataleg/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Error en eliminar el medicament')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.medicamentsCataleg })
      toastExit('Medicament eliminat del catàleg')
    },
    onError: (err) => toastError(err, 'Error en eliminar el medicament'),
  })

  function handleEliminarEntrada(m: Medicament) {
    if (confirm(`Segur que vols eliminar l'entrada de lot "${m.lot}" (${m.nomMedicament})?`)) {
      mutacioEliminarEntrada.mutate(m.id)
    }
  }

  function handleEliminarCataleg(m: MedicamentCataleg) {
    if (confirm(`Segur que vols eliminar "${m.nomMedicament}" del catàleg?`)) {
      mutacioEliminarCataleg.mutate(m.id)
    }
  }

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
        <TaulaMedicaments
          medicaments={medicaments}
          carregant={carregantMedicaments}
          potEditar={potEditar}
          onEditar={(m) => setMedicamentEditar(m)}
          onEliminar={handleEliminarEntrada}
        />
      )}
      {vista === 'cataleg' && (
        <TaulaMedicamentsCataleg
          medicamentsCataleg={medicamentsCataleg}
          carregant={carregantCataleg}
          potEditar={potEditar}
          onEditar={(m) => setMedicamentCatalegEditar(m)}
          onEliminar={handleEliminarCataleg}
        />
      )}
      {vista === 'tractaments' && (
        <TaulaTractaments
          tractaments={tractaments}
          carregant={carregantTractaments}
          potEditar={potEditar}
          onEditar={(t) => setTractamentEditar(t)}
          onEliminar={(t) => setTractamentEliminar(t)}
        />
      )}

      {modalNouMedicamentObert && (
        <ModalNouMedicament
          onTancar={() => setModalNouMedicamentObert(false)}
          onDesat={() => setModalNouMedicamentObert(false)}
        />
      )}

      {medicamentCatalegEditar && (
        <ModalNouMedicament
          medicamentExistent={medicamentCatalegEditar}
          onTancar={() => setMedicamentCatalegEditar(null)}
          onDesat={() => setMedicamentCatalegEditar(null)}
        />
      )}

      {modalAfegirEntradaObert && (
        <ModalAfegirEntradaMedicament
          onTancar={() => setModalAfegirEntradaObert(false)}
          onDesat={() => setModalAfegirEntradaObert(false)}
        />
      )}

      {medicamentEditar && (
        <ModalAfegirEntradaMedicament
          entradaExistent={medicamentEditar}
          onTancar={() => setMedicamentEditar(null)}
          onDesat={() => setMedicamentEditar(null)}
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

      {tractamentEditar && (
        <ModalEditarTractament
          tractament={tractamentEditar}
          onTancar={() => setTractamentEditar(null)}
          onDesat={() => setTractamentEditar(null)}
        />
      )}

      {tractamentEliminar && (
        <ModalEliminarTractament
          tractament={tractamentEliminar}
          onTancar={() => setTractamentEliminar(null)}
          onEliminat={() => setTractamentEliminar(null)}
        />
      )}
    </div>
  )
}
