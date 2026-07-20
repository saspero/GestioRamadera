'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'
import type { Medicament, UnitatDosi } from '@/types/sanitari'

type LotOpcio = { id: number; nomLot: string }

const UNITATS_DOSI: UnitatDosi[] = ['ml', 'g', 'mg', 'unitats', 'cc']

type ModalAplicarTractamentProps = {
  /** Si s'informa, el tractament s'aplica només a aquest animal (mode individual). */
  animalIdPreseleccionat?: number
  onTancar: () => void
  onAplicat: () => void
}

/**
 * Modal per aplicar un tractament veterinari, individual (a un
 * animal concret) o per lot (a tots els animals actius del lot).
 *
 * @param props.animalIdPreseleccionat - Id de l'animal si s'obre des
 * de la seva fitxa (mode individual ja fixat) — encara pendent de
 * connectar des de FitxaAnimalModal (docs/06_modul_sanitari.md, 0.1)
 * @param props.onTancar - Callback per tancar sense confirmar
 * @param props.onAplicat - Callback en confirmar amb èxit
 * @returns Modal amb selector de mode i el formulari del tractament
 *
 * @remarks MIGRACIÓ REACT QUERY: medicaments (queryKeys.sanitari.medicaments,
 * compartit amb la pestanya d'inventari de la pàgina de Sanitari) i
 * lots (queryKeys.lots.llistat, compartit amb la pàgina de Lots i
 * ModalMoureAnimals) via useQuery. La confirmació és una useMutation
 * que invalida queryKeys.sanitari.tractaments,
 * queryKeys.sanitari.medicaments (l'estoc es descompta) i
 * queryKeys.animals.all (l'animal entra en bloqueig per supressió,
 * visible al llistat).
 * @remarks Unitat de dosi (juliol 2026): desplegable tancat
 * (ml/g/mg/unitats/cc), abans text lliure. En triar un medicament,
 * la unitat es precompleta automàticament amb la unitat d'estoc
 * d'aquell medicament si coincideix amb una opció vàlida
 * (handleMedicamentChange) — l'usuari encara la pot canviar manualment.
 * @remarks Camps segons docs/06_modul_sanitari.md, secció 4.2.
 * @remarks Control d'accés: només es munta des de pantalles ja
 * protegides per a Admin/Veterinari.
 */
export function ModalAplicarTractament({
  animalIdPreseleccionat,
  onTancar,
  onAplicat,
}: ModalAplicarTractamentProps) {
  const queryClient = useQueryClient()
  const [mode] = useState<'individual' | 'lot'>(animalIdPreseleccionat ? 'individual' : 'lot')

  const { data: medicamentsBruts = [] } = useQuery<Medicament[]>({
    queryKey: queryKeys.sanitari.medicaments,
    queryFn: () => fetch('/api/sanitari/medicaments').then((res) => res.json()).then((j) => j.medicaments ?? []),
  })
  const medicaments = medicamentsBruts.filter((m) => m.quantitatEstoc > 0)

  const { data: lots = [] } = useQuery<LotOpcio[]>({
    queryKey: queryKeys.lots.llistat,
    queryFn: () => fetch('/api/lots').then((res) => res.json()).then((j) => j.lots ?? []),
  })

  const [medicamentId, setMedicamentId] = useState<number | ''>('')
  const [lotId, setLotId] = useState<number | ''>('')
  const [dataInici, setDataInici] = useState(new Date().toISOString().slice(0, 10))
  const [dataFiPrevista, setDataFiPrevista] = useState('')
  const [dosiAplicada, setDosiAplicada] = useState('')
  const [unitatDosi, setUnitatDosi] = useState<UnitatDosi | ''>('')
  const [notes, setNotes] = useState('')

  /**
   * En canviar el medicament seleccionat, precompleta automàticament
   * la unitat de dosi amb la unitat d'estoc d'aquell medicament (Ex:
   * si el medicament està en ml, la dosi ja parteix de ml) — només
   * si aquesta unitat és una de les opcions vàlides del desplegable
   * (ml/g/mg/unitats/cc); si no ho és (Ex: "ampolles"), es deixa en
   * blanc perquè l'usuari la triï manualment.
   */
  function handleMedicamentChange(novaId: number | '') {
    setMedicamentId(novaId)
    const medicamentTriat = medicaments.find((m) => m.id === novaId)
    const unitatCoincident = UNITATS_DOSI.find((u) => u === medicamentTriat?.unitatEstoc)
    setUnitatDosi(unitatCoincident ?? '')
  }

  const potConfirmar =
    medicamentId !== '' &&
    dataInici.trim() !== '' &&
    (mode === 'individual' ? !!animalIdPreseleccionat : lotId !== '')

  const mutacio = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        medicamentId: Number(medicamentId),
        dataInici,
        dataFiPrevista: dataFiPrevista.trim() || undefined,
        dosiAplicada: dosiAplicada.trim() ? Number(dosiAplicada) : undefined,
        unitatDosi: unitatDosi || undefined,
        notes: notes.trim() || undefined,
      }
      if (mode === 'individual') {
        body.animalIds = [animalIdPreseleccionat]
      } else {
        body.lotId = Number(lotId)
        body.animalIds = []
      }

      const res = await fetch('/api/sanitari/tractaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en aplicar el tractament')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.tractaments })
      queryClient.invalidateQueries({ queryKey: queryKeys.sanitari.medicaments })
      queryClient.invalidateQueries({ queryKey: queryKeys.animals.all })
      toastExit('Tractament aplicat correctament')
      onAplicat()
    },
    onError: (err) => toastError(err, 'Error en aplicar el tractament'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Aplicar tractament"
      textEnviant="Aplicant..."
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
    />
  )

  return (
    <Modal titol="Aplicar tractament" onTancar={onTancar} peu={peu} sobreposat={!!animalIdPreseleccionat}>
      <div className="space-y-4">
        {animalIdPreseleccionat ? (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            S&apos;aplicarà a aquest animal.
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white"
            >
              Per lot
            </button>
          </div>
        )}

        {mode === 'lot' && !animalIdPreseleccionat && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lot *</label>
            <select
              value={lotId}
              onChange={(e) => setLotId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            >
              <option value="">Selecciona un lot</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>{l.nomLot}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Medicament *</label>
          <select
            value={medicamentId}
            onChange={(e) => handleMedicamentChange(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
          >
            <option value="">Selecciona un medicament</option>
            {medicaments.map((m) => (
              <option key={m.id} value={m.id}>{m.nomMedicament} (Lot {m.lot})</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">Només es mostren medicaments amb estoc disponible.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data d&apos;inici *</label>
          <input
            type="date"
            value={dataInici}
            onChange={(e) => setDataInici(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data de fi prevista</label>
          <input
            type="date"
            value={dataFiPrevista}
            onChange={(e) => setDataFiPrevista(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dosi aplicada</label>
            <input
              type="number"
              step="0.001"
              value={dosiAplicada}
              onChange={(e) => setDosiAplicada(e.target.value)}
              placeholder="Per animal"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unitat</label>
            <select
              value={unitatDosi}
              onChange={(e) => setUnitatDosi(e.target.value as UnitatDosi)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            >
              <option value="">Selecciona una unitat</option>
              {UNITATS_DOSI.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
          />
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
