import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getRacesConfigurables, crearRacaCustom } from '@/lib/db/queries/configuracio'
import { crearRacaSchema } from '@/lib/validators/configuracio'

/**
 * GET /api/configuracio/races
 *
 * Retorna el catàleg complet de races (globals + pròpies del tenant).
 *
 * @remarks Control d'accés: Admin únicament (pantalla de gestió).
 * @remarks Multitenancy: delega a getRacesConfigurables, aïllada via
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
  if (ctx.rol !== 'Admin') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const races = await getRacesConfigurables(ctx)
    return NextResponse.json({ races })
  } catch (error) {
    console.error('[GET /api/configuracio/races]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/configuracio/races
 *
 * Crea una raça personalitzada per al tenant.
 *
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: delega a crearRacaCustom, aïllada via
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
  if (ctx.rol !== 'Admin') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = crearRacaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    let resultat
    try {
      resultat = await crearRacaCustom(ctx, parsed.data.nomRaca)
    } catch (dbError) {
      const esDuplicat =
        dbError instanceof Error && dbError.message.includes('duplicate key')
      if (esDuplicat) {
        return NextResponse.json({ error: 'Aquesta raça ja existeix al catàleg' }, { status: 409 })
      }
      throw dbError
    }

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_RACA',
      taulaAfectada: 'races_cataleg',
      registreId: resultat.id,
      dadesJson: { nomRaca: parsed.data.nomRaca },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/configuracio/races]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
