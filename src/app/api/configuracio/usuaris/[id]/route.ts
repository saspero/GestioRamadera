import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { actualitzarUsuari } from '@/lib/db/queries/configuracio'
import { actualitzarUsuariSchema } from '@/lib/validators/configuracio'

/**
 * PATCH /api/configuracio/usuaris/[id]
 *
 * Actualitza el nom, rol i estat actiu d'un usuari.
 *
 * @remarks Protecció contra autobloqueig: un Admin no es pot
 * desactivar ni degradar-se a si mateix (rol != 'Admin' o
 * actiu = false sobre el seu propi id) — evitaria que el tenant es
 * quedés sense cap Admin operatiu. No hi ha cap altra validació
 * (per exemple, "no deixar el tenant sense cap Admin actiu entre
 * tots els usuaris") en aquesta primera versió.
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: delega a actualitzarUsuari, aïllada per
 * tenant_id explícit.
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
    const parsed = actualitzarUsuariSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const esUnMateix = Number(id) === ctx.userId
    if (esUnMateix && (parsed.data.rol !== 'Admin' || !parsed.data.actiu)) {
      return NextResponse.json(
        { error: 'No et pots desactivar ni treure\'t el rol d\'Admin a tu mateix' },
        { status: 400 }
      )
    }

    await actualitzarUsuari(tenantId, Number(id), parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/configuracio/usuaris/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
