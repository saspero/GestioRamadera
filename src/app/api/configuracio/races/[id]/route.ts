import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { eliminarRacaCustom } from '@/lib/db/queries/configuracio'

/**
 * DELETE /api/configuracio/races/[id]
 *
 * Elimina una raça personalitzada del catàleg. Les races globals
 * (es_global=TRUE) queden protegides a nivell de query — aquesta
 * crida no elimina res si l'id correspon a una raça global.
 *
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: delega a eliminarRacaCustom, aïllada via
 * queryTenant/search_path.
 */
export async function DELETE(
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
  if (ctx.rol !== 'Admin') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    await eliminarRacaCustom(ctx, Number(id))
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/configuracio/races/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
