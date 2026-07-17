import type { Rol } from '@/types/db'
import {
  LayoutDashboard,
  Layers,
  Stethoscope,
  Truck,
  Archive,
  Settings,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { cowHead } from '@lucide/lab'
import type { IconNode } from 'lucide-react'

/**
 * Element individual del menú de navegació del Sidebar.
 */
export type MenuItem = {
  /** Etiqueta visible a la interfície (en català) */
  label: string
  /** Ruta de destí (App Router de Next.js) */
  href: string
  /**
   * Icona associada a la secció. Pot ser un component estàndard de
   * lucide-react (LucideIcon) o un IconNode del paquet @lucide/lab
   * (icones experimentals com cowHead, que encara no tenen component
   * dedicat). El Sidebar distingeix quin tipus és per renderitzar-lo
   * correctament (veure src/components/layout/Sidebar.tsx).
   */
  icon: LucideIcon | IconNode
  /**
   * Rols que tenen accés a aquesta secció.
   * Ha de coincidir EXACTAMENT amb la matriu de permisos
   * documentada a docs/04_seguretat_i_rols.md, secció 2.2.
   */
  rolsPermesos: Rol[]
}

/**
 * Menú complet de navegació de l'aplicació.
 *
 * Font de veritat única per a la visibilitat de seccions per rol.
 * Qualsevol canvi de permisos s'ha de reflectir també a:
 *   - docs/04_seguretat_i_rols.md (matriu de permisos)
 *   - Les comprovacions de rol a les API Routes corresponents
 *
 * @remarks Control d'accés: aquest array es filtra a getMenuForRol()
 * segons el rol de l'usuari autenticat. No conté cap dada sensible,
 * és segur incloure'l en un component client.
 * @remarks "Granja/Corts" i "Lots" van ser una única secció "Lots i
 * Corts" fins a la versió 1.3.0 (docs/13_modul_granja_corts.md,
 * secció 0 — separades perquè són conceptualment diferents:
 * infraestructura física vs. agrupació d'animals). Visibles pels 3
 * rols (Treballador només amb permisos de lectura — la comprovació
 * de qui pot crear/editar es fa a cada endpoint, no aquí).
 */
export const MENU_ITEMS: MenuItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    rolsPermesos: ['Admin', 'Veterinari', 'Treballador'],
  },
  {
    label: 'Animals',
    href: '/animals',
    icon: cowHead,
    rolsPermesos: ['Admin', 'Veterinari', 'Treballador'],
  },
  {
    label: 'Granja / Corts',
    href: '/granja-corts',
    icon: Warehouse,
    rolsPermesos: ['Admin', 'Veterinari', 'Treballador'],
  },
  {
    label: 'Lots',
    href: '/lots',
    icon: Layers,
    rolsPermesos: ['Admin', 'Veterinari', 'Treballador'],
  },
  {
    label: 'Sanitari',
    href: '/sanitari',
    icon: Stethoscope,
    rolsPermesos: ['Admin', 'Veterinari'],
  },
  {
    label: 'Magatzems',
    href: '/logistica',
    icon: Truck,
    rolsPermesos: ['Admin', 'Treballador'],
  },
  {
    label: 'Arxiu',
    href: '/arxiu',
    icon: Archive,
    rolsPermesos: ['Admin', 'Veterinari'],
  },
  {
    label: 'Configuració',
    href: '/configuracio/usuaris',
    icon: Settings,
    rolsPermesos: ['Admin'],
  },
]

/**
 * Filtra el menú complet segons el rol de l'usuari autenticat.
 *
 * @param rol - Rol de l'usuari actual (Admin, Veterinari o Treballador)
 * @returns Array de MenuItem visibles per a aquest rol, mantenint l'ordre original
 *
 * @remarks Control d'accés: aquest filtre és NOMÉS visual/UX (amaga
 * enllaços que l'usuari no hauria de veure). NO substitueix la
 * comprovació de permisos real, que es fa sempre al middleware i a
 * cada API Route (veure src/lib/auth/roles.ts). Un usuari mal
 * intencionat que navegui directament a una URL no permesa serà
 * igualment bloquejat pel backend.
 */
export function getMenuForRol(rol: Rol): MenuItem[] {
  return MENU_ITEMS.filter((item) => item.rolsPermesos.includes(rol))
}
