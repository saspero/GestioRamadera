'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { ModalAccions } from '@/components/ui/ModalAccions'
import { queryKeys } from '@/lib/query/queryKeys'
import { toastExit, toastError } from '@/lib/toast/toastHelpers'

type ModalBaixaProps = {
  animalId: number
  animalDib: string
  onTancar: () => void
  onConfirmada: () => void
}

type Motiu = 'Venda' | 'Mort'

/**
 * Modal de registre de baixa d'un animal (venda o mort), reutilitzant
 * exactament els camps documentats a docs/07_modul_arxiu_historic.md,
 * seccions 3.1 (venda) i 4.1 (mort).
 *
 * @param props.animalId - Id de l'animal
 * @param props.animalDib - DIB de l'animal, per al títol del modal
 * @param props.onTancar - Callback per tancar sense confirmar
 * @param props.onConfirmada - Callback en confirmar amb èxit
 * @returns Modal amb selector de motiu i el formulari corresponent
 *
 * @remarks MIGRACIÓ REACT QUERY: la confirmació és una useMutation
 * que invalida queryKeys.animals.all (l'animal deixa de sortir al
 * llistat) i queryKeys.animals.fitxa(animalId) (per si es torna a
 * consultar). S'obre com a <Modal sobreposat> perquè es munta a
 * sobre de FitxaAnimalModal (z-index elevat).
 * @remarks Control d'accés: es munta des de la fitxa d'un animal
 * actiu, quan rol === 'Admin' || 'Veterinari'. L'endpoint torna a
 * validar el rol igualment.
 * @remarks Si l'animal té bloqueig comercial actiu, l'endpoint
 * rebutja la venda amb 409 i el missatge es mostra tal qual
 * (docs/07_modul_arxiu_historic.md, secció 3.3) — tant en toast com
 * dins del modal (reforç visual confirmat amb l'usuari).
 */
export function ModalBaixa({ animalId, animalDib, onTancar, onConfirmada }: ModalBaixaProps) {
  const queryClient = useQueryClient()

  const [motiu, setMotiu] = useState<Motiu>('Venda')
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().slice(0, 10))
  const [pesViuKg, setPesViuKg] = useState('')
  const [pesCanalKg, setPesCanalKg] = useState('')
  const [preuKg, setPreuKg] = useState('')
  const [costTransport, setCostTransport] = useState('')
  const [compradorEscorxador, setCompradorEscorxador] = useState('')
  const [causaMort, setCausaMort] = useState('')
  const [codiRecollidaCadavers, setCodiRecollidaCadavers] = useState('')

  const potConfirmar =
    motiu === 'Venda'
      ? pesViuKg.trim() !== '' && preuKg.trim() !== ''
      : causaMort.trim() !== '' && codiRecollidaCadavers.trim() !== ''

  const mutacio = useMutation({
    mutationFn: async () => {
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

      const res = await fetch(`/api/animals/${animalId}/baixa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en registrar la baixa')
      return json
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.animals.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.animals.fitxa(animalId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.lots.all })
      toastExit(`Baixa registrada per a ${animalDib}`)
      onConfirmada()
    },
    onError: (err) => toastError(err, 'Error en registrar la baixa'),
  })

  const peu = (
    <ModalAccions
      onCancelar={onTancar}
      onConfirmar={() => mutacio.mutate()}
      textConfirmar="Confirmar baixa"
      textEnviant="Registrant..."
      enviant={mutacio.isPending}
      disabled={!potConfirmar}
      variant="perill"
    />
  )

  return (
    <Modal titol={`Donar de baixa — ${animalDib}`} onTancar={onTancar} peu={peu} sobreposat>
      <div className="space-y-4">
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

        {mutacio.isError && (
          <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
            {mutacio.error instanceof Error ? mutacio.error.message : 'Error desconegut'}
          </p>
        )}
      </div>
    </Modal>
  )
}
