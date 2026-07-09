'use client'

import { createContext, useContext } from 'react'
import type { Rol } from '@/types/db'

type SessioContextValue = {
  rol: Rol
  nom: string
}

const SessioContext = createContext<SessioContextValue | null>(null)

/**
 * Proveïdor del context de sessió (rol i nom de l'usuari autenticat).
 *
 * @param props.value - Rol i nom resolts al servidor a partir del JWT
 * @param props.children - Arbre de components que podrà consumir el context
 * @returns Provider de React Context
 *
 * @remarks Es munta una sola vegada a AppShell (src/components/layout/AppShell.tsx),
 * que ja rep `rol` i `nom` del Server Component pare (layout.tsx). No
 * fa cap petició pròpia ni toca la BD.
 */
export function SessioProvider({
  value,
  children,
}: {
  value: SessioContextValue
  children: React.ReactNode
}) {
  return <SessioContext.Provider value={value}>{children}</SessioContext.Provider>
}

/**
 * Hook per llegir el rol i nom de l'usuari autenticat des de qualsevol
 * pàgina o component dins de l'àrea protegida `(app)`.
 *
 * @returns Rol i nom de la sessió actual
 * @throws Error si es crida fora d'un SessioProvider (indicaria que
 * el component s'ha muntat fora de l'àrea protegida, un error de
 * disseny que val la pena detectar en desenvolupament)
 *
 * @remarks Control d'accés: aquest hook NOMÉS reflecteix el rol que
 * ja ha estat validat pel JWT al servidor (src/app/(app)/layout.tsx).
 * No és una font d'autorització en si mateixa — els components que
 * el fan servir per mostrar/amagar UI (p. ex. el botó d'alta massiva
 * a la pàgina d'animals) confien en aquest valor només a efectes
 * visuals; la protecció real és sempre a l'endpoint corresponent.
 */
export function useSessio(): SessioContextValue {
  const ctx = useContext(SessioContext)
  if (!ctx) {
    throw new Error('useSessio() s\'ha de cridar dins d\'un SessioProvider')
  }
  return ctx
}
