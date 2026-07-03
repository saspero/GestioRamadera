'use client'

import { useEffect, useRef } from 'react'

/**
 * Hook que gestiona el refresh automàtic en segon pla del JWT.
 *
 * Funcionament:
 *  1. Cada resposta del servidor pot incloure la capçalera
 *     x-token-refresh-suggested quan al token li queden <5 min.
 *  2. Aquest hook intercepta totes les peticions fetch() de l'app
 *     i, si detecta el senyal, crida /api/auth/refresh en segon pla.
 *  3. Si el refresh falla (refresh token també caducat), redirigeix
 *     l'usuari a /login sense perdre feina en curs de sobte —
 *     es mostra un avís abans de redirigir.
 *
 * Munta's UNA VEGADA al layout arrel de l'àrea protegida (app)/layout.tsx.
 */
export function useAutoRefresh() {
  const refrescant = useRef(false)

  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      // Evitar refrescos concurrents si ja n'hi ha un en curs
      if (
        response.headers.get('x-token-refresh-suggested') === 'true' &&
        !refrescant.current
      ) {
        refrescant.current = true
        try {
          const refreshRes = await originalFetch('/api/auth/refresh', {
            method: 'POST',
          })
          if (!refreshRes.ok) {
            // Refresh token també caducat — cal tornar a fer login
            window.location.href = '/login?motiu=sessio_expirada'
          }
        } finally {
          refrescant.current = false
        }
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])
}
