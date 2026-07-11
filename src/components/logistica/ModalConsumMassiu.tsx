'use client'

import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
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
 * @remarks Lògica de bales (secció 2.2): quan es tria 'Unitats' i
 * l'origen té pesMitjaBalaKg configurat, es mostra el pes equivalent
 * calculat abans de confirmar. Si el magatzem no té aquest valor
 * configurat, l'opció 'Unitats' queda deshabilitada.
 * @remarks Control d'accés: només es munta des de pantalles ja
 * protegides per a Admin/Treballador.
 */
export function ModalConsumMassiu({ onTancar, onRegistrat }: ModalConsumMassiuProps) {
  const [catalegs, setCatalegs] = useState<CatalegsConsum>({ origens: [], destins: [] })
  const [origenClau, setOrigenClau] = useState('') // format "tipus:id"
  const [zonaDestiId, setZonaDestiId] = useState<number | ''>('')
  const [quantitat, setQuantitat] = useState('')
  const [unitat, setUnitat] = useState<UnitatMesura>('kg')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))

  const [enviant, setEnviant] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/logistica/catalegs')
      .then((res) => res.json())
      .then(setCatalegs)
      .catch(() => setCatalegs({ origens: [], destins: [] }))
  }, [])

  const origenSeleccionat = useMemo(
    () => catalegs.origens.find((o) => `${o.tipus}:${o.id}` === origenClau),
    [catalegs.origens, origenClau]
  )

  const esSitja = origenSeleccionat?.tipus === 'sitja'
  const potUsarBales = !esSitja && origenSeleccionat?.pesMitjaBalaKg !== null

  // Si canvia l'origen a una sitja, força la unitat a 'kg'
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!potConfirmar || !origenSeleccionat) return

    setEnviant(true)
    setErrorMsg(null)
    try {
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
      onRegistrat()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setEnviant(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Registrar consum</h2>
          <button
            onClick={onTancar}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Origen *</label>
            <select
              value={origenClau}
              onChange={(e) => handleOrigenChange(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={enviant}
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
              disabled={enviant}
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
                disabled={enviant}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unitat *</label>
              <select
                value={unitat}
                onChange={(e) => setUnitat(e.target.value as UnitatMesura)}
                disabled={enviant || esSitja}
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
              disabled={enviant}
            />
          </div>

          {errorMsg && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {errorMsg}
            </p>
          )}
        </form>

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
            {enviant ? 'Registrant...' : 'Registrar consum'}
          </button>
        </div>
      </div>
    </div>
  )
}
