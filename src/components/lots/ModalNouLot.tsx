'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

type ModalNouLotProps = {
  onTancar: () => void
  onDesar: (nomLot: string) => Promise<void>
}

/**
 * Modal de creació d'un lot nou.
 *
 * @param props.onTancar - Callback per tancar el modal sense desar
 * @param props.onDesar - Callback que envia el nom al backend
 * @returns Modal amb un únic camp de text
 *
 * @remarks Control d'accés: aquest component només es munta des de
 * la pàgina de Lots quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalNouLot({ onTancar, onDesar }: ModalNouLotProps) {
  const [nom, setNom] = useState('')
  const [enviant, setEnviant] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim()) return

    setEnviant(true)
    setErrorMsg(null)
    try {
      await onDesar(nom.trim())
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
          <h2 className="text-lg font-semibold text-gray-900">Nou lot</h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom del lot *</label>
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
              {enviant ? 'Desant...' : 'Crear lot'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
