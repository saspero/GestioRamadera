import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { actualitzarTipusPinso } from '@/lib/db/queries/logistica'
import { actualitzarTipusPinsoSchema } from '@/lib/validators/logistica'

/**
 * PATCH /api/logistica/tipus-pinso/[id]
 *
 * Actualitza un tipus de pinso existent, substituint completament
 * la seva llista de components.
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: delega a actualitzarTipusPinso, aïllada via
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
    const parsed = actualitzarTipusPinsoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    try {
      await actualitzarTipusPinso(ctx, Number(id), parsed.data)
    } catch (dbError) {
      const esDuplicat =
        dbError instanceof Error && dbError.message.includes('duplicate key')
      if (esDuplicat) {
        return NextResponse.json(
          { error: 'Aquest codi de pinso ja existeix' },
          { status: 409 }
        )
      }
      throw dbError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/logistica/tipus-pinso/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
