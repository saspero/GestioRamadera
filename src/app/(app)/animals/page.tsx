import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Animals',
}

// TODO: Implementar mòdul d'animals
// Veure: docs/08_modul_llistat_actius.md
export default function Page() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Animals</h1>
      <p className="text-gray-500 mt-2">Pendent d&apos;implementar</p>
    </div>
  )
}
