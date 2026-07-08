import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { queryPublic } from '@/lib/db/client'
import { AppShell } from '@/components/layout/AppShell'
import type { Rol } from '@/types/db'

type UsuariNom = { nom: string }

/**
 * Layout arrel de totes les rutes protegides (grup de rutes `(app)`).
 *
 * Aquest layout és un Server Component: llegeix la sessió directament
 * de les cookies (sense passar per fetch), en resol el nom de l'usuari
 * a la base de dades, i delega tota la interactivitat (Sidebar
 * collapsable, refresc automàtic) a AppShell, que és un Client Component.
 *
 * @param children - Contingut de la pàgina concreta que es renderitza
 * dins de l'àrea protegida (injectat automàticament per Next.js App Router)
 * @returns Layout amb Sidebar + Header + contingut, o redirecció a /login
 * si no hi ha sessió vàlida
 *
 * @remarks Control d'accés: el middleware (src/middleware.ts) ja bloqueja
 * l'accés sense JWT vàlid abans que aquest layout s'executi. Aquesta
 * comprovació getSession() és una segona capa de defensa pròpia del
 * Server Component, per si el layout es renderitzés en un context on
 * el middleware no s'hagués aplicat (per exemple, en tests o rendering
 * intern de Next.js). El rol de l'usuari (session.rol) prové del JWT
 * signat pel backend i no és manipulable pel client.
 *
 * @remarks Multitenancy: NO es consulta cap dada del tenant aquí, només
 * el nom de l'usuari al schema public (queryPublic). Les dades pròpies
 * de cada tenant es carreguen dins de cada pàgina/API Route amb
 * queryTenant() i el search_path corresponent al tenantSchema de la sessió.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const rows = await queryPublic<UsuariNom>(
    `SELECT nom FROM public.users WHERE id = $1`,
    [Number(session.sub)]
  )

  const nom = rows[0]?.nom ?? 'Usuari'
  const rol = session.rol as Rol

  return (
    <AppShell rol={rol} nom={nom}>
      {children}
    </AppShell>
  )
}
