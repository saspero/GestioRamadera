'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { Sitja, MagatzemFarratge, TipusOrigen } from '@/types/logistica'

type ModalEntradaEstocProps = {
  onTancar: () => void
  onRegistrat: () => void
}

type FilaRepartiment = { id: number | ''; quantitat: string }

/**
 * Modal per registrar una entrada d'estoc repartida manualment entre
 * diversos silos o magatzems del mateix tipus — per exemple, un
 * camió de 16 tones que es reparteix entre 3 sitges diferents.
 *
 * @param props.onTancar - Callback per tancar sense confirmar
 * @param props.onRegistrat - Callback en confirmar amb èxit
 * @returns Modal amb selector de tipus i files afegibles/eliminables
 * de destinatari + quantitat
 *
 * @remarks Repartiment MANUAL (decisió confirmada amb l'usuari):
 * l'usuari indica explícitament la quantitat exacta que va a
 * cadascun dels silos/magatzems triats — no hi ha repartiment
 * automàtic ni equitatiu.
 * @remarks Aquesta operació NOMÉS incrementa l'estoc — mai
 * descompta ni implica cap animal (l'aliment encara no s'ha
 * consumit). No té relació amb el Destí/nau vinculada del formulari
 * de Consums Massius.
 * @remarks Control d'accés: només es munta des de pantalles ja
 * protegides per a Admin/Treballador.
 */
export function ModalEntradaEstoc({ onTancar, onRegistrat }: ModalEntradaEstocProps) {
  const queryClient = useQueryClient()
  const [tipus, setTipus] = useState<TipusOrigen>('sitja')
  const [files, setFiles] = useState<FilaRepartiment[]>([{ id: '', quantitat: '' }])

  const { data: sitges = [] } = useQuery<Sitja[]>({
    queryKey: queryKeys.logistica.sitges,
    queryFn: () => fetch('/api/logistica/sitges').then((res) => res.json()).then((j) => j.sitges),
  })
  const { data: magatzems = [] } = useQuery<MagatzemFarratge[]>({
    queryKey: queryKeys.logistica.magatzems,
    queryFn: () => fetch('/api/logistica/magatzems').then((res) => res.json()).then((j) => j.magatzems),
  })

  const opcions =
    tipus === 'sitja'
      ? sitges.map((s) => ({ id: s.id, etiqueta: `${s.nom} — ${s.nomUbicacio}` }))
      : magatzems.map((m) => ({ id: m.id, etiqueta: `${m.tipusFarratge} — ${m.nomZona}` }))

  function handleTipusChange(nouTipus: TipusOrigen) {
    setTipus(nouTipus)
    setFiles([{ id: '', quantitat: '' }])
  }

  function actualitzarFila(idx: number, camp: keyof FilaRepartiment, valor: string) {
    setFiles((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, [camp]: camp === 'id' ? (valor ? Number(valor) : '') : valor } : f))
    )
  }

  function afegirFila() {
    setFiles((prev) => [...prev, { id: '', quantitat: '' }])
  }

  function eliminarFila(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const filesValides = files.filter((f) => f.id !== '' && f.quantitat.trim() !== '' && Number(f.quantitat) > 0)
  const totalRepartit = filesValides.reduce((acc, f) => acc + Number(f.quantitat), 0)
  const unitatLabel = tipus === 'sitja' ? 'kg' : 'tones'
  const potConfirmar = filesValides.length > 0

  const mutacio = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/logistica/entrada-estoc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipus,
          repartiment: filesValides.map((f) => ({ id: Number(f.id), quantitat: Number(f.quantitat) })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en registrar l\'entrada d\'estoc')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.estoc })
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.sitges })
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.magatzems })
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.catalegs })
      toastExit('Entrada d\'estoc registrada correctament')
      onRegistrat()
    },
    onError: (err) => toastError(err, 'Error en registrar l\'entrada d\'estoc'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Registrar entrada"
      textEnviant="Registrant..."
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol="Registrar entrada d'estoc" onTancar={onTancar} mida="lg" peu={peu}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipus *</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTipusChange('sitja')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${tipus === 'sitja' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              disabled={mutacio.isPending}
            >
              Sitges (pinso)
            </button>
            <button
              type="button"
              onClick={() => handleTipusChange('magatzem')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${tipus === 'magatzem' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              disabled={mutacio.isPending}
            >
              Magatzems (farratge)
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Repartiment ({unitatLabel})
          </label>
          <div className="space-y-2">
            {files.map((f, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={f.id}
                  onChange={(e) => actualitzarFila(idx, 'id', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={mutacio.isPending}
                >
                  <option value="">Selecciona {tipus === 'sitja' ? 'una sitja' : 'un magatzem'}</option>
                  {opcions.map((o) => (
                    <option key={o.id} value={o.id}>{o.etiqueta}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={f.quantitat}
                  onChange={(e) => actualitzarFila(idx, 'quantitat', e.target.value)}
                  placeholder={unitatLabel}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={mutacio.isPending}
                />
                <button
                  type="button"
                  onClick={() => eliminarFila(idx)}
                  disabled={files.length === 1 || mutacio.isPending}
                  className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Eliminar fila"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={afegirFila}
            disabled={mutacio.isPending}
            className="flex items-center gap-1 mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <Plus size={16} aria-hidden="true" />
            Afegir fila
          </button>
        </div>

        {filesValides.length > 0 && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            Total a repartir: {totalRepartit.toLocaleString('ca-ES')} {unitatLabel}
          </p>
        )}

        {mutacio.isError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
          </p>
        )}
      </div>
    </Modal>
  )
}
