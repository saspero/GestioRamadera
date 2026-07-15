'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TaulaArxiu } from '@/components/arxiu/TaulaArxiu'
import { FitxaArxiuModal } from '@/components/arxiu/FitxaArxiuModal'
import { CercadorRapid } from '@/components/shared/CercadorRapid'
import { useSessio } from '@/lib/session/SessioContext'
import { queryKeys } from '@/lib/query/queryKeys'
import type { AnimalInactiu } from '@/types/arxiu'

/**
 * Pàgina del mòdul Arxiu: consulta d'animals donats de baixa (venda
 * o mort), amb cercador, filtre de motiu i rang de dates.
 *
 * @returns Pàgina amb filtres, taula paginada i fitxa de detall
 *
 * @remarks Mòdul exclusivament de consulta (docs/07_modul_arxiu_historic.md,
 * secció 1) — el registre de la baixa en si ja es fa des de la
 * fitxa d'un animal actiu, al mòdul Animals (ModalBaixa). Aquí
 * només es consulta l'històric, no s'hi pot escriure res.
 * @remarks Control d'accés: Admin i Veterinari, tots dos només amb
 * lectura (no hi ha cap acció d'escriptura en aquest mòdul).
 * Treballador sense accés en absolut — el Sidebar ja no li mostra
 * l'enllaç.
 * @remarks Filtres (cerca, motiu, rang de dates) resolts al backend
 * — la query key inclou tots els filtres perquè cada combinació es
 * cachegi independentment.
 */
export default function ArxiuPage() {
  const { rol } = useSessio()

  const [cerca, setCerca] = useState('')
  const [cercaDebounced, setCercaDebounced] = useState('')
  const [motiu, setMotiu] = useState<'Tots' | 'Venda' | 'Mort'>('Tots')
  const [dataDes, setDataDes] = useState('')
  const [dataFins, setDataFins] = useState('')
  const [animalObertId, setAnimalObertId] = useState<number | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => setCercaDebounced(cerca), 250)
    return () => clearTimeout(timeout)
  }, [cerca])

  const { data: animals = [], isLoading } = useQuery<AnimalInactiu[]>({
    queryKey: queryKeys.arxiu.llistat(cercaDebounced, motiu, dataDes, dataFins),
    queryFn: () => {
      const params = new URLSearchParams()
      if (cercaDebounced) params.set('cerca', cercaDebounced)
      if (motiu !== 'Tots') params.set('motiu', motiu)
      if (dataDes) params.set('dataDes', dataDes)
      if (dataFins) params.set('dataFins', dataFins)
      return fetch(`/api/arxiu?${params.toString()}`).then((res) => res.json()).then((j) => j.animals)
    },
  })

  if (rol === 'Treballador') {
    return (
      <div className="text-center py-16 text-gray-500">
        No tens accés a aquest mòdul.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Arxiu / Històric</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <CercadorRapid valor={cerca} onChange={setCerca} placeholder="Cercar per DIB..." />

        <div className="flex flex-wrap gap-2">
          <select
            value={motiu}
            onChange={(e) => setMotiu(e.target.value as typeof motiu)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="Tots">Tots els motius</option>
            <option value="Venda">Venda</option>
            <option value="Mort">Mort</option>
          </select>

          <input
            type="date"
            value={dataDes}
            onChange={(e) => setDataDes(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Des de"
          />
          <input
            type="date"
            value={dataFins}
            onChange={(e) => setDataFins(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Fins a"
          />
        </div>
      </div>

      <TaulaArxiu
        animals={animals}
        carregant={isLoading}
        onObrirFitxa={(id) => setAnimalObertId(id)}
      />

      {animalObertId !== null && (
        <FitxaArxiuModal animalId={animalObertId} onTancar={() => setAnimalObertId(null)} />
      )}
    </div>
  )
}
