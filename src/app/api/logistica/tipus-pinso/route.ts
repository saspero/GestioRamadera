import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getTipusPinsoCataleg, crearTipusPinso } from '@/lib/db/queries/logistica'
import { crearTipusPinsoSchema } from '@/lib/validators/logistica'

/**
 * GET /api/logistica/tipus-pinso
 *
 * Retorna el catàleg complet de tipus de pinso, amb components.
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: delega a getTipusPinsoCataleg, aïllada via
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
    const tipusPinso = await getTipusPinsoCataleg(ctx)
    return NextResponse.json({ tipusPinso })
  } catch (error) {
    console.error('[GET /api/logistica/tipus-pinso]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/logistica/tipus-pinso
 *
 * Crea un tipus de pinso nou amb la seva composició.
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: delega a crearTipusPinso, aïllada via
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
    const parsed = crearTipusPinsoSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    let resultat
    try {
      resultat = await crearTipusPinso(ctx, parsed.data)
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

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_TIPUS_PINSO',
      taulaAfectada: 'tipus_pinso_cataleg',
      registreId: resultat.id,
      dadesJson: { codi: parsed.data.codi, nom: parsed.data.nom },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/logistica/tipus-pinso]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
