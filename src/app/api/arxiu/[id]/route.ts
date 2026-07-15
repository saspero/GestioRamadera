import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getFitxaArxiu } from '@/lib/db/queries/arxiu'

/**
 * GET /api/arxiu/[id]
 *
 * Retorna la fitxa completa d'un animal de l'arxiu.
 *
 * @remarks Control d'accés: Admin i Veterinari (lectura).
 * @remarks Multitenancy: delega a getFitxaArxiu, aïllada via
 * queryTenant/search_path.
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const fitxa = await getFitxaArxiu(ctx, Number(id))
    if (!fitxa) {
      return NextResponse.json({ error: 'Animal no trobat a l\'arxiu' }, { status: 404 })
    }
    return NextResponse.json(fitxa)
  } catch (error) {
    console.error('[GET /api/arxiu/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
