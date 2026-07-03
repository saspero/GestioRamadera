'use client'

import { useState, useEffect } from 'react'
import type { Rol } from '@/types/db'

type Session = {
  rol: Rol
  nom: string
} | null

/**
 * Hook per accedir a les dades bàsiques de la sessió al client.
 * NOTA: Les dades sensibles (tenantSchema, userId) mai arriben al client.
 * Aquest hook només conté el rol i el nom per a la UI.
 */
export function useSession() {
  const [session, setSession] = useState<Session>(null)
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    // Les dades de sessió es passen des del server component via props
    // Aquest hook és per a casos on calgui llegir la sessió al client
    setLoading(false)
  }, [])

  return { session, loading }
}
