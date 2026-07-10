'use client'

import { useState, useEffect } from 'react'
import type { AnimalActiu } from '@/types/db'

/**
 * Hook per carregar i gestionar els animals actius.
 * Inclou cerca en temps real pel DIB.
 *
 * @remarks No utilitzat actualment — src/app/(app)/animals/page.tsx
 * implementa la seva pròpia lògica de càrrega amb debounce. Es manté
 * disponible per si cal reutilitzar-lo en un altre punt de l'app.
 */
export function useAnimals() {
  const [animals, setAnimals]   = useState<AnimalActiu[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [cerca, setCerca]       = useState('')

  useEffect(() => {
    async function carregar() {
      try {
        setLoading(true)
        const url = cerca
          ? `/api/animals?cerca=${encodeURIComponent(cerca)}`
          : '/api/animals'
        const res = await fetch(url)
        if (!res.ok) throw new Error('Error en carregar animals')
        const { animals } = await res.json()
        setAnimals(animals)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconegut')
      } finally {
        setLoading(false)
      }
    }
    carregar()
  }, [cerca])

  return { animals, loading, error, cerca, setCerca }
}
