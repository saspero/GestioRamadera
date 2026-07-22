'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArbreInfraestructura } from '@/components/infraestructura/ArbreInfraestructura'
import { ModalGranja } from '@/components/infraestructura/ModalGranja'
import { ModalZona } from '@/components/infraestructura/ModalZona'
import { ModalCort } from '@/components/infraestructura/ModalCort'
import { useInfraestructura } from '@/hooks/useInfraestructura'
import { useSessio } from '@/lib/session/SessioContext'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { Ubicacio, ZonaInfraestructura, Cort } from '@/types/infraestructura'

type ModalObert =
  | { tipus: 'granja-nova' }
  | { tipus: 'granja-editar'; granja: Ubicacio }
  | { tipus: 'zona-nova'; ubicacioId: number }
  | { tipus: 'zona-editar'; zona: ZonaInfraestructura }
  | { tipus: 'cort-nova'; zonaId: number }
  | { tipus: 'cort-editar'; cort: Cort }
  | null

/**
 * Pàgina de gestió de Granges, Zones i Corts (infraestructura física).
 *
 * @returns Pàgina amb arbre jeràrquic Granja → Zona → Cort i modals
 * de creació/edició per a cadascun dels tres nivells
 *
 * @remarks Eliminació als tres nivells (juliol 2026): cada nivell es
 * bloqueja si no està buit — el missatge d'error del backend
 * (eliminarUbicacio/eliminarZona/eliminarCort a
 * src/lib/db/queries/infraestructura.ts) ja és prou clar per
 * mostrar-lo directament al toast, sense traduir-lo.
 * @remarks MIGRACIÓ REACT QUERY: useInfraestructura() ara només fa
 * la lectura (useQuery); cada modal de creació/edició fa la seva
 * pròpia mutació. Les mutacions d'eliminar viuen en aquesta pàgina
 * (no calia un modal propi — un `confirm()` simple n'hi ha prou,
 * mateix patró que l'eliminació de races a Configuració).
 * @remarks Control d'accés: lectura oberta als 3 rols. Els botons
 * de creació/edició/eliminació només per a Admin i Veterinari.
 * Aquesta comprovació és només visual: els endpoints tornen a
 * validar el rol igualment.
 */
export default function GranjaCortsPage() {
  const { rol } = useSessio()
  const potEditar = rol === 'Admin' || rol === 'Veterinari'
  const { ubicacions, carregant, error } = useInfraestructura()
  const queryClient = useQueryClient()

  const [modal, setModal] = useState<ModalObert>(null)

  function trobarGranja(id: number): Ubicacio | undefined {
    return ubicacions.find((u) => u.id === id)
  }

  const mutacioEliminarGranja = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/infraestructura/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Error en eliminar la granja')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.infraestructura.all })
      toastExit('Granja eliminada')
    },
    onError: (err) => toastError(err, 'Error en eliminar la granja'),
  })

  const mutacioEliminarZona = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/infraestructura/zones/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Error en eliminar la zona')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.infraestructura.all })
      toastExit('Zona eliminada')
    },
    onError: (err) => toastError(err, 'Error en eliminar la zona'),
  })

  const mutacioEliminarCort = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/infraestructura/corts/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Error en eliminar la cort')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.infraestructura.all })
      toastExit('Cort eliminada')
    },
    onError: (err) => toastError(err, 'Error en eliminar la cort'),
  })

  function handleEliminarGranja(granja: { id: number; nom: string }) {
    if (confirm(`Segur que vols eliminar la granja "${granja.nom}"?`)) {
      mutacioEliminarGranja.mutate(granja.id)
    }
  }

  function handleEliminarZona(zona: ZonaInfraestructura) {
    if (confirm(`Segur que vols eliminar la zona "${zona.nom}"?`)) {
      mutacioEliminarZona.mutate(zona.id)
    }
  }

  function handleEliminarCort(cort: Cort) {
    if (confirm(`Segur que vols eliminar la cort "${cort.codiCort}"?`)) {
      mutacioEliminarCort.mutate(cort.id)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Granja / Corts</h1>
        {potEditar && (
          <button
            onClick={() => setModal({ tipus: 'granja-nova' })}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg min-h-[44px]"
          >
            <Plus size={18} aria-hidden="true" />
            Nova granja
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}

      {carregant ? (
        <p className="text-gray-500 text-center py-10">Carregant...</p>
      ) : (
        <ArbreInfraestructura
          ubicacions={ubicacions}
          potEditar={potEditar}
          onEditarGranja={(id) => {
            const granja = trobarGranja(id)
            if (granja) setModal({ tipus: 'granja-editar', granja })
          }}
          onEliminarGranja={handleEliminarGranja}
          onNovaZona={(ubicacioId) => setModal({ tipus: 'zona-nova', ubicacioId })}
          onEditarZona={(zona) => setModal({ tipus: 'zona-editar', zona })}
          onEliminarZona={handleEliminarZona}
          onNovaCort={(zonaId) => setModal({ tipus: 'cort-nova', zonaId })}
          onEditarCort={(cort) => setModal({ tipus: 'cort-editar', cort })}
          onEliminarCort={handleEliminarCort}
        />
      )}

      {modal?.tipus === 'granja-nova' && (
        <ModalGranja onTancar={() => setModal(null)} onSalvat={() => setModal(null)} />
      )}

      {modal?.tipus === 'granja-editar' && (
        <ModalGranja
          granjaExistent={modal.granja}
          onTancar={() => setModal(null)}
          onSalvat={() => setModal(null)}
        />
      )}

      {modal?.tipus === 'zona-nova' && (
        <ModalZona
          ubicacioId={modal.ubicacioId}
          onTancar={() => setModal(null)}
          onSalvat={() => setModal(null)}
        />
      )}

      {modal?.tipus === 'zona-editar' && (
        <ModalZona
          ubicacioId={modal.zona.ubicacioId}
          zonaExistent={modal.zona}
          onTancar={() => setModal(null)}
          onSalvat={() => setModal(null)}
        />
      )}

      {modal?.tipus === 'cort-nova' && (
        <ModalCort
          zonaId={modal.zonaId}
          onTancar={() => setModal(null)}
          onSalvat={() => setModal(null)}
        />
      )}

      {modal?.tipus === 'cort-editar' && (
        <ModalCort
          zonaId={modal.cort.zonaId}
          cortExistent={modal.cort}
          onTancar={() => setModal(null)}
          onSalvat={() => setModal(null)}
        />
      )}
    </div>
  )
}
