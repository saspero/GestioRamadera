'use client'

import { useEffect, useState } from 'react'
import { TotalAnimalsCard } from '@/components/dashboard/TotalAnimalsCard'
import { LotsActiusTable } from '@/components/dashboard/LotsActiusTable'
import { EstocMagatzemsList } from '@/components/dashboard/EstocMagatzemsList'
import { AlertesEstocCard } from '@/components/dashboard/AlertesEstocCard'
import { AnimalsEnSupressioList } from '@/components/dashboard/AnimalsEnSupressioList'
import { UltimesBaixesList } from '@/components/dashboard/UltimesBaixesList'
import { DistribucioSalutCard } from '@/components/dashboard/DistribucioSalutCard'
import type { DashboardResponse } from '@/types/dashboard'

/**
 * Pàgina principal del Dashboard.
 *
 * Carrega totes les dades de resum en una única crida a
 * GET /api/dashboard i renderitza únicament els blocs presents a la
 * resposta. Un bloc absent significa que el rol de l'usuari no hi té
 * accés (filtrat prèviament pel backend) — la pàgina no fa cap
 * comprovació de rol pròpia, confia completament en la resposta del
 * servidor.
 *
 * @returns Pàgina del Dashboard amb els blocs de resum operatiu
 *
 * @remarks Control d'accés: el contingut visible varia per rol perquè
 * el backend (src/app/api/dashboard/route.ts) només inclou a la
 * resposta els blocs corresponents al rol de l'usuari autenticat.
 * @remarks Multitenancy: aquesta pàgina no toca la BD directament;
 * tota la lectura de dades passa per l'endpoint, que aplica el
 * search_path del tenant de l'usuari.
 */
export default function DashboardPage() {
  const [dades, setDades] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [carregant, setCarregant] = useState(true)

  useEffect(() => {
    async function carregarDashboard() {
      try {
        const res = await fetch('/api/dashboard')
        if (!res.ok) {
          throw new Error('No s\'han pogut carregar les dades del Dashboard')
        }
        const json: DashboardResponse = await res.json()
        setDades(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconegut')
      } finally {
        setCarregant(false)
      }
    }
    carregarDashboard()
  }, [])

  if (carregant) {
    return (
      <div className="text-gray-500 text-sm">Carregant el Dashboard...</div>
    )
  }

  if (error || !dades) {
    return (
      <div className="text-red-600 text-sm bg-red-50 rounded-lg p-4">
        {error ?? 'No s\'han pogut carregar les dades.'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Alertes crítiques d'estoc, destacades a dalt de tot si n'hi ha */}
      {dades.alertesEstoc && <AlertesEstocCard dades={dades.alertesEstoc} />}

      {/* Resum operatiu bàsic: visible per als 3 rols */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dades.totalAnimals && <TotalAnimalsCard dades={dades.totalAnimals} />}
        {dades.distribucioSalut && <DistribucioSalutCard dades={dades.distribucioSalut} />}
      </div>

      {dades.lotsActius && <LotsActiusTable dades={dades.lotsActius} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dades.estocMagatzems && <EstocMagatzemsList dades={dades.estocMagatzems} />}
        {dades.animalsEnSupressio && (
          <AnimalsEnSupressioList dades={dades.animalsEnSupressio} />
        )}
      </div>

      {dades.ultimesBaixes && <UltimesBaixesList dades={dades.ultimesBaixes} />}
    </div>
  )
}
