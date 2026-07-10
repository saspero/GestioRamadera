'use client'

import { useState, useCallback, useEffect } from 'react'
import type { UbicacioAmbJerarquia, TipusZona } from '@/types/infraestructura'

/**
 * Hook que centralitza la càrrega i les mutacions de la jerarquia
 * Granja → Zona → Cort.
 *
 * @returns Estat de la jerarquia i funcions per crear/actualitzar
 * cadascun dels tres nivells
 *
 * @remarks Control d'accés: aquest hook no fa cap comprovació de rol
 * — assumeix que només es munta dins d'una pantalla ja protegida per
 * a Admin/Veterinari. Els endpoints tornen a validar el rol igualment.
 * @remarks Seguir el flux descrit a docs/13_modul_granja_corts.md.
 */
export function useInfraestructura() {
  const [ubicacions, setUbicacions] = useState<UbicacioAmbJerarquia[]>([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregant(true)
    setError(null)
    try {
      const res = await fetch('/api/infraestructura')
      if (!res.ok) throw new Error('Error en carregar la infraestructura')
      const json = await res.json()
      setUbicacions(json.ubicacions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconegut')
    } finally {
      setCarregant(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Crea una nova ubicació (granja).
   * @throws Error amb el missatge del servidor si la petició falla
   */
  const crearUbicacio = useCallback(
    async (params: { nom: string; codiPasturaExtensiu?: string }) => {
      const res = await fetch('/api/infraestructura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en crear la granja')
      await carregar()
    },
    [carregar]
  )

  /**
   * Actualitza una ubicació existent.
   * @throws Error amb el missatge del servidor si la petició falla
   */
  const actualitzarUbicacio = useCallback(
    async (id: number, params: { nom: string; codiPasturaExtensiu?: string }) => {
      const res = await fetch(`/api/infraestructura/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en actualitzar la granja')
      await carregar()
    },
    [carregar]
  )

  /**
   * Crea una nova zona dins d'una ubicació.
   * @throws Error amb el missatge del servidor si la petició falla
   */
  const crearZona = useCallback(
    async (params: { ubicacioId: number; nom: string; tipusZona: TipusZona }) => {
      const res = await fetch('/api/infraestructura/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en crear la zona')
      await carregar()
    },
    [carregar]
  )

  /**
   * Actualitza el nom d'una zona existent.
   * @throws Error amb el missatge del servidor si la petició falla
   */
  const actualitzarZona = useCallback(
    async (id: number, nom: string) => {
      const res = await fetch(`/api/infraestructura/zones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en actualitzar la zona')
      await carregar()
    },
    [carregar]
  )

  /**
   * Crea una nova cort dins d'una zona NAU_ANIMALS.
   * @throws Error amb el missatge del servidor (inclòs el 422 si la
   * zona no és una nau d'animals) si la petició falla
   */
  const crearCort = useCallback(
    async (params: { zonaId: number; codiCort: string; capacitatMaxima?: number }) => {
      const res = await fetch('/api/infraestructura/corts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en crear la cort')
      await carregar()
    },
    [carregar]
  )

  /**
   * Actualitza el codi o la capacitat d'una cort existent.
   * @throws Error amb el missatge del servidor si la petició falla
   */
  const actualitzarCort = useCallback(
    async (id: number, params: { codiCort: string; capacitatMaxima?: number }) => {
      const res = await fetch(`/api/infraestructura/corts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error en actualitzar la cort')
      await carregar()
    },
    [carregar]
  )

  return {
    ubicacions,
    carregant,
    error,
    crearUbicacio,
    actualitzarUbicacio,
    crearZona,
    actualitzarZona,
    crearCort,
    actualitzarCort,
  }
}
