'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TaulaEstoc } from '@/components/logistica/TaulaEstoc'
import { TaulaSitgesMagatzems } from '@/components/logistica/TaulaSitgesMagatzems'
import { TaulaTipusPinso } from '@/components/logistica/TaulaTipusPinso'
import { ModalConsumMassiu } from '@/components/logistica/ModalConsumMassiu'
import { ModalSitja } from '@/components/logistica/ModalSitja'
import { ModalMagatzem } from '@/components/logistica/ModalMagatzem'
import { ModalTipusPinso } from '@/components/logistica/ModalTipusPinso'
import { useSessio } from '@/lib/session/SessioContext'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { EstocMagatzemComplet, Sitja, MagatzemFarratge, TipusPinso } from '@/types/logistica'

type Vista = 'estoc' | 'magatzems' | 'pinsos'

/**
 * Pàgina del mòdul Logística: Control d'Estoc, gestió de Magatzems
 * (sitges + magatzems de farratge) i catàleg de Tipus de Pinso.
 *
 * @returns Pàgina amb selector de vista i les taules/modals corresponents
 *
 * @remarks Secció "Magatzems" i "Tipus de pinso" afegides per resoldre
 * un buit real: fins ara no existia cap interfície per crear sitges
 * ni magatzems de farratge — el desplegable d'Origen del formulari
 * de Consums Massius quedava sempre buit perquè aquestes taules
 * només es podien omplir manualment per SQL.
 * @remarks El desplegable de Destí de ModalConsumMassiu ja filtra
 * per NAU_ANIMALS i PASTURA (bug corregit — abans mostrava també
 * COBERT_EMMAGATZEMATGE, que no consumeix aliment).
 * @remarks Control d'accés: Admin i Treballador. Veterinari sense
 * accés en absolut a tot el mòdul. El toggle d'estat a Control
 * d'Estoc segueix sent exclusiu d'Admin; la gestió de
 * magatzems/sitges/pinsos és Admin i Treballador (decisió confirmada).
 */
