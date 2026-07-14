'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { TipusPinso } from '@/types/logistica'

type ModalTipusPinsoProps = {
  /** Si s'informa, el modal edita aquest tipus; si no, en crea un de nou. */
  tipusExistent?: TipusPinso
  onTancar: () => void
  onSalvat: () => void
}

type FilaComponent = { nomComponent: string; percentatge: string }

/**
 * Modal de creació/edició d'un tipus de pinso del catàleg, amb la
 * seva composició (llista de components amb percentatge).
 *
 * @param props.tipusExistent - Si es passa, el formulari s'omple
 * amb les seves dades i actua en mode edició
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onSalvat - Callback en confirmar amb èxit
 * @returns Modal amb codi, nom, i files de components afegibles/eliminables
 *
 * @remarks La suma dels percentatges es mostra en temps real com a
 * ajuda visual, però NO bloqueja el desat si no arriba a 100 —
 * permet desar una composició encara incompleta mentre es completa
 * la fitxa (docs/09_modul_logistica_farratges.md, ampliació).
 * @remarks En edició, tots els components existents es reemplacen
 * pels que hi hagi al formulari en confirmar (sense diff parcial).
 * @remarks Control d'accés: Admin i Treballador.
 */
export function ModalTipusPinso({ tipusExistent, onTancar, onSalvat }: ModalTipusPinsoProps) {
  const queryClient = useQueryClient()
  const [codi, setCodi] = useState(tipusExistent?.codi ?? '')
  const [nom, setNom] = useState(tipusExistent?.nom ?? '')
  const [components, setComponents] = useState<FilaComponent[]>(
    tipusExistent && tipusExistent.components.length > 0
      ? tipusExistent.components.map((c) => ({
          nomComponent: c.nomComponent,
          percentatge: String(c.percentatge),
        }))
      : [{ nomComponent: '', percentatge: '' }]
  )

  function actualitzarComponent(idx: number, camp: keyof FilaComponent, valor: string) {
    setComponents((prev) => prev.map((c, i) => (i === idx ? { ...c, [camp]: valor } : c)))
  }

  function afegirComponent() {
    setComponents((prev) => [...prev, { nomComponent: '', percentatge: '' }])
  }

  function eliminarComponent(idx: number) {
    setComponents((prev) => prev.filter((_, i) => i !== idx))
  }

  const componentsValids = components.filter((c) => c.nomComponent.trim() && c.percentatge.trim())
  const sumaPercentatges = componentsValids.reduce((acc, c) => acc + (Number(c.percentatge) || 0), 0)
  const potConfirmar = codi.trim() !== '' && nom.trim() !== '' && componentsValids.length > 0

  const mutacio = useMutation({
    mutationFn: async () => {
      const body = {
        codi: codi.trim(),
        nom: nom.trim(),
        components: componentsValids.map((c) => ({
          nomComponent: c.nomComponent.trim(),
          percentatge: Number(c.percentatge),
        })),
      }
      const url = tipusExistent
        ? `/api/logistica/tipus-pinso/${tipusExistent.id}`
        : '/api/logistica/tipus-pinso'
      const res = await fetch(url, {
        method: tipusExistent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar el tipus de pinso')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.tipusPinso })
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.estoc })
      toastExit(tipusExistent ? 'Tipus de pinso actualitzat' : 'Tipus de pinso creat correctament')
      onSalvat()
    },
    onError: (err) => toastError(err, 'Error en desar el tipus de pinso'),
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
    <Modal titol={tipusExistent ? 'Editar tipus de pinso' : 'Nou tipus de pinso'} onTancar={onTancar} mida="lg" peu={peu}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Codi *</label>
            <input
              type="text"
              value={codi}
              onChange={(e) => setCodi(e.target.value)}
              placeholder="PI-ENGREIX-18"
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Components *</label>
            <span className={`text-xs font-medium ${Math.round(sumaPercentatges) === 100 ? 'text-green-600' : 'text-gray-400'}`}>
              Total: {sumaPercentatges.toFixed(1)}%
            </span>
          </div>

          <div className="space-y-2">
            {components.map((c, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={c.nomComponent}
                  onChange={(e) => actualitzarComponent(idx, 'nomComponent', e.target.value)}
                  placeholder="Nom del component (Ex: Blat de moro)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={mutacio.isPending}
                />
                <input
                  type="number"
                  step="0.1"
                  value={c.percentatge}
                  onChange={(e) => actualitzarComponent(idx, 'percentatge', e.target.value)}
                  placeholder="%"
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={mutacio.isPending}
                />
                <button
                  type="button"
                  onClick={() => eliminarComponent(idx)}
                  disabled={components.length === 1 || mutacio.isPending}
                  className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Eliminar component"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={afegirComponent}
            disabled={mutacio.isPending}
            className="flex items-center gap-1 mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Plus size={16} aria-hidden="true" />
            Afegir component
          </button>
        </div>

        {mutacio.isError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
          </p>
        )}
      </div>
    </Modal>
  )
}
