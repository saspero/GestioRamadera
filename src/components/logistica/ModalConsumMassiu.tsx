'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { CatalegsConsum, UnitatMesura } from '@/types/logistica'

type ModalConsumMassiuProps = {
  onTancar: () => void
  onRegistrat: () => void
}

/**
 * Modal del formulari de Consums Massius (docs/09_modul_logistica_farratges.md,
 * secció 2). Un únic formulari intel·ligent: si l'origen és una
 * sitja, l'unitat es fixa a 'kg' i s'escriu a consums_pinso_nau; si
 * és un magatzem de farratge, permet kg/Tones/Unitats i s'escriu a
 * moviments_farratge.
 *
 * @param props.onTancar - Callback per tancar sense confirmar
 * @param props.onRegistrat - Callback en confirmar amb èxit
 * @returns Modal amb el formulari de consum
 *
 * @remarks MIGRACIÓ REACT QUERY: catàlegs via useQuery
 * (queryKeys.logistica.catalegs). La confirmació és una useMutation
 * que invalida queryKeys.logistica.estoc en tenir èxit, perquè la
 * taula de Control d'Estoc reflecteixi el nou nivell sense recàrrega
 * manual.
 * @remarks Lògica de bales (secció 2.2): quan es tria 'Unitats' i
 * l'origen té pesMitjaBalaKg configurat, es mostra el pes equivalent
 * calculat abans de confirmar.
 * @remarks Control d'accés: només es munta des de pantalles ja
 * protegides per a Admin/Treballador.
 */
export function ModalConsumMassiu({ onTancar, onRegistrat }: ModalConsumMassiuProps) {
  const queryClient = useQueryClient()

  const { data: catalegs = { origens: [], destins: [] } } = useQuery<CatalegsConsum>({
    queryKey: queryKeys.logistica.catalegs,
    queryFn: () => fetch('/api/logistica/catalegs').then((res) => res.json()),
  })

  const [origenClau, setOrigenClau] = useState('')
  const [zonaDestiId, setZonaDestiId] = useState<number | ''>('')
  const [quantitat, setQuantitat] = useState('')
  const [unitat, setUnitat] = useState<UnitatMesura>('kg')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))

  const origenSeleccionat = useMemo(
    () => catalegs.origens.find((o) => `${o.tipus}:${o.id}` === origenClau),
    [catalegs.origens, origenClau]
  )

  const esSitja = origenSeleccionat?.tipus === 'sitja'
  const potUsarBales = !esSitja && origenSeleccionat?.pesMitjaBalaKg !== null

  function handleOrigenChange(nouOrigenClau: string) {
    setOrigenClau(nouOrigenClau)
    const nouOrigen = catalegs.origens.find((o) => `${o.tipus}:${o.id}` === nouOrigenClau)
    if (nouOrigen?.tipus === 'sitja') {
      setUnitat('kg')
    }
  }

  const pesEquivalentBales =
    unitat === 'Unitats' && origenSeleccionat?.pesMitjaBalaKg && quantitat.trim()
      ? Number(quantitat) * origenSeleccionat.pesMitjaBalaKg
      : null

  const potConfirmar =
    origenSeleccionat !== undefined &&
    zonaDestiId !== '' &&
    quantitat.trim() !== '' &&
    Number(quantitat) > 0

  const mutacio = useMutation({
    mutationFn: async () => {
      if (!origenSeleccionat) throw new Error('Cal seleccionar un origen')
      const res = await fetch('/api/logistica/consum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origenTipus: origenSeleccionat.tipus,
          origenId: origenSeleccionat.id,
          zonaDestiId: Number(zonaDestiId),
          quantitat: Number(quantitat),
          unitat,
          data,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en registrar el consum')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logistica.estoc })
      toastExit('Consum registrat correctament')
      onRegistrat()
    },
    onError: (err) => toastError(err, 'Error en registrar el consum'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Registrar consum"
      textEnviant="Registrant..."
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol="Registrar consum" onTancar={onTancar} peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (potConfirmar) mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Origen *</label>
          <select
            value={origenClau}
            onChange={(e) => handleOrigenChange(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          >
            <option value="">Selecciona un origen</option>
            {catalegs.origens.map((o) => (
              <option key={`${o.tipus}:${o.id}`} value={`${o.tipus}:${o.id}`}>
                {o.nom} {o.tipus === 'sitja' ? '(sitja)' : '(farratge)'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Destí *</label>
          <select
            value={zonaDestiId}
            onChange={(e) => setZonaDestiId(e.target.value ? Number(e.target.value) : '')}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          >
            <option value="">Selecciona un destí</option>
            {catalegs.destins.map((z) => (
              <option key={z.id} value={z.id}>{z.nom}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantitat *</label>
            <input
              type="number"
              step="0.01"
              value={quantitat}
              onChange={(e) => setQuantitat(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unitat *</label>
            <select
              value={unitat}
              onChange={(e) => setUnitat(e.target.value as UnitatMesura)}
              disabled={mutacio.isPending || esSitja}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base disabled:bg-gray-100"
            >
              <option value="kg">kg</option>
              {!esSitja && <option value="Tones">Tones</option>}
              {!esSitja && (
                <option value="Unitats" disabled={!potUsarBales}>
                  Unitats (bales){!potUsarBales ? ' — no configurat' : ''}
                </option>
              )}
            </select>
          </div>
        </div>

        {pesEquivalentBales !== null && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            {quantitat} bales = {pesEquivalentBales.toLocaleString('ca-ES')} kg
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
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
