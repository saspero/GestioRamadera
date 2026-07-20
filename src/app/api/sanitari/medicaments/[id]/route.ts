import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { actualitzarEntradaMedicament } from '@/lib/db/queries/sanitari'
import { actualitzarEntradaMedicamentSchema } from '@/lib/validators/sanitari'

/**
 * PATCH /api/sanitari/medicaments/[id]
 *
 * Actualitza una entrada d'estoc existent (lot, quantitat, unitat, preu).
 *
 * @remarks `medicamentCatalegId` no és editable — no forma part
 * d'aquest schema.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a actualitzarEntradaMedicament,
 * aïllada via queryTenant/search_path.
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
    const parsed = actualitzarEntradaMedicamentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await actualitzarEntradaMedicament(ctx, Number(id), parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/sanitari/medicaments/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
