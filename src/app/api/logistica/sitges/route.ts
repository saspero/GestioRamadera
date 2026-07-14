import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getSitges, crearSitja } from '@/lib/db/queries/logistica'
import { crearSitjaSchema } from '@/lib/validators/logistica'

/**
 * GET /api/logistica/sitges
 *
 * Retorna totes les sitges del tenant.
 *
 * @remarks Control d'accés: Admin i Treballador (Veterinari sense
 * accés al mòdul Logística).
 * @remarks Multitenancy: delega a getSitges, aïllada via
 * queryTenant/search_path.
 */
export async function GET(request: NextRequest) {
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
    const sitges = await getSitges(ctx)
    return NextResponse.json({ sitges })
  } catch (error) {
    console.error('[GET /api/logistica/sitges]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/logistica/sitges
 *
 * Crea una sitja nova.
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: delega a crearSitja, aïllada via
 * queryTenant/search_path.
 */
export async function POST(request: NextRequest) {
  const ctx: TenantContext = {
    userId: Number(request.headers.get('x-user-id')),
    tenantSchema: request.headers.get('x-tenant-schema') ?? '',
    rol: request.headers.get('x-user-rol') as Rol,
  }
  const tenantId = Number(request.headers.get('x-tenant-id'))

  if (!ctx.tenantSchema) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Treballador') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = crearSitjaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const resultat = await crearSitja(ctx, parsed.data)

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_SITJA',
      taulaAfectada: 'sitges',
      registreId: resultat.id,
      dadesJson: parsed.data,
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/logistica/sitges]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
