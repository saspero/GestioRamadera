'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { SessioProvider } from '@/lib/session/SessioContext'
import type { Rol } from '@/types/db'

/**
 * Propietats del component AppShell.
 */
type AppShellProps = {
  /** Rol de l'usuari autenticat (llegit al servidor a partir del JWT) */
  rol: Rol
  /** Nom de l'usuari autenticat */
  nom: string
  /** Contingut de la pàgina actual */
  children: React.ReactNode
}

/**
 * Estructura visual principal de l'àrea protegida de l'aplicació.
 *
 * Orquestra el Sidebar (navegació), el Header (només mòbil, amb
 * botó hamburguesa) i el contingut de cada pàgina. Gestiona l'estat
 * d'obert/tancat del Sidebar en vista mòbil.
 *
 * També activa el refresc automàtic del JWT en segon pla mitjançant
 * useAutoRefresh() (veure docs/11_arquitectura_nextjs.md, secció 5.5).
 *
 * @param props - Propietats del component
 * @param props.rol - Rol de l'usuari autenticat (Admin, Veterinari o Treballador)
 * @param props.nom - Nom complet de l'usuari autenticat
 * @param props.children - Contingut de la pàgina concreta a renderitzar dins l'àrea principal
 * @returns Estructura completa amb Sidebar + Header + contingut
 *
 * @remarks Control d'accés per rol: aquest component no aplica cap
 * filtre de rol directament — es limita a propagar `rol` al Sidebar,
 * que és qui decideix quines seccions de navegació es mostren
 * (veure src/lib/navigation/menuItems.ts). La protecció real de les
 * rutes i dades és responsabilitat del middleware i de cada API Route.
 *
 * @remarks Multitenancy: aquest component no toca dades de cap tenant
 * directament; només rep `rol` i `nom`, ja resolts pel Server Component
 * pare (src/app/(app)/layout.tsx) a partir de la sessió JWT. Cap dada
 * de BD es llegeix aquí — les pàgines filles (children) són les
 * responsables de cridar queryTenant() amb el seu propi search_path.
 * @remarks Exposa `rol` i `nom` a totes les pàgines filles via
 * SessioProvider (src/lib/session/SessioContext.tsx), evitant que
 * cada pàgina hagi de fer una petició pròpia només per conèixer el rol.
 */
export function AppShell({ rol, nom, children }: AppShellProps) {
  const [sidebarObert, setSidebarObert] = useState(false)

  useAutoRefresh()

  return (
    <div className="min-h-screen flex">
      <Sidebar
        rol={rol}
        nom={nom}
        obertMobil={sidebarObert}
        onTancarMobil={() => setSidebarObert(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header onObrirMenu={() => setSidebarObert(true)} />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <SessioProvider value={{ rol, nom }}>{children}</SessioProvider>
        </main>
      </div>
    </div>
  )
}
