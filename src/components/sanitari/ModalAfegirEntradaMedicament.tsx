'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { MedicamentCataleg, Medicament } from '@/types/sanitari'

type ModalAfegirEntradaMedicamentProps = {
  /** Si s'informa, el modal edita aquesta entrada; si no, en crea una de nova. */
  entradaExistent?: Medicament
  onTancar: () => void
  onDesat: () => void
}

/**
 * Modal per afegir o editar una entrada d'estoc (compra/lot) d'un
 * medicament del catàleg.
 *
 * @param props.entradaExistent - Si es passa, el formulari s'omple
 * amb les seves dades i actua en mode edició (el medicament del
 * catàleg no es pot canviar)
 * @param props.onTancar - Callback per tancar sense desar
 * @param props.onDesat - Callback en confirmar amb èxit
 * @returns Modal amb selector de medicament del catàleg + dades de l'entrada
 *
 * @remarks Edició afegida juliol 2026 — abans només es podien crear
 * entrades noves, no corregir-ne cap un cop desada (ex: un error de
 * lot o de preu introduït).
 * @remarks "Quantitat" es demana com "Nombre d'ampolles o sobres"
 * (o la unitat que correspongui) — decisió confirmada amb l'usuari;
 * el camp de BD és el mateix `quantitatEstoc`, només canvia
 * l'etiqueta segons el context d'ús.
 * @remarks Si el medicament que es vol donar d'alta encara no
 * existeix al catàleg, cal crear-lo primer amb "Nou medicament".
 * @remarks Control d'accés: només es munta des de la pàgina de
 * Sanitari quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalAfegirEntradaMedicament({
  entradaExistent,
  onTancar,
  onDesat,
}: ModalAfegirEntradaMedicamentProps) {
  const queryClient = useQueryClient()

  const { data: cataleg = [] } = useQuery<MedicamentCataleg[]>({
    queryKey: queryKeys.sanitari.medicamentsCataleg,
    queryFn: () =>
      fetch('/api/sanitari/medicaments-cataleg').then((res) => res.json()).then((j) => j.medicamentsCataleg),
  })

  const [medicamentCatalegId, setMedicamentCatalegId] = useState<number | ''>(
    entradaExistent?.medicamentCatalegId ?? ''
  )
  const [lot, setLot] = useState(entradaExistent?.lot ?? '')
  const [quantitatEstoc, setQuantitatEstoc] = useState(
    entradaExistent ? String(entradaExistent.quantitatEstoc) : ''
  )
  const [unitatEstoc, setUnitatEstoc] = useState(entradaExistent?.unitatEstoc ?? 'ampolles')
  const [preuCompra, setPreuCompra] = useState(entradaExistent ? String(entradaExistent.preuCompra) : '')

  const potConfirmar =
    (entradaExistent || medicamentCatalegId !== '') &&
    lot.trim() !== '' &&
    quantitatEstoc.trim() !== '' &&
    preuCompra.trim() !== ''

  const mutacio = useMutation({
    mutationFn: async () => {
      const bodyComu = {
        lot: lot.trim(),
        quantitatEstoc: Number(quantitatEstoc),
        unitatEstoc: unitatEstoc.trim(),
        preuCompra: Number(preuCompra),
      }
      const url = entradaExistent
        ? `/api/sanitari/medicaments/${entradaExistent.id}`
        : '/api/sanitari/medicaments'
      const body = entradaExistent
        ? bodyComu
        : { ...bodyComu, medicamentCatalegId: Number(medicamentCatalegId) }
      const res = await fetch(url, {
        method: entradaExistent ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en desar l\'entrada')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.medicaments })
      toastExit(entradaExistent ? 'Entrada actualitzada' : 'Entrada d\'estoc afegida correctament')
      onDesat()
    },
    onError: (err) => toastError(err, 'Error en desar l\'entrada'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar={entradaExistent ? 'Desar' : 'Afegir entrada'}
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol={entradaExistent ? 'Editar entrada d\'estoc' : 'Afegir entrada d\'estoc'} onTancar={onTancar} peu={peu}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (potConfirmar) mutacio.mutate()
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Medicament *</label>
          {entradaExistent ? (
            <p className="w-full px-3 py-2 bg-gray-50 rounded-lg text-base text-gray-700">
              {entradaExistent.nomMedicament}
            </p>
          ) : (
            <>
              <select
                value={medicamentCatalegId}
                onChange={(e) => setMedicamentCatalegId(e.target.value ? Number(e.target.value) : '')}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                disabled={mutacio.isPending}
              >
                <option value="">Selecciona un medicament del catàleg</option>
                {cataleg.map((m) => (
                  <option key={m.id} value={m.id}>{m.nomMedicament}</option>
                ))}
              </select>
              {cataleg.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  El catàleg és buit — crea primer un medicament amb &quot;Nou medicament&quot;.
                </p>
              )}
            </>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Lot *</label>
          <input
            type="text"
            value={lot}
            onChange={(e) => setLot(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            disabled={mutacio.isPending}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre d&apos;ampolles o sobres *
            </label>
            <input
              type="number"
              step="0.001"
              value={quantitatEstoc}
              onChange={(e) => setQuantitatEstoc(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unitat *</label>
            <input
              type="text"
              value={unitatEstoc}
              onChange={(e) => setUnitatEstoc(e.target.value)}
              placeholder="ampolles, sobres, ml..."
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={mutacio.isPending}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Preu de compra (€) *</label>
          <input
            type="number"
            step="0.01"
            value={preuCompra}
            onChange={(e) => setPreuCompra(e.target.value)}
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
