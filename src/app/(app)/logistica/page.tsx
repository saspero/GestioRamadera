'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { TaulaEstoc } from '@/components/logistica/TaulaEstoc'
import { ModalConsumMassiu } from '@/components/logistica/ModalConsumMassiu'
import { useSessio } from '@/lib/session/SessioContext'
import type { EstocMagatzemComplet } from '@/types/logistica'

/**
 * Pàgina del mòdul Logística: registre de Consums Massius i Control
 * d'Estoc de magatzems/sitges.
 *
 * @returns Pàgina amb botó de registrar consum i la taula d'estoc
 *
 * @remarks Control d'accés: Admin i Treballador. Veterinari sense
 * accés en absolut (docs/09_modul_logistica_farratges.md, secció 1
 * — únic mòdul on es manté aquesta restricció total, a diferència de
 * la resta de mòduls on s'ha ampliat a "només lectura"). El toggle
 * d'estat dels magatzems és exclusiu d'Admin.
 * @remarks Multitenancy: no toca la BD directament; tota la lectura
 * passa pels endpoints /api/logistica/*, aïllats via search_path
 * del tenant.
 */
export default function LogisticaPage() {
  const { rol } = useSessio()
  const potRegistrarConsum = rol === 'Admin' || rol === 'Treballador'
  const potGestionarEstat = rol === 'Admin'

  const [estoc, setEstoc] = useState<EstocMagatzemComplet[]>([])
  const [carregant, setCarregant] = useState(true)
  const [modalConsumObert, setModalConsumObert] = useState(false)

  const carregarEstoc = useCallback(async () => {
    setCarregant(true)
    try {
      const res = await fetch('/api/logistica/estoc')
      if (res.ok) setEstoc((await res.json()).estoc)
    } finally {
      setCarregant(false)
    }
  }, [])

  useEffect(() => {
    carregarEstoc()
  }, [carregarEstoc])

  function handleConsumRegistrat() {
    setModalConsumObert(false)
    carregarEstoc()
  }

  async function handleCanviarEstat(item: EstocMagatzemComplet) {
    const nouEstat = item.estat === 'Actiu' ? 'Deshabilitat' : 'Actiu'
    await fetch(`/api/logistica/estoc/${item.tipus}/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipus: item.tipus, estat: nouEstat }),
    })
    carregarEstoc()
  }

  // Si Veterinari accedeix directament per URL, el Sidebar ja no li
  // mostra l'enllaç (docs/09_modul_logistica_farratges.md, secció 1),
  // però per si hi arriba igualment, es mostra un missatge clar en
  // comptes d'una taula buida sense explicació.
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
        carregant={carregant}
        potGestionar={potGestionarEstat}
        onCanviarEstat={handleCanviarEstat}
      />

      {modalConsumObert && (
        <ModalConsumMassiu
          onTancar={() => setModalConsumObert(false)}
          onRegistrat={handleConsumRegistrat}
        />
      )}
    </div>
  )
}
