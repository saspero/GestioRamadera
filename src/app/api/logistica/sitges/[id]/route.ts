import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { actualitzarSitja } from '@/lib/db/queries/logistica'
import { actualitzarSitjaSchema } from '@/lib/validators/logistica'

/**
 * PATCH /api/logistica/sitges/[id]
 *
 * Actualitza una sitja existent (la ubicació no es pot canviar).
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: delega a actualitzarSitja, aïllada via
 * queryTenant/search_path.
 */
export async function PATCH(
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Treballador') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const parsed = actualitzarSitjaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    try {
      await actualitzarSitja(ctx, Number(id), parsed.data)
    } catch (dbError) {
      const esZonaVinculadaInvalida =
        dbError instanceof Error && dbError.message.includes('zona vinculada ha de ser una nau')
      if (esZonaVinculadaInvalida) {
        return NextResponse.json(
          { error: 'La zona vinculada ha de ser una nau d\'animals o una pastura' },
          { status: 422 }
        )
      }
      throw dbError
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/logistica/sitges/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
