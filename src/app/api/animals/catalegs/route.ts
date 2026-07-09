import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getRacesCataleg, getLots, getCorts } from '@/lib/db/queries/animals'

/**
 * GET /api/animals/catalegs
 *
 * Retorna els tres catàlegs necessaris per als desplegables d'assignació
 * base de l'alta massiva i individual: races, lots existents i corts.
 *
 * @param request - Petició entrant; el middleware ja hi ha afegit les
 * capçaleres x-user-id, x-tenant-schema i x-user-rol a partir del JWT
 * @returns JSON { races, lots, corts }, o 401/403 segons correspongui
 *
 * @remarks Control d'accés: Admin únicament (docs/08_modul_llistat_actius.md,
 * secció "Rols amb accés" — les altes són exclusives d'Admin).
 * @remarks Multitenancy: delega a getRacesCataleg/getLots/getCorts
 * (src/lib/db/queries/animals.ts), aïllades via queryTenant/search_path.
 */
export async function GET(request: NextRequest) {
  const ctx: TenantContext = {
    userId: Number(request.headers.get('x-user-id')),
    tenantSchema: request.headers.get('x-tenant-schema') ?? '',
    rol: request.headers.get('x-user-rol') as Rol,
  }

  if (!ctx.tenantSchema) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  if (ctx.rol !== 'Admin') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const [races, lots, corts] = await Promise.all([
      getRacesCataleg(ctx),
      getLots(ctx),
      getCorts(ctx),
    ])
    return NextResponse.json({ races, lots, corts })
  } catch (error) {
    console.error('[GET /api/animals/catalegs]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
