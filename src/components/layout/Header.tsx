'use client'

import { Menu } from 'lucide-react'

/**
 * Propietats del component Header.
 */
type HeaderProps = {
  /** Callback per obrir el Sidebar en vista mòbil */
  onObrirMenu: () => void
}

/**
 * Capçalera superior, visible només en mòbil/tauleta (< md).
 *
 * Conté el botó hamburguesa que obre el Sidebar com a overlay.
 * A escriptori aquest component no es renderitza (el Sidebar ja
 * és fix i sempre visible).
 *
 * @param props - Propietats del component
 * @param props.onObrirMenu - Callback invocat en prémer el botó hamburguesa
 * @returns Capçalera fixa a la part superior, només visible en mòbil
 *
 * @remarks Control d'accés: aquest component és purament estructural
 * i no depèn del rol de l'usuari — es mostra igual per a Admin,
 * Veterinari i Treballador. No conté cap element de navegació ni
 * cap dada; només delega l'obertura del Sidebar (que sí és filtrat
 * per rol) mitjançant el callback `onObrirMenu`.
 *
 * @remarks Multitenancy: no fa cap consulta a la BD ni rep dades
 * de cap tenant.
 */
export function Header({ onObrirMenu }: HeaderProps) {
  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center gap-3
                       bg-white border-b border-gray-200 px-4 py-3">
      <button
        onClick={onObrirMenu}
        className="p-2 -ml-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px]"
        aria-label="Obrir menú"
      >
        <Menu size={22} />
      </button>
      <span className="font-semibold text-gray-900">Gestió Ramadera</span>
    </header>
  )
}
