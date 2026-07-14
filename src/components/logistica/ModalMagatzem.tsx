'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { MagatzemFarratge } from '@/types/logistica'
import type { UbicacioAmbJerarquia } from '@/types/infraestructura'

type ModalMagatzemProps = {
  /** Si s'informa, el modal edita aquest magatzem; si no, en crea un de nou. */
  magatzemExistent?: MagatzemFarratge
  onTancar: () => void
  onSalvat: () => void
}

/**
 * Modal de creació/edició d'un magatzem de farratge.
 *
 * @param props.magatzemExistent - Si es passa, el formulari s'omple
 * amb les seves dades i actua en mode edició (la zona no es pot canviar)
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onSalvat - Callback en confirmar amb èxit
 * @returns Modal amb el formulari del magatzem
 *
 * @remarks El desplegable de zona només mostra les de tipus
 * COBERT_EMMAGATZEMATGE (reutilitzant queryKeys.infraestructura.all)
 * — evita l'error 422 de l'endpoint la majoria de vegades, tot i que
 * la BD el segueix validant com a defensa real.
 * @remarks Control d'accés: Admin i Treballador.
 */
export function ModalMagatzem({ magatzemExistent, onTancar, onSalvat }: ModalMagatzemProps) {
  const queryClient = useQueryClient()

  const { data: ubicacions = [] } = useQuery<UbicacioAmbJerarquia[]>({
    queryKey: queryKeys.infraestructura.all,
    queryFn: () => fetch('/api/infraestructura').then((res) => res.json()).then((j) => j.ubicacions),
  })
  const zonesCoberts = ubicacions.flatMap((u) =>
    u.zones
      .filter((z) => z.tipusZona === 'COBERT_EMMAGATZEMATGE')
      .map((z) => ({ ...z, nomUbicacio: u.nom }))
  )

  const [zonaId, setZonaId] = useState<number | ''>(magatzemExistent?.zonaId ?? '')
  const [tipusFarratge, setTipusFarratge] = useState(magatzemExistent?.tipusFarratge ?? '')
  const [capacitatMaximaTones, setCapacitatMaximaTones] = useState(
    magatzemExistent?.capacitatMaximaTones != null ? String(magatzemExistent.capacitatMaximaTones) : ''
  )
  const [estocActualTones, setEstocActualTones] = useState(
    magatzemExistent ? String(magatzemExistent.estocActualTones) : '0'
  )
  const [estocMinimTones, setEstocMinimTones] = useState(
    magatzemExistent?.estocMinimTones != null ? String(magatzemExistent.estocMinimTones) : ''
  )
  const [pesMitjaBalaKg, setPesMitjaBalaKg] = useState(
    magatzemExistent?.pesMitjaBalaKg != null ? String(magatzemExistent.pesMitjaBalaKg) : ''
  )

  const potConfirmar =
    tipusFarratge.trim() !== '' && (magatzemExistent || zonaId !== '') && estocActualTones.trim() !== ''

  const mutacio = useMutation({
    mutationFn: async () => {
      const bodyComu = {
        tipusFarratge: tipusFarratge.trim(),
        capacitatMaximaTones: capacitatMaximaTones.trim() ? Number(capacitatMaximaTones) : undefined,
        estocActualTones: Number(estocActualTones),
        estocMinimTones: estocMinimTones.trim() ? Number(estocMinimTones) : undefined,
        pesMitjaBalaKg: pesMitjaBalaKg.trim() ? Number(pesMitjaBalaKg) : undefined,
      }
      const url = magatzemExistent
        ? `/api/logistica/magatzems/${magatzemExistent.id}`
        : '/api/logistica/magatzems'
      const body = magatzemExistent ? bodyComu : { ...bodyComu, zonaId: Number(zonaId) }
      const res = await fetch(url, {
        method: magatzemExistent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar el magatzem')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.magatzems })
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.estoc })
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.catalegs })
      toastExit(magatzemExistent ? 'Magatzem actualitzat' : 'Magatzem creat correctament')
      onSalvat()
    },
    onError: (err) => toastError(err, 'Error en desar el magatzem'),
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
    <Modal titol={magatzemExistent ? 'Editar magatzem' : 'Nou magatzem'} onTancar={onTancar} peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (potConfirmar) mutacio.mutate()
        }}
        className="space-y-4"
      >
        {!magatzemExistent && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cobert d&apos;emmagatzematge *</label>
            <select
              value={zonaId}
              onChange={(e) => setZonaId(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            >
              <option value="">Selecciona un cobert</option>
              {zonesCoberts.map((z) => (
                <option key={z.id} value={z.id}>{z.nomUbicacio} — {z.nom}</option>
              ))}
            </select>
            {zonesCoberts.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                No hi ha cap zona de tipus &quot;Cobert d&apos;emmagatzematge&quot; creada. Crea&apos;n una primer a Granja/Corts.
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipus de farratge *</label>
          <input
            type="text"
            value={tipusFarratge}
            onChange={(e) => setTipusFarratge(e.target.value)}
            placeholder="Palla, Alfals..."
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estoc actual (tones) *</label>
            <input
              type="number"
              step="0.001"
              value={estocActualTones}
              onChange={(e) => setEstocActualTones(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacitat (tones)</label>
            <input
              type="number"
              step="0.001"
              value={capacitatMaximaTones}
              onChange={(e) => setCapacitatMaximaTones(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estoc mínim (tones)</label>
            <input
              type="number"
              step="0.001"
              value={estocMinimTones}
              onChange={(e) => setEstocMinimTones(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pes mitjà per bala (kg)</label>
            <input
              type="number"
              step="0.01"
              value={pesMitjaBalaKg}
              onChange={(e) => setPesMitjaBalaKg(e.target.value)}
              placeholder="Necessari per a consums en bales"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
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
