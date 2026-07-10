'use client'

import { useState, useEffect } from 'react'
import { X, CircleCheckBig } from 'lucide-react'

type Catalegs = {
  races: { id: number; nomRaca: string }[]
  lots: { id: number; nomLot: string }[]
  corts: { id: number; codiCort: string; nomZona: string }[]
}

type ModalAltaIndividualProps = {
  onTancar: () => void
  onAltaCompletada: () => void
}

type EstatEnviament = 'idle' | 'enviant' | 'completat' | 'error'

/**
 * Modal d'alta individual d'un animal, amb formulari directe
 * (DIB, raça, data de naixement, sexe, lot i cort).
 *
 * @param props.onTancar - Callback per tancar el modal sense confirmar
 * @param props.onAltaCompletada - Callback en confirmar amb èxit,
 * perquè la pàgina pare recarregui el llistat
 * @returns Modal amb el formulari d'alta individual
 *
 * @remarks Control d'accés: aquest component només es munta des de la
 * pàgina d'animals quan rol === 'Admin' || rol === 'Veterinari'
 * (comprovat al pare via useSessio()). L'endpoint POST /api/animals
 * torna a validar el rol igualment — defensa en profunditat.
 * @remarks Multitenancy: no toca la BD directament; tota l'escriptura
 * passa per POST /api/animals, que aplica el search_path del tenant.
 */
export function ModalAltaIndividual({ onTancar, onAltaCompletada }: ModalAltaIndividualProps) {
  const [catalegs, setCatalegs] = useState<Catalegs | null>(null)
  const [dib, setDib] = useState('')
  const [racaId, setRacaId] = useState<number | ''>('')
  const [dataNaixement, setDataNaixement] = useState('')
  const [sexe, setSexe] = useState<'' | 'Mascle' | 'Femella'>('')
  const [lotId, setLotId] = useState<number | ''>('')
  const [cortId, setCortId] = useState<number | ''>('')
  const [estat, setEstat] = useState<EstatEnviament>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/animals/catalegs')
      .then((res) => res.json())
      .then(setCatalegs)
      .catch(() => setCatalegs({ races: [], lots: [], corts: [] }))
  }, [])

  const potConfirmar = dib.trim().length > 0 && lotId !== '' && cortId !== ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!potConfirmar) return

    setEstat('enviant')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/animals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dib: dib.trim(),
          racaId: racaId || undefined,
          dataNaixement: dataNaixement || undefined,
          sexe: sexe || undefined,
          lotId,
          cortId,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error ?? 'Error en donar d\'alta l\'animal')
      }

      setEstat('completat')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconegut')
      setEstat('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Alta individual d&apos;animal</h2>
          <button
            onClick={onTancar}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {estat === 'completat' ? (
            <div className="text-center py-8">
              <CircleCheckBig size={48} className="mx-auto text-green-600 mb-3" />
              <p className="text-lg font-semibold text-gray-900">Animal donat d&apos;alta correctament</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">DIB *</label>
                <input
                  type="text"
                  value={dib}
                  onChange={(e) => setDib(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={estat === 'enviant'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raça</label>
                <select
                  value={racaId}
                  onChange={(e) => setRacaId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={estat === 'enviant'}
                >
                  <option value="">Sense especificar</option>
                  {catalegs?.races.map((r) => (
                    <option key={r.id} value={r.id}>{r.nomRaca}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de naixement</label>
                <input
                  type="date"
                  value={dataNaixement}
                  onChange={(e) => setDataNaixement(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={estat === 'enviant'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sexe</label>
                <select
                  value={sexe}
                  onChange={(e) => setSexe(e.target.value as typeof sexe)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={estat === 'enviant'}
                >
                  <option value="">Sense especificar</option>
                  <option value="Mascle">Mascle</option>
                  <option value="Femella">Femella</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot *</label>
                <select
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={estat === 'enviant'}
                >
                  <option value="">Selecciona un lot</option>
                  {catalegs?.lots.map((l) => (
                    <option key={l.id} value={l.id}>{l.nomLot}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cort / Nau *</label>
                <select
                  value={cortId}
                  onChange={(e) => setCortId(e.target.value ? Number(e.target.value) : '')}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                  disabled={estat === 'enviant'}
                >
                  <option value="">Selecciona una cort</option>
                  {catalegs?.corts.map((c) => (
                    <option key={c.id} value={c.id}>{c.nomZona} — {c.codiCort}</option>
                  ))}
                </select>
              </div>

              {errorMsg && (
                <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                  {errorMsg}
                </p>
              )}
            </form>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          {estat === 'completat' ? (
            <button
              onClick={onAltaCompletada}
              className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                         font-medium rounded-lg min-h-[44px]"
            >
              Tancar i actualitzar llistat
            </button>
          ) : (
            <>
              <button
                onClick={onTancar}
                className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 font-medium rounded-lg min-h-[44px]"
              >
                Cancel·lar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!potConfirmar || estat === 'enviant'}
                className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                           font-medium rounded-lg min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {estat === 'enviant' ? 'Desant...' : 'Donar d\'alta'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
