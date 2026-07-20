import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { actualitzarTractament, eliminarTractament } from '@/lib/db/queries/sanitari'
import { actualitzarTractamentSchema, eliminarTractamentSchema } from '@/lib/validators/sanitari'

/**
 * PATCH /api/sanitari/tractaments/[id]
 *
 * Edita un tractament ja aplicat (dosi, data de fi prevista, notes).
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a actualitzarTractament, aïllada via
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const parsed = actualitzarTractamentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await actualitzarTractament(ctx, Number(id), {
      ...parsed.data,
      dataFiPrevista: parsed.data.dataFiPrevista || undefined,
      notes: parsed.data.notes || undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/sanitari/tractaments/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/sanitari/tractaments/[id]
 *
 * Elimina un tractament (DELETE real — decisió confirmada amb
 * l'usuari), després de registrar-ne una còpia al log
 * d'eliminacions amb el motiu.
 *
 * @remarks IMPORTANT: si l'animal encara estava en període de
 * supressió per aquest tractament, el bloqueig comercial s'aixeca a
 * l'instant en eliminar-lo — documentat i confirmat explícitament.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a eliminarTractament, aïllada via
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
  const tenantId = Number(request.headers.get('x-tenant-id'))

  if (!ctx.tenantSchema) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const parsed = eliminarTractamentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const eliminat = await eliminarTractament(ctx, Number(id), {
      motiu: parsed.data.motiu,
      motiuAltres: parsed.data.motiuAltres || undefined,
    })

    if (!eliminat) {
      return NextResponse.json({ error: 'Tractament no trobat' }, { status: 404 })
    }

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'ELIMINAR_TRACTAMENT',
      taulaAfectada: 'tractaments',
      registreId: Number(id),
      dadesJson: { motiu: parsed.data.motiu, motiuAltres: parsed.data.motiuAltres },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/sanitari/tractaments/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
