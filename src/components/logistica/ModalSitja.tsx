'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { Sitja, TipusPinso } from '@/types/logistica'
import type { UbicacioAmbJerarquia } from '@/types/infraestructura'

type ModalSitjaProps = {
  /** Si s'informa, el modal edita aquesta sitja; si no, en crea una de nova. */
  sitjaExistent?: Sitja
  onTancar: () => void
  onSalvat: () => void
}

/**
 * Modal de creació/edició d'una sitja.
 *
 * @param props.sitjaExistent - Si es passa, el formulari s'omple amb
 * les seves dades i actua en mode edició (la granja no es pot canviar)
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onSalvat - Callback en confirmar amb èxit
 * @returns Modal amb el formulari de la sitja
 *
 * @remarks Les granges (per triar ubicació) es reutilitzen de
 * queryKeys.infraestructura.all — comparteix cache amb el mòdul
 * Granja/Corts, sense duplicar cap endpoint.
 * @remarks Control d'accés: Admin i Treballador.
 */
export function ModalSitja({ sitjaExistent, onTancar, onSalvat }: ModalSitjaProps) {
  const queryClient = useQueryClient()

  const { data: ubicacions = [] } = useQuery<UbicacioAmbJerarquia[]>({
    queryKey: queryKeys.infraestructura.all,
    queryFn: () => fetch('/api/infraestructura').then((res) => res.json()).then((j) => j.ubicacions),
  })
  const { data: tipusPinso = [] } = useQuery<TipusPinso[]>({
    queryKey: queryKeys.logistica.tipusPinso,
    queryFn: () => fetch('/api/logistica/tipus-pinso').then((res) => res.json()).then((j) => j.tipusPinso),
  })
  const zonesConsum = ubicacions.flatMap((u) =>
    u.zones
      .filter((z) => z.tipusZona === 'NAU_ANIMALS' || z.tipusZona === 'PASTURA')
      .map((z) => ({ ...z, nomUbicacio: u.nom }))
  )

  const [nom, setNom] = useState(sitjaExistent?.nom ?? '')
  const [ubicacioId, setUbicacioId] = useState<number | ''>(sitjaExistent?.ubicacioId ?? '')
  const [tipusPinsoId, setTipusPinsoId] = useState<number | ''>(sitjaExistent?.tipusPinsoId ?? '')
  const [zonaVinculadaId, setZonaVinculadaId] = useState<number | ''>(sitjaExistent?.zonaVinculadaId ?? '')
  const [capacitatKg, setCapacitatKg] = useState(
    sitjaExistent?.capacitatKg != null ? String(sitjaExistent.capacitatKg) : ''
  )
  const [estocActualKg, setEstocActualKg] = useState(
    sitjaExistent ? String(sitjaExistent.estocActualKg) : '0'
  )
  const [estocMinimKg, setEstocMinimKg] = useState(
    sitjaExistent?.estocMinimKg != null ? String(sitjaExistent.estocMinimKg) : ''
  )

  const potConfirmar = nom.trim() !== '' && (sitjaExistent || ubicacioId !== '') && estocActualKg.trim() !== ''

  const mutacio = useMutation({
    mutationFn: async () => {
      const bodyComu = {
        nom: nom.trim(),
        tipusPinsoId: tipusPinsoId || undefined,
        capacitatKg: capacitatKg.trim() ? Number(capacitatKg) : undefined,
        estocActualKg: Number(estocActualKg),
        estocMinimKg: estocMinimKg.trim() ? Number(estocMinimKg) : undefined,
        zonaVinculadaId: zonaVinculadaId || undefined,
      }
      const url = sitjaExistent ? `/api/logistica/sitges/${sitjaExistent.id}` : '/api/logistica/sitges'
      const body = sitjaExistent ? bodyComu : { ...bodyComu, ubicacioId: Number(ubicacioId) }
      const res = await fetch(url, {
        method: sitjaExistent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar la sitja')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.sitges })
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.estoc })
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.catalegs })
      toastExit(sitjaExistent ? 'Sitja actualitzada' : 'Sitja creada correctament')
      onSalvat()
    },
    onError: (err) => toastError(err, 'Error en desar la sitja'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Desar"
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol={sitjaExistent ? 'Editar sitja' : 'Nova sitja'} onTancar={onTancar} peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (potConfirmar) mutacio.mutate()
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

        {!sitjaExistent && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Granja *</label>
            <select
              value={ubicacioId}
              onChange={(e) => setUbicacioId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            >
              <option value="">Selecciona una granja</option>
              {ubicacions.map((u) => (
                <option key={u.id} value={u.id}>{u.nom}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipus de pinso</label>
          <select
            value={tipusPinsoId}
            onChange={(e) => setTipusPinsoId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          >
            <option value="">Sense especificar</option>
            {tipusPinso.map((t) => (
              <option key={t.id} value={t.id}>{t.codi} — {t.nom}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estoc actual (kg) *</label>
            <input
              type="number"
              step="0.01"
              value={estocActualKg}
              onChange={(e) => setEstocActualKg(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacitat (kg)</label>
            <input
              type="number"
              step="0.01"
              value={capacitatKg}
              onChange={(e) => setCapacitatKg(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estoc mínim (kg)</label>
          <input
            type="number"
            step="0.01"
            value={estocMinimKg}
            onChange={(e) => setEstocMinimKg(e.target.value)}
            placeholder="Opcional — si no s'informa, s'aplica el valor global"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nau vinculada
            <span className="font-normal text-gray-400"> (precompleta el Destí als consums)</span>
          </label>
          <select
            value={zonaVinculadaId}
            onChange={(e) => setZonaVinculadaId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          >
            <option value="">Sense vincular</option>
            {zonesConsum.map((z) => (
              <option key={z.id} value={z.id}>{z.nomUbicacio} — {z.nom}</option>
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
