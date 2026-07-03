'use client'

// TODO: Implementar Sidebar amb navegació lateral
// Veure: docs/06_modul_navegacio.md — Estructura de Navegació
// Mòduls: Dashboard, Animals, Logística, Sanitari, Arxiu, Configuració
// Rols: cada rol veu únicament les seccions que li corresponen

import type { Rol } from '@/types/db'

type SidebarProps = {
  rol: Rol
}

export function Sidebar({ rol }: SidebarProps) {
  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white p-4">
      <div className="text-lg font-bold mb-6">Gestió Ramadera</div>
      {/* TODO: Implementar items de navegació filtrats per rol */}
      <p className="text-gray-400 text-sm">Sidebar pendent — rol: {rol}</p>
    </aside>
  )
}
