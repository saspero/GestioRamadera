'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { TaulaUsuaris } from '@/components/configuracio/TaulaUsuaris'
import { ModalNouUsuari } from '@/components/configuracio/ModalNouUsuari'
import { ModalEditarUsuari } from '@/components/configuracio/ModalEditarUsuari'
import { ModalCanviarContrasenya } from '@/components/configuracio/ModalCanviarContrasenya'
import { TaulaRaces } from '@/components/configuracio/TaulaRaces'
import { ModalNovaRaca } from '@/components/configuracio/ModalNovaRaca'
import { FormConfiguracioGeneral } from '@/components/configuracio/FormConfiguracioGeneral'
import { useSessio } from '@/lib/session/SessioContext'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import type { UsuariTenant, RacaCataleg } from '@/types/configuracio'

type Vista = 'usuaris' | 'races' | 'general'

/**
 * Pàgina del mòdul Configuració: Gestió d'Usuaris, Catàleg de Races
 * i Configuració General (llindars d'estoc per defecte).
 *
 * @returns Pàgina amb selector de vista i el contingut de cada pestanya
 *
 * @remarks Mòdul exclusiu d'Admin (docs original: "Permet al ramader
 * gestionar l'accés dels treballadors i afegir noves races
 * personalitzades"). menuItems.ts ja restringeix la visibilitat al
 * Sidebar; aquí es fa una comprovació addicional per si s'hi arribés
 * directament per URL.
 * @remarks El Catàleg de Tipus de Pinso es manté a Logística (no
 * s'ha mogut aquí) — decisió confirmada amb l'usuari, ja que està
 * més lligat operativament a la gestió de sitges que a aquest mòdul.
 */
export default function ConfiguracioPage() {
  const { rol } = useSessio()
  const queryClient = useQueryClient()

  const [vista, setVista] = useState<Vista>('usuaris')
  const [modalNouUsuariObert, setModalNouUsuariObert] = useState(false)
  const [usuariEditar, setUsuariEditar] = useState<UsuariTenant | null>(null)
  const [usuariContrasenya, setUsuariContrasenya] = useState<UsuariTenant | null>(null)
  const [modalNovaRacaObert, setModalNovaRacaObert] = useState(false)

  const { data: usuariActual } = useQuery<{ userId: number }>({
    queryKey: ['auth', 'me'],
    queryFn: () => fetch('/api/auth/me').then((res) => res.json()),
  })

  const { data: usuaris = [], isLoading: carregantUsuaris } = useQuery<UsuariTenant[]>({
    queryKey: queryKeys.configuracio.usuaris,
    queryFn: () => fetch('/api/configuracio/usuaris').then((res) => res.json()).then((j) => j.usuaris),
    enabled: vista === 'usuaris',
  })

  const { data: races = [], isLoading: carregantRaces } = useQuery<RacaCataleg[]>({
    queryKey: queryKeys.configuracio.races,
    queryFn: () => fetch('/api/configuracio/races').then((res) => res.json()).then((j) => j.races),
    enabled: vista === 'races',
  })

  const mutacioEliminarRaca = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/configuracio/races/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error ?? 'Error en eliminar la raça')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configuracio.races })
      toastExit('Raça eliminada')
    },
    onError: (err) => toastError(err, 'Error en eliminar la raça'),
  })

  function handleEliminarRaca(raca: RacaCataleg) {
    if (confirm(`Segur que vols eliminar la raça "${raca.nomRaca}"?`)) {
      mutacioEliminarRaca.mutate(raca.id)
    }
  }

  if (rol !== 'Admin') {
    return (
      <div className="text-center py-16 text-gray-500">
        No tens accés a aquest mòdul.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Configuració</h1>
        {vista === 'usuaris' && (
          <button
            onClick={() => setModalNouUsuariObert(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg min-h-[44px]"
          >
            <Plus size={18} aria-hidden="true" />
            Nou usuari
          </button>
        )}
        {vista === 'races' && (
          <button
            onClick={() => setModalNovaRacaObert(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg min-h-[44px]"
          >
            <Plus size={18} aria-hidden="true" />
            Nova raça
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setVista('usuaris')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'usuaris' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Usuaris
        </button>
        <button
          onClick={() => setVista('races')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'races' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Races
        </button>
        <button
          onClick={() => setVista('general')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${vista === 'general' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          General
        </button>
      </div>

      {vista === 'usuaris' && (
        <TaulaUsuaris
          usuaris={usuaris}
          carregant={carregantUsuaris}
          usuariActualId={usuariActual?.userId ?? -1}
          onEditar={(u) => setUsuariEditar(u)}
          onCanviarContrasenya={(u) => setUsuariContrasenya(u)}
        />
      )}

      {vista === 'races' && (
        <TaulaRaces races={races} carregant={carregantRaces} onEliminar={handleEliminarRaca} />
      )}

      {vista === 'general' && <FormConfiguracioGeneral />}

      {modalNouUsuariObert && (
        <ModalNouUsuari
          onTancar={() => setModalNouUsuariObert(false)}
          onCreat={() => setModalNouUsuariObert(false)}
        />
      )}

      {usuariEditar && (
        <ModalEditarUsuari
          usuari={usuariEditar}
          esUnMateix={usuariEditar.id === usuariActual?.userId}
          onTancar={() => setUsuariEditar(null)}
          onDesat={() => setUsuariEditar(null)}
        />
      )}

      {usuariContrasenya && (
        <ModalCanviarContrasenya
          usuariId={usuariContrasenya.id}
          usuariEmail={usuariContrasenya.email}
          onTancar={() => setUsuariContrasenya(null)}
          onCanviada={() => setUsuariContrasenya(null)}
        />
      )}

      {modalNovaRacaObert && (
        <ModalNovaRaca
          onTancar={() => setModalNovaRacaObert(false)}
          onCreada={() => setModalNovaRacaObert(false)}
        />
      )}
    </div>
  )
}
