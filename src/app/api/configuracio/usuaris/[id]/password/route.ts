import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { canviarContrasenyaUsuari } from '@/lib/db/queries/configuracio'
import { canviarContrasenyaSchema } from '@/lib/validators/configuracio'

/**
 * PATCH /api/configuracio/usuaris/[id]/password
 *
 * Canvia la contrasenya d'un usuari del tenant.
 *
 * @remarks Endpoint separat de l'edició general (nom/rol/actiu) per
 * mantenir aquesta acció sensible aïllada i fàcil d'auditar.
 * @remarks No es registra la contrasenya nova ni la seva mida a
 * l'audit_log — només que l'acció ha tingut lloc.
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: delega a canviarContrasenyaUsuari, aïllada
 * per tenant_id explícit.
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
  const tenantId = Number(request.headers.get('x-tenant-id'))

  if (!ctx.tenantSchema) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }
  if (ctx.rol !== 'Admin') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const parsed = canviarContrasenyaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await canviarContrasenyaUsuari(tenantId, Number(id), parsed.data.password)

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CANVIAR_CONTRASENYA_USUARI',
      taulaAfectada: 'public.users',
      registreId: Number(id),
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/configuracio/usuaris/[id]/password]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
