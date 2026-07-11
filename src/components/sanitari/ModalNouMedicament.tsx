'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

type ModalNouMedicamentProps = {
  onTancar: () => void
  onDesat: () => void
}

/**
 * Modal de creació manual d'un medicament (fora del flux CSV).
 *
 * @param props.onTancar - Callback per tancar sense desar
 * @param props.onDesat - Callback en confirmar amb èxit
 * @returns Modal amb el formulari complet de la fitxa del medicament
 *
 * @remarks Camps segons docs/06_modul_sanitari.md, secció 2.1.
 * @remarks Control d'accés: només es munta des de la pàgina de
 * Sanitari quan rol === 'Admin' || 'Veterinari'.
 */
export function ModalNouMedicament({ onTancar, onDesat }: ModalNouMedicamentProps) {
  const [nomMedicament, setNomMedicament] = useState('')
  const [principiActiu, setPrincipiActiu] = useState('')
  const [lot, setLot] = useState('')
  const [quantitatEstoc, setQuantitatEstoc] = useState('')
  const [unitatEstoc, setUnitatEstoc] = useState('ml')
  const [posologiaStandard, setPosologiaStandard] = useState('')
  const [preuCompra, setPreuCompra] = useState('')
  const [diesSupressio, setDiesSupressio] = useState('')

  const [enviant, setEnviant] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const potConfirmar =
    nomMedicament.trim() &&
    principiActiu.trim() &&
    lot.trim() &&
    quantitatEstoc.trim() &&
    unitatEstoc.trim() &&
    preuCompra.trim() &&
    diesSupressio.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!potConfirmar) return

    setEnviant(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/sanitari/medicaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomMedicament: nomMedicament.trim(),
          principiActiu: principiActiu.trim(),
          lot: lot.trim(),
          quantitatEstoc: Number(quantitatEstoc),
          unitatEstoc: unitatEstoc.trim(),
          posologiaStandard: posologiaStandard.trim() || undefined,
          preuCompra: Number(preuCompra),
          diesSupressio: Number(diesSupressio),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en crear el medicament')
      onDesat()
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
          <h2 className="text-lg font-semibold text-gray-900">Nou medicament</h2>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom del medicament *</label>
            <input
              type="text"
              value={nomMedicament}
              onChange={(e) => setNomMedicament(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={enviant}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Principi actiu *</label>
            <input
              type="text"
              value={principiActiu}
              onChange={(e) => setPrincipiActiu(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={enviant}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lot *</label>
            <input
              type="text"
              value={lot}
              onChange={(e) => setLot(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={enviant}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantitat *</label>
              <input
                type="number"
                step="0.001"
                value={quantitatEstoc}
                onChange={(e) => setQuantitatEstoc(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                disabled={enviant}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unitat *</label>
              <input
                type="text"
                value={unitatEstoc}
                onChange={(e) => setUnitatEstoc(e.target.value)}
                placeholder="ml, g, unitats..."
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                disabled={enviant}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posologia estàndard</label>
            <textarea
              value={posologiaStandard}
              onChange={(e) => setPosologiaStandard(e.target.value)}
              placeholder="Opcional"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              disabled={enviant}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preu de compra (€) *</label>
              <input
                type="number"
                step="0.01"
                value={preuCompra}
                onChange={(e) => setPreuCompra(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                disabled={enviant}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dies de supressió *</label>
              <input
                type="number"
                min="0"
                value={diesSupressio}
                onChange={(e) => setDiesSupressio(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                disabled={enviant}
              />
            </div>
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
            {enviant ? 'Desant...' : 'Crear medicament'}
          </button>
        </div>
      </div>
    </div>
  )
}