export default function LogisticaPage() {
  const { rol } = useSessio()
  const queryClient = useQueryClient()
  const potGestionar = rol === 'Admin' || rol === 'Treballador'
  const potGestionarEstatEstoc = rol === 'Admin'

  const [vista, setVista] = useState<Vista>('estoc')
  const [modalConsumObert, setModalConsumObert] = useState(false)
  const [modalSitja, setModalSitja] = useState<{ existent?: Sitja } | null>(null)
  const [modalMagatzem, setModalMagatzem] = useState<{ existent?: MagatzemFarratge } | null>(null)
  const [modalTipusPinso, setModalTipusPinso] = useState<{ existent?: TipusPinso } | null>(null)

  const { data: estoc = [], isLoading: carregantEstoc } = useQuery<EstocMagatzemComplet[]>({
    queryKey: queryKeys.logistica.estoc,
    queryFn: () => fetch('/api/logistica/estoc').then((res) => res.json()).then((j) => j.estoc),
    enabled: vista === 'estoc',
  })

  const { data: sitges = [], isLoading: carregantSitges } = useQuery<Sitja[]>({
    queryKey: queryKeys.logistica.sitges,
    queryFn: () => fetch('/api/logistica/sitges').then((res) => res.json()).then((j) => j.sitges),
    enabled: vista === 'magatzems',
  })
  const { data: magatzems = [], isLoading: carregantMagatzems } = useQuery<MagatzemFarratge[]>({
    queryKey: queryKeys.logistica.magatzems,
    queryFn: () => fetch('/api/logistica/magatzems').then((res) => res.json()).then((j) => j.magatzems),
    enabled: vista === 'magatzems',
  })

  const { data: tipusPinso = [], isLoading: carregantPinsos } = useQuery<TipusPinso[]>({
    queryKey: queryKeys.logistica.tipusPinso,
    queryFn: () => fetch('/api/logistica/tipus-pinso').then((res) => res.json()).then((j) => j.tipusPinso),
    enabled: vista === 'pinsos',
  })

  const mutacioEstat = useMutation({
    mutationFn: async (item: EstocMagatzemComplet) => {
      const nouEstat = item.estat === 'Actiu' ? 'Deshabilitat' : 'Actiu'
      const res = await fetch(`/api/logistica/estoc/${item.tipus}/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipus: item.tipus, estat: nouEstat }),
      })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Error en canviar l\'estat')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.estoc })
      toastExit('Estat actualitzat')
    },
    onError: (err) => toastError(err, 'Error en canviar l\'estat'),
  })

  if (rol === 'Veterinari') {
    return (
      <div className="text-center py-16 text-gray-500">
        No tens accés a aquest mòdul.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Logística i Farratges</h1>
        {potGestionar && vista === 'estoc' && (
          <button
            onClick={() => setModalConsumObert(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg min-h-[44px]"
          >
            <Plus size={18} aria-hidden="true" />
            Registrar consum
          </button>
        )}
        {potGestionar && vista === 'magatzems' && (
          <div className="flex gap-2">
            <button
              onClick={() => setModalSitja({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300
                         hover:bg-gray-50 text-gray-700 font-medium rounded-lg min-h-[44px]"
            >
              <Plus size={18} aria-hidden="true" />
              Nova sitja
            </button>
            <button
              onClick={() => setModalMagatzem({})}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                         text-white font-medium rounded-lg min-h-[44px]"
            >
              <Plus size={18} aria-hidden="true" />
              Nou magatzem
            </button>
          </div>
        )}
        {potGestionar && vista === 'pinsos' && (
          <button
            onClick={() => setModalTipusPinso({})}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg min-h-[44px]"
          >
            <Plus size={18} aria-hidden="true" />
            Nou tipus de pinso
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setVista('estoc')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'estoc' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Control d&apos;estoc
        </button>
        <button
          onClick={() => setVista('magatzems')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'magatzems' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Magatzems
        </button>
        <button
          onClick={() => setVista('pinsos')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'pinsos' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Tipus de pinso
        </button>
      </div>

      {vista === 'estoc' && (
        <TaulaEstoc
          estoc={estoc}
          carregant={carregantEstoc}
          potGestionar={potGestionarEstatEstoc}
          onCanviarEstat={(item) => mutacioEstat.mutate(item)}
        />
      )}

      {vista === 'magatzems' && (
        <TaulaSitgesMagatzems
          sitges={sitges}
          magatzems={magatzems}
          carregant={carregantSitges || carregantMagatzems}
          onEditarSitja={(s) => setModalSitja({ existent: s })}
          onEditarMagatzem={(m) => setModalMagatzem({ existent: m })}
        />
      )}

      {vista === 'pinsos' && (
        <TaulaTipusPinso
          tipusPinso={tipusPinso}
          carregant={carregantPinsos}
          onEditar={(t) => setModalTipusPinso({ existent: t })}
        />
      )}

      {modalConsumObert && (
        <ModalConsumMassiu
          onTancar={() => setModalConsumObert(false)}
          onRegistrat={() => setModalConsumObert(false)}
        />
      )}

      {modalSitja && (
        <ModalSitja
          sitjaExistent={modalSitja.existent}
          onTancar={() => setModalSitja(null)}
          onSalvat={() => setModalSitja(null)}
        />
      )}

      {modalMagatzem && (
        <ModalMagatzem
          magatzemExistent={modalMagatzem.existent}
          onTancar={() => setModalMagatzem(null)}
          onSalvat={() => setModalMagatzem(null)}
        />
      )}

      {modalTipusPinso && (
        <ModalTipusPinso
          tipusExistent={modalTipusPinso.existent}
          onTancar={() => setModalTipusPinso(null)}
          onSalvat={() => setModalTipusPinso(null)}
        />
      )}
    </div>
  )
}
