'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { ZonaInfraestructura, TipusZona } from '@/types/infraestructura'

type ModalZonaProps = {
  /** Ubicació on es crearà la zona (obligatori en mode creació). */
  ubicacioId: number
  /** Si s'informa, el modal edita aquesta zona; si no, en crea una de nova. */
  zonaExistent?: ZonaInfraestructura
  onTancar: () => void
  onDesar: (params: { nom: string; tipusZona: TipusZona }) => Promise<void>
}

const ETIQUETES_TIPUS: Record<TipusZona, string> = {
  NAU_ANIMALS: 'Nau d\'animals',
  COBERT_EMMAGATZEMATGE: 'Cobert d\'emmagatzematge',
  PASTURA: 'Pastura',
}

/**
 * Modal de creació/edició d'una Zona dins d'una Granja.
 *
 * @param props.ubicacioId - Granja on es crearà la zona
 * @param props.zonaExistent - Si es passa, el formulari s'omple amb
 * les seves dades i actua en mode edició (el tipus queda bloquejat)
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onDesar - Callback que envia les dades al backend
 * @returns Modal amb formulari de nom i tipus de zona
 *
 * @remarks El tipus de zona NO es pot canviar en mode edició: si la
 * zona ja té corts o magatzems associats, canviar-ne el tipus
 * trencaria les restriccions validades pels triggers de BD (veure
 * src/lib/db/queries/infraestructura.ts, actualitzarZona).
 * @remarks Control d'accés: aquest component només es munta des de
 * la pàgina de Granja/Corts quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalZona({ ubicacioId, zonaExistent, onTancar, onDesar }: ModalZonaProps) {
  const [nom, setNom] = useState(zonaExistent?.nom ?? '')
  const [tipusZona, setTipusZona] = useState<TipusZona>(zonaExistent?.tipusZona ?? 'NAU_ANIMALS')
  const [enviant, setEnviant] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return

    setEnviant(true)
    setErrorMsg(null)
    try {
      await onDesar({ nom: nom.trim(), tipusZona })
      onTancar()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setEnviant(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {zonaExistent ? 'Editar zona' : 'Nova zona'}
          </h2>
          <button
            onClick={onTancar}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={enviant}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipus de zona *
              {zonaExistent && (
                <span className="font-normal text-gray-400"> (no es pot canviar un cop creada)</span>
              )}
            </label>
            <select
              value={tipusZona}
              onChange={(e) => setTipusZona(e.target.value as TipusZona)}
              disabled={enviant || !!zonaExistent}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base disabled:bg-gray-100"
            >
              {(Object.keys(ETIQUETES_TIPUS) as TipusZona[]).map((tipus) => (
                <option key={tipus} value={tipus}>{ETIQUETES_TIPUS[tipus]}</option>
              ))}
            </select>
          </div>

          {errorMsg && (
            <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onTancar}
              className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 font-medium rounded-lg min-h-[44px]"
            >
              Cancel·lar
            </button>
            <button
              type="submit"
              disabled={!nom.trim() || enviant}
              className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white
                         font-medium rounded-lg min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {enviant ? 'Desant...' : 'Desar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
