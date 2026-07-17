import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getMagatzems, crearMagatzem } from '@/lib/db/queries/logistica'
import { crearMagatzemSchema } from '@/lib/validators/logistica'

/**
 * GET /api/logistica/magatzems
 *
 * Retorna tots els magatzems de farratge del tenant.
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: delega a getMagatzems, aïllada via
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
    const magatzems = await getMagatzems(ctx)
    return NextResponse.json({ magatzems })
  } catch (error) {
    console.error('[GET /api/logistica/magatzems]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/logistica/magatzems
 *
 * Crea un magatzem de farratge nou, dins d'una zona COBERT_EMMAGATZEMATGE.
 *
 * @remarks La BD rebutja la inserció (trigger existent) si la zona
 * no és del tipus correcte — interceptat aquí i traduït a 422.
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: delega a crearMagatzem, aïllada via
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
    const parsed = crearMagatzemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    let resultat
    try {
      resultat = await crearMagatzem(ctx, parsed.data)
    } catch (dbError) {
      const esErrorDeZona =
        dbError instanceof Error && dbError.message.includes('COBERT_EMMAGATZEMATGE')
      if (esErrorDeZona) {
        return NextResponse.json(
          { error: 'La zona seleccionada no és un cobert d\'emmagatzematge' },
          { status: 422 }
        )
      }
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

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_MAGATZEM',
      taulaAfectada: 'magatzems_farratge',
      registreId: resultat.id,
      dadesJson: parsed.data,
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/logistica/magatzems]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
