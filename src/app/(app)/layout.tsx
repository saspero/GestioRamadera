'use client'

import { useAutoRefresh } from '@/hooks/useAutoRefresh'

// Layout per a totes les rutes protegides (amb sidebar).
// El middleware ja ha verificat que l'usuari té sessió vàlida
// abans d'arribar aquí. Aquest layout afegeix la navegació lateral
// i activa el refresh automàtic del JWT en segon pla.

// TODO: Implementar Sidebar i Header (rebre el rol via server component pare)
export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useAutoRefresh()

  return (
    <div className="min-h-screen flex">
      {/* TODO: <Sidebar rol={rol} /> */}
      <main className="flex-1 p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}
