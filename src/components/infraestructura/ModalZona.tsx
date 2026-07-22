'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { ZonaInfraestructura, TipusZona } from '@/types/infraestructura'

type ModalZonaProps = {
  /** Ubicació on es crearà la zona (obligatori en mode creació). */
  ubicacioId: number
  /** Si s'informa, el modal edita aquesta zona; si no, en crea una de nova. */
  zonaExistent?: ZonaInfraestructura
  onTancar: () => void
  onSalvat: () => void
}

const ETIQUETES_TIPUS: Record<TipusZona, string> = {
  NAU_ANIMALS: 'Nau d\'animals',
  COBERT_EMMAGATZEMATGE: 'Cobert d\'emmagatzematge',
  PASTURA: 'Pastura',
}

/**
 * Opcions seleccionables en CREAR una zona nova (juliol 2026,
 * decisió confirmada amb l'usuari): "Cobert d'emmagatzematge" ja no
 * es crea des d'aquí — els magatzems es creen directament des de
 * Magatzems, sense passar per cap zona intermèdia. ETIQUETES_TIPUS
 * es manté amb les 3 entrades perquè encara cal poder mostrar
 * correctament el nom d'una zona d'aquest tipus ja existent (vegeu
 * el `<select>` més avall).
 */
const OPCIONS_CREACIO: TipusZona[] = ['NAU_ANIMALS', 'PASTURA']

/**
 * Modal de creació/edició d'una Zona dins d'una Granja.
 *
 * @param props.ubicacioId - Granja on es crearà la zona
 * @param props.zonaExistent - Si es passa, el formulari s'omple amb
 * les seves dades i actua en mode edició (el tipus queda bloquejat)
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onSalvat - Callback en confirmar amb èxit
 * @returns Modal amb formulari de nom i tipus de zona
 *
 * @remarks "Cobert d'emmagatzematge" ja no és una opció en crear
 * una zona nova (juliol 2026, decisió confirmada amb l'usuari) —
 * els magatzems es creen directament des de Magatzems. Una zona
 * d'aquest tipus creada abans del canvi segueix mostrant-se
 * correctament en mode edició (tot i que el tipus ja no es pot
 * canviar mai, com sempre).
 *
 * @remarks MIGRACIÓ REACT QUERY: useMutation pròpia (POST si és nova,
 * PATCH si `zonaExistent`), invalida queryKeys.infraestructura.all.
 * @remarks El tipus de zona NO es pot canviar en mode edició (veure
 * src/lib/db/queries/infraestructura.ts, actualitzarZona).
 * @remarks Control d'accés: aquest component només es munta des de
 * la pàgina de Granja/Corts quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalZona({ ubicacioId, zonaExistent, onTancar, onSalvat }: ModalZonaProps) {
  const queryClient = useQueryClient()
  const [nom, setNom] = useState(zonaExistent?.nom ?? '')
  const [tipusZona, setTipusZona] = useState<TipusZona>(zonaExistent?.tipusZona ?? 'NAU_ANIMALS')

  const mutacio = useMutation({
    mutationFn: async () => {
      const url = zonaExistent
        ? `/api/infraestructura/zones/${zonaExistent.id}`
        : '/api/infraestructura/zones'
      const body = zonaExistent
        ? { nom: nom.trim() }
        : { ubicacioId, nom: nom.trim(), tipusZona }
      const res = await fetch(url, {
        method: zonaExistent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar la zona')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.infraestructura.all })
      toastExit(zonaExistent ? 'Zona actualitzada' : 'Zona creada correctament')
      onSalvat()
    },
    onError: (err) => toastError(err, 'Error en desar la zona'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Desar"
      enviant={mutacio.isPending}
      disabled={!nom.trim()}
    />
  )

  return (
    <Modal titol={zonaExistent ? 'Editar zona' : 'Nova zona'} onTancar={onTancar} mida="sm" peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (nom.trim()) mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipus de zona *
            {zonaExistent && (
              <span className="font-normal text-gray-400"> (no es pot canviar un cop creada)</span>
            )}
          </label>
          <select
            value={tipusZona}
            onChange={(e) => setTipusZona(e.target.value as TipusZona)}
            disabled={mutacio.isPending || !!zonaExistent}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base disabled:bg-gray-100"
          >
            {zonaExistent?.tipusZona === 'COBERT_EMMAGATZEMATGE' && (
              <option value="COBERT_EMMAGATZEMATGE">{ETIQUETES_TIPUS.COBERT_EMMAGATZEMATGE}</option>
            )}
            {OPCIONS_CREACIO.map((tipus) => (
              <option key={tipus} value={tipus}>{ETIQUETES_TIPUS[tipus]}</option>
            ))}
          </select>
        </div>

        {mutacio.isError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
          </p>
        )}
      </form>
    </Modal>
  )
}
