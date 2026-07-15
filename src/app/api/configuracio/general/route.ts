import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getConfiguracioGeneral, actualitzarConfiguracioGeneral } from '@/lib/db/queries/configuracio'
import { actualitzarConfiguracioGeneralSchema } from '@/lib/validators/configuracio'

/**
 * GET /api/configuracio/general
 *
 * Retorna els llindars d'estoc per defecte del tenant.
 *
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: delega a getConfiguracioGeneral, aïllada
 * via queryTenant/search_path.
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
  if (ctx.rol !== 'Admin') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const configuracio = await getConfiguracioGeneral(ctx)
    return NextResponse.json(configuracio)
  } catch (error) {
    console.error('[GET /api/configuracio/general]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * PATCH /api/configuracio/general
 *
 * Actualitza els llindars d'estoc per defecte del tenant.
 *
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: delega a actualitzarConfiguracioGeneral,
 * aïllada via queryTenant/search_path.
 */
export async function PATCH(request: NextRequest) {
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
    const body = await request.json()
    const parsed = actualitzarConfiguracioGeneralSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await actualitzarConfiguracioGeneral(ctx, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/configuracio/general]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
