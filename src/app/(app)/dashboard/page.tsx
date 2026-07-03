import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

// TODO: Implementar Dashboard
// Veure: docs/06_modul_navegacio.md — Secció Dashboard
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-gray-500 mt-2">Pendent d&apos;implementar</p>
    </div>
  )
}
