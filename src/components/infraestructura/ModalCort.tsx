'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Cort } from '@/types/infraestructura'

type ModalCortProps = {
  /** Zona on es crearà la cort (obligatori en mode creació; ha de ser NAU_ANIMALS). */
  zonaId: number
  /** Si s'informa, el modal edita aquesta cort; si no, en crea una de nova. */
  cortExistent?: Cort
  onTancar: () => void
  onDesar: (params: { codiCort: string; capacitatMaxima?: number }) => Promise<void>
}

/**
 * Modal de creació/edició d'una Cort dins d'una Zona de tipus NAU_ANIMALS.
 *
 * @param props.zonaId - Zona on es crearà la cort
 * @param props.cortExistent - Si es passa, el formulari s'omple amb
 * les seves dades i actua en mode edició
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onDesar - Callback que envia les dades al backend
 * @returns Modal amb formulari de codi i capacitat màxima
 *
 * @remarks Control d'accés: aquest component només es munta des de
 * la pàgina de Granja/Corts quan rol === 'Admin' || 'Veterinari', i
 * només s'obre des d'una zona ja filtrada com a NAU_ANIMALS (veure
 * pàgina pare) — la BD ho torna a validar amb un trigger igualment.
 */
export function ModalCort({ zonaId, cortExistent, onTancar, onDesar }: ModalCortProps) {
  const [codiCort, setCodiCort] = useState(cortExistent?.codiCort ?? '')
  const [capacitat, setCapacitat] = useState(
    cortExistent?.capacitatMaxima != null ? String(cortExistent.capacitatMaxima) : ''
  )
  const [enviant, setEnviant] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!codiCort.trim()) return

    setEnviant(true)
    setErrorMsg(null)
    try {
      await onDesar({
        codiCort: codiCort.trim(),
        capacitatMaxima: capacitat.trim() ? Number(capacitat) : undefined,
      })
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
            {cortExistent ? 'Editar cort' : 'Nova cort'}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Codi de la cort *</label>
            <input
              type="text"
              value={codiCort}
              onChange={(e) => setCodiCort(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={enviant}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacitat màxima</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={capacitat}
              onChange={(e) => setCapacitat(e.target.value)}
              placeholder="Nombre d'animals (opcional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={enviant}
            />
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
              disabled={!codiCort.trim() || enviant}
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
