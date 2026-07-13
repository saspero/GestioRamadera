'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Proveïdor de React Query per a tota l'àrea protegida de l'aplicació.
 *
 * @param props.children - Arbre de components que podrà fer servir
 * useQuery/useMutation
 * @returns Provider de React Query amb un QueryClient per sessió de navegador
 *
 * @remarks staleTime de 30 segons: evita refetches immediats en
 * canviar de pestanya/pàgina i tornar (comú a l'ús a peu de granja,
 * on l'usuari pot anar i venir entre mòduls sovint). Les mutacions
 * (useMutation) invaliden explícitament les queries afectades, així
 * que les dades es refresquen igualment després de qualsevol escriptura.
 * @remarks retry: 1 (no els 3 reintents per defecte) — amb connexió
 * intermitent a la granja, val més fallar ràpid i mostrar l'error
 * (gestionat pel sistema de toasts) que fer esperar l'usuari amb
 * reintents silenciosos.
 * @remarks Es crea un QueryClient nou per useState (no com a
 * constant fora del component) seguint la recomanació oficial de
 * React Query per a Next.js App Router — evita compartir estat de
 * cache entre peticions de servidor diferents.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
