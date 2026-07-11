'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

type ModalBaixaProps = {
  animalId: number
  animalDib: string
  onTancar: () => void
  onConfirmada: () => void
}

type Motiu = 'Venda' | 'Mort'
type Estat = 'idle' | 'enviant' | 'error'

/**
 * Modal de registre de baixa d'un animal (venda o mort), reutilitzant
 * exactament els camps documentats a docs/07_modul_arxiu_historic.md,
 * seccions 3.1 (venda) i 4.1 (mort).
 *
 * @param props.animalDib - DIB de l'animal, per al títol del modal
 * @param props.onTancar - Callback per tancar sense confirmar
 * @param props.onConfirmada - Callback en confirmar amb èxit
 * @returns Modal amb selector de motiu i el formulari corresponent
 *
 * @remarks Control d'accés: aquest component només es munta des de
 * la fitxa d'un animal actiu, quan rol === 'Admin' || 'Veterinari'
 * (docs/08_modul_llistat_actius.md). L'endpoint
 * POST /api/animals/[id]/baixa torna a validar el rol igualment.
 * @remarks Si l'animal té bloqueig comercial actiu, l'endpoint
 * rebutja la venda amb 409 i el missatge es mostra tal qual
 * (docs/07_modul_arxiu_historic.md, secció 3.3).
 */
export function ModalBaixa({ animalId, animalDib, onTancar, onConfirmada }: ModalBaixaProps) {
  const [motiu, setMotiu] = useState<Motiu>('Venda')
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().slice(0, 10))
  // Camps de venda
  const [pesViuKg, setPesViuKg] = useState('')
  const [pesCanalKg, setPesCanalKg] = useState('')
  const [preuKg, setPreuKg] = useState('')
  const [costTransport, setCostTransport] = useState('')
  const [compradorEscorxador, setCompradorEscorxador] = useState('')
  // Camps de mort
  const [causaMort, setCausaMort] = useState('')
  const [codiRecollidaCadavers, setCodiRecollidaCadavers] = useState('')

  const [estat, setEstat] = useState<Estat>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const potConfirmar =
    motiu === 'Venda'
      ? pesViuKg.trim() !== '' && preuKg.trim() !== ''
      : causaMort.trim() !== '' && codiRecollidaCadavers.trim() !== ''

  async function handleConfirmar() {
    if (!potConfirmar) return
    setEstat('enviant')
    setErrorMsg(null)

    const body =
      motiu === 'Venda'
        ? {
            motiu: 'Venda' as const,
            dataBaixa,
            pesViuKg: Number(pesViuKg),
            pesCanalKg: pesCanalKg.trim() ? Number(pesCanalKg) : undefined,
            preuKg: Number(preuKg),
            costTransport: costTransport.trim() ? Number(costTransport) : undefined,
            compradorEscorxador: compradorEscorxador.trim() || undefined,
          }
        : {
            motiu: 'Mort' as const,
            dataBaixa,
            causaMort,
            codiRecollidaCadavers,
          }

    try {
      const res = await fetch(`/api/animals/${animalId}/baixa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en registrar la baixa')
      onConfirmada()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconegut')
      setEstat('error')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Donar de baixa — {animalDib}</h2>
          <button
            onClick={onTancar}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
            aria-label="Tancar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMotiu('Venda')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${motiu === 'Venda' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Venda
            </button>
            <button
              type="button"
              onClick={() => setMotiu('Mort')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium ${motiu === 'Mort' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Mort
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de baixa *</label>
            <input
              type="date"
              value={dataBaixa}
              onChange={(e) => setDataBaixa(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
            />
          </div>

          {motiu === 'Venda' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pes en viu (kg) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={pesViuKg}
                  onChange={(e) => setPesViuKg(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pes en canal (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pesCanalKg}
                  onChange={(e) => setPesCanalKg(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preu per kg (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={preuKg}
                  onChange={(e) => setPreuKg(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost de transport (€)</label>
                <input
                  type="number"
                  step="0.01"
                  value={costTransport}
                  onChange={(e) => setCostTransport(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comprador / Escorxador</label>
                <input
                  type="text"
                  value={compradorEscorxador}
                  onChange={(e) => setCompradorEscorxador(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Causa de la mort *</label>
                <select
                  value={causaMort}
                  onChange={(e) => setCausaMort(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                >
                  <option value="">Selecciona una causa</option>
                  <option value="Malaltia respiratòria">Malaltia respiratòria</option>
                  <option value="Malaltia digestiva">Malaltia digestiva</option>
                  <option value="Accident">Accident</option>
                  <option value="Part complicat">Part complicat</option>
                  <option value="Causa desconeguda">Causa desconeguda</option>
                  <option value="Altra">Altra (especificar)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Codi de recollida de cadàvers *
                </label>
                <input
                  type="text"
                  value={codiRecollidaCadavers}
                  onChange={(e) => setCodiRecollidaCadavers(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Necessari per a tràmits d&apos;assegurança i DARP.
                </p>
              </div>
            </>
          )}

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
            onClick={handleConfirmar}
            disabled={!potConfirmar || estat === 'enviant'}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white
                       font-medium rounded-lg min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {estat === 'enviant' ? 'Registrant...' : 'Confirmar baixa'}
          </button>
        </div>
      </div>
    </div>
  )
}
