import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getAnimalsDelLot } from '@/lib/db/queries/lots'

/**
 * GET /api/lots/[id]/animals
 *
 * Retorna els animals actius d'un lot concret, per al detall
 * expandible de la pantalla de Lots.
 *
 * @param request - Petició entrant
 * @param context - Paràmetres de ruta amb l'id del lot
 * @returns JSON { animals: AnimalDelLot[] }, o 401
 *
 * @remarks Control d'accés: lectura oberta als 3 rols.
 * @remarks Multitenancy: delega a getAnimalsDelLot
 * (src/lib/db/queries/lots.ts), aïllada via queryTenant/search_path.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx: TenantContext = {
    userId: Number(request.headers.get('x-user-id')),
    tenantSchema: request.headers.get('x-tenant-schema') ?? '',
    rol: request.headers.get('x-user-rol') as Rol,
  }

  if (!ctx.tenantSchema) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const animals = await getAnimalsDelLot(ctx, Number(id))
    return NextResponse.json({ animals })
  } catch (error) {
    console.error('[GET /api/lots/[id]/animals]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
