'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Medicament } from '@/types/sanitari'

type LotOpcio = { id: number; nomLot: string }

type ModalAplicarTractamentProps = {
  /** Si s'informa, el tractament s'aplica només a aquest animal (mode individual, botó ja preseleccionat des de la fitxa). */
  animalIdPreseleccionat?: number
  onTancar: () => void
  onAplicat: () => void
}

/**
 * Modal per aplicar un tractament veterinari, individual (a un
 * animal concret) o per lot (a tots els animals actius del lot).
 *
 * @param props.animalIdPreseleccionat - Id de l'animal si s'obre des
 * de la seva fitxa (mode individual ja fixat)
 * @param props.onTancar - Callback per tancar sense confirmar
 * @param props.onAplicat - Callback en confirmar amb èxit
 * @returns Modal amb selector de mode i el formulari del tractament
 *
 * @remarks Camps segons docs/06_modul_sanitari.md, secció 4.2.
 * Ambdós modes comparteixen exactament els mateixos camps (dosi,
 * unitat, data inici, data fi prevista, notes) — confirmat amb
 * l'usuari, sense personalització per animal dins d'un lot.
 * @remarks Control d'accés: només es munta des de pantalles ja
 * protegides per a Admin/Veterinari.
 */
export function ModalAplicarTractament({
  animalIdPreseleccionat,
  onTancar,
  onAplicat,
}: ModalAplicarTractamentProps) {
  const [mode, setMode] = useState<'individual' | 'lot'>(
    animalIdPreseleccionat ? 'individual' : 'lot'
  )
  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [lots, setLots] = useState<LotOpcio[]>([])
  const [medicamentId, setMedicamentId] = useState<number | ''>('')
  const [lotId, setLotId] = useState<number | ''>('')
  const [dataInici, setDataInici] = useState(new Date().toISOString().slice(0, 10))
  const [dataFiPrevista, setDataFiPrevista] = useState('')
  const [dosiAplicada, setDosiAplicada] = useState('')
  const [unitatDosi, setUnitatDosi] = useState('')
  const [notes, setNotes] = useState('')

  const [enviant, setEnviant] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sanitari/medicaments')
      .then((res) => res.json())
      .then((json) => setMedicaments((json.medicaments ?? []).filter((m: Medicament) => m.quantitatEstoc > 0)))
      .catch(() => setMedicaments([]))

    fetch('/api/lots')
      .then((res) => res.json())
      .then((json) => setLots(json.lots ?? []))
      .catch(() => setLots([]))
  }, [])

  const potConfirmar =
    medicamentId !== '' &&
    dataInici.trim() !== '' &&
    (mode === 'individual' ? !!animalIdPreseleccionat : lotId !== '')

  async function handleSubmit() {
    if (!potConfirmar) return
    setEnviant(true)
    setErrorMsg(null)

    const body: Record<string, unknown> = {
      medicamentId: Number(medicamentId),
      dataInici,
      dataFiPrevista: dataFiPrevista.trim() || undefined,
      dosiAplicada: dosiAplicada.trim() ? Number(dosiAplicada) : undefined,
      unitatDosi: unitatDosi.trim() || undefined,
      notes: notes.trim() || undefined,
    }

    if (mode === 'individual') {
      body.animalIds = [animalIdPreseleccionat]
    } else {
      body.lotId = Number(lotId)
      body.animalIds = [] // requerit pel schema, es substitueix a l'endpoint quan hi ha lotId
    }

    try {
      const res = await fetch('/api/sanitari/tractaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en aplicar el tractament')
      onAplicat()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setEnviant(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Aplicar tractament</h2>
          <button
            onClick={onTancar}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {animalIdPreseleccionat ? (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              S&apos;aplicarà a aquest animal.
            </p>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('lot')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${mode === 'lot' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
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
              onChange={(e) => setMedicamentId(e.target.value ? Number(e.target.value) : '')}
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
              <input
                type="text"
                value={unitatDosi}
                onChange={(e) => setUnitatDosi(e.target.value)}
                placeholder="ml, g..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              />
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

          {errorMsg && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {errorMsg}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onTancar}
            className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 font-medium rounded-lg min-h-[44px]"
          >
            Cancel·lar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!potConfirmar || enviant}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                       font-medium rounded-lg min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviant ? 'Aplicant...' : 'Aplicar tractament'}
          </button>
        </div>
      </div>
    </div>
  )
}
