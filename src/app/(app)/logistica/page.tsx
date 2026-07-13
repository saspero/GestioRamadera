'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TaulaEstoc } from '@/components/logistica/TaulaEstoc'
import { ModalConsumMassiu } from '@/components/logistica/ModalConsumMassiu'
import { useSessio } from '@/lib/session/SessioContext'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { EstocMagatzemComplet } from '@/types/logistica'

/**
 * Pàgina del mòdul Logística: registre de Consums Massius i Control
 * d'Estoc de magatzems/sitges.
 *
 * @returns Pàgina amb botó de registrar consum i la taula d'estoc
 *
 * @remarks MIGRACIÓ REACT QUERY: l'estoc es carrega amb useQuery
 * (queryKeys.logistica.estoc). El toggle d'estat és ara una
 * useMutation pròpia que invalida la mateixa query i mostra un toast
 * (abans no en mostrava cap). ModalConsumMassiu ja invalida l'estoc
 * internament en registrar un consum.
 * @remarks Control d'accés: Admin i Treballador. Veterinari sense
 * accés en absolut (únic mòdul amb aquesta restricció total). El
 * toggle d'estat és exclusiu d'Admin.
 */
export default function LogisticaPage() {
  const { rol } = useSessio()
  const queryClient = useQueryClient()
  const potRegistrarConsum = rol === 'Admin' || rol === 'Treballador'
  const potGestionarEstat = rol === 'Admin'

  const [modalConsumObert, setModalConsumObert] = useState(false)

  const { data: estoc = [], isLoading } = useQuery<EstocMagatzemComplet[]>({
    queryKey: queryKeys.logistica.estoc,
    queryFn: () => fetch('/api/logistica/estoc').then((res) => res.json()).then((j) => j.estoc),
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

  // Si Veterinari accedeix directament per URL, el Sidebar ja no li
  // mostra l'enllaç, però per si hi arriba igualment, es mostra un
  // missatge clar en comptes d'una taula buida sense explicació.
  if (rol === 'Veterinari') {
    return (
      <div className="text-center py-16 text-gray-500">
        No tens accés a aquest mòdul.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Logística i Farratges</h1>
        {potRegistrarConsum && (
          <button
            onClick={() => setModalConsumObert(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700
                       text-white font-medium rounded-lg min-h-[44px]"
          >
            <Plus size={18} aria-hidden="true" />
            Registrar consum
          </button>
        )}
      </div>

      <TaulaEstoc
        estoc={estoc}
        carregant={isLoading}
        potGestionar={potGestionarEstat}
        onCanviarEstat={(item) => mutacioEstat.mutate(item)}
      />

      {modalConsumObert && (
        <ModalConsumMassiu
          onTancar={() => setModalConsumObert(false)}
          onRegistrat={() => setModalConsumObert(false)}
        />
      )}
    </div>
  )
}
