'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, X, Icon, type IconNode } from 'lucide-react'
import { getMenuForRol } from '@/lib/navigation/menuItems'
import type { Rol } from '@/types/db'

/**
 * Propietats del component Sidebar.
 */
type SidebarProps = {
  /** Rol de l'usuari autenticat, determina quines seccions es mostren */
  rol: Rol
  /** Nom complet de l'usuari, mostrat al peu del Sidebar */
  nom: string
  /** Indica si el Sidebar està obert en vista mòbil (overlay) */
  obertMobil: boolean
  /** Callback per tancar el Sidebar en vista mòbil (p.ex. en clicar l'overlay) */
  onTancarMobil: () => void
}

/**
 * Sidebar de navegació principal de l'aplicació.
 *
 * Comportament responsive:
 * - Escriptori (md i superior): fix, sempre visible, empeny el contingut.
 * - Mòbil/tauleta (< md): amagat per defecte, es mostra com a overlay
 *   complet sobre el contingut quan `obertMobil` és true.
 *
 * @param props - Propietats del component
 * @param props.rol - Rol de l'usuari autenticat (Admin, Veterinari o Treballador)
 * @param props.nom - Nom complet de l'usuari, mostrat al peu del Sidebar
 * @param props.obertMobil - Indica si el Sidebar està obert en vista mòbil (overlay)
 * @param props.onTancarMobil - Callback invocat per tancar el Sidebar en mòbil
 * @returns Element de navegació lateral, responsive, filtrat per rol
 *
 * @remarks Control d'accés per rol (UX, no de seguretat): els elements de
 * navegació es filtren cridant getMenuForRol(rol), que reflecteix la
 * matriu de permisos de docs/04_seguretat_i_rols.md. La protecció
 * real de cada ruta la fa el middleware i les API Routes — aquest
 * component només evita mostrar enllaços que l'usuari no hauria de veure.
 * Un Treballador, per exemple, mai veurà "Sanitari" ni "Configuració"
 * al menú, tot i que la restricció real ve del backend.
 *
 * @remarks Multitenancy: aquest component no fa cap consulta a la BD ni
 * rep dades de cap tenant concret. `rol` i `nom` ja arriben resolts des
 * del Server Component pare (src/app/(app)/layout.tsx), que els obté
 * del JWT i de public.users respectivament.
 */
export function Sidebar({ rol, nom, obertMobil, onTancarMobil }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const menuItems = getMenuForRol(rol)

  /**
   * Tanca la sessió cridant l'endpoint de logout i redirigeix al login.
   *
   * @returns Promise que es resol un cop completada la redirecció
   *
   * @remarks Control d'accés: disponible per a qualsevol rol autenticat
   * (Admin, Veterinari, Treballador) — tancar sessió no requereix cap
   * permís especial. Crida POST /api/auth/logout, que esborra les
   * cookies HttpOnly access_token i refresh_token al servidor.
   */
  async function handleLogout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Overlay fosc darrere del Sidebar en mòbil, tanca en clicar fora */}
      {obertMobil && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onTancarMobil}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:translate-x-0 md:static md:z-auto
          ${obertMobil ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Capçalera amb nom de l'app i botó de tancar (només mòbil) */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <span className="text-lg font-bold">Gestió Ramadera</span>
          <button
            onClick={onTancarMobil}
            className="md:hidden p-2 -mr-2 rounded-lg hover:bg-gray-800"
            aria-label="Tancar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navegació principal, filtrada per rol */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {menuItems.map((item) => {
            const actiu = pathname.startsWith(item.href)
            // item.icon pot ser un component LucideIcon (funció) o un
            // IconNode d'@lucide/lab (array de dades SVG). Cada tipus
            // es renderitza amb un mètode diferent.
            const esIconNode = Array.isArray(item.icon)
            const IconComponent = esIconNode ? null : item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onTancarMobil}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors min-h-[44px]
                  ${
                    actiu
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                {esIconNode ? (
                  <Icon iconNode={item.icon as IconNode} size={20} aria-hidden="true" />
                ) : (
                  IconComponent && <IconComponent size={20} aria-hidden="true" />
                )}
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Peu: nom + rol de l'usuari i botó de tancar sessió */}
        <div className="border-t border-gray-800 px-4 py-4">
          <p className="text-sm font-medium text-white truncate">{nom}</p>
          <p className="text-xs text-gray-400 mb-3">{rol}</p>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                       text-gray-300 hover:bg-gray-800 hover:text-white transition-colors
                       min-h-[44px]"
          >
            <LogOut size={18} aria-hidden="true" />
            Tancar sessió
          </button>
        </div>
      </aside>
    </>
  )
}
