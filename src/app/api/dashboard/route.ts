import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import type { DashboardResponse } from '@/types/dashboard'
import {
  getTotalAnimals,
  getLotsActius,
  getEstocMagatzems,
  getAlertesEstoc,
  getAnimalsEnSupressio,
  getUltimesBaixes,
  getDistribucioSalut,
} from '@/lib/db/queries/dashboard'

/**
 * GET /api/dashboard
 *
 * Retorna totes les dades del Dashboard consolidades en una única
 * resposta, filtrant els blocs segons el rol de l'usuari autenticat.
 *
 * @param request - Petició entrant; el middleware ja hi ha afegit les
 * capçaleres x-user-id, x-tenant-schema i x-user-rol a partir del JWT
 * @returns JSON amb DashboardResponse (blocs opcionals segons rol),
 * o 401 si no hi ha context de tenant vàlid
 *
 * @remarks Control d'accés per rol i bloc (docs/04_seguretat_i_rols.md):
 *   - totalAnimals, lotsActius       → Admin, Veterinari, Treballador
 *   - estocMagatzems, alertesEstoc   → Admin, Treballador
 *   - animalsEnSupressio             → Admin, Veterinari
 *   - ultimesBaixes                  → Admin, Veterinari
 *   - distribucioSalut               → Admin, Veterinari
 * Cada bloc es consulta NOMÉS si el rol hi té accés — mai es calcula
 * ni es retorna un bloc que el rol no hauria de veure, per evitar
 * fuites de dades encara que el frontend no les arribés a mostrar.
 *
 * @remarks Multitenancy: totes les queries s'executen amb queryTenant(),
 * que aplica SET LOCAL search_path al schema del tenant de la sessió
 * (ctx.tenantSchema). Cap dada d'un altre tenant és accessible.
 */
export async function GET(request: NextRequest) {
  const ctx: TenantContext = {
    userId: Number(request.headers.get('x-user-id')),
    tenantSchema: request.headers.get('x-tenant-schema') ?? '',
    rol: request.headers.get('x-user-rol') as Rol,
  }

  if (!ctx.tenantSchema || !ctx.rol) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  try {
    // Blocs comuns als 3 rols
    const [totalAnimals, lotsActius] = await Promise.all([
      getTotalAnimals(ctx),
      getLotsActius(ctx),
    ])

    const response: DashboardResponse = { totalAnimals, lotsActius }

    // Blocs d'Admin i Treballador: logística d'estoc
    if (ctx.rol === 'Admin' || ctx.rol === 'Treballador') {
      const [estocMagatzems, alertesEstoc] = await Promise.all([
        getEstocMagatzems(ctx),
        getAlertesEstoc(ctx),
      ])
      response.estocMagatzems = estocMagatzems
      response.alertesEstoc = alertesEstoc
    }

    // Blocs d'Admin i Veterinari: dades clíniques/sanitàries i baixes
    if (ctx.rol === 'Admin' || ctx.rol === 'Veterinari') {
      const [animalsEnSupressio, ultimesBaixes, distribucioSalut] = await Promise.all([
        getAnimalsEnSupressio(ctx),
        getUltimesBaixes(ctx),
        getDistribucioSalut(ctx),
      ])
      response.animalsEnSupressio = animalsEnSupressio
      response.ultimesBaixes = ultimesBaixes
      response.distribucioSalut = distribucioSalut
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[GET /api/dashboard]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
