import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getCatalegsConsum } from '@/lib/db/queries/logistica'

/**
 * GET /api/logistica/catalegs
 *
 * Retorna els orígens (magatzems/sitges ACTIUS) i destins (zones)
 * per al formulari de Consums Massius.
 *
 * @param request - Petició entrant
 * @returns JSON CatalegsConsum, o 401/403
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: delega a getCatalegsConsum
 * (src/lib/db/queries/logistica.ts), aïllada via queryTenant/search_path.
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Treballador') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const catalegs = await getCatalegsConsum(ctx)
    return NextResponse.json(catalegs)
  } catch (error) {
    console.error('[GET /api/logistica/catalegs]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
