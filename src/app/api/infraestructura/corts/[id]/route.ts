import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { actualitzarCort } from '@/lib/db/queries/infraestructura'
import { actualitzarCortSchema } from '@/lib/validators/infraestructura'

/**
 * PATCH /api/infraestructura/corts/[id]
 *
 * Actualitza el codi o la capacitat màxima d'una cort existent.
 *
 * @param request - Body: { codiCort, capacitatMaxima? }
 * @param context - Paràmetres de ruta amb l'id de la cort
 * @returns JSON { ok: true }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a actualitzarCort
 * (src/lib/db/queries/infraestructura.ts), aïllada via queryTenant/search_path.
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const parsed = actualitzarCortSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await actualitzarCort(ctx, Number(id), parsed.data)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/infraestructura/corts/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
