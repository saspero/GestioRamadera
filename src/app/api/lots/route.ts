import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getLotsAmbRecompte, crearLot } from '@/lib/db/queries/lots'
import { crearLotSchema } from '@/lib/validators/lots'

/**
 * GET /api/lots
 *
 * Retorna tots els lots amb el recompte d'animals actius que contenen.
 *
 * @param request - Petició entrant; el middleware ja hi ha afegit les
 * capçaleres x-user-id, x-tenant-schema i x-user-rol a partir del JWT
 * @returns JSON { lots: LotResum[] }, o 401
 *
 * @remarks Control d'accés: lectura oberta als 3 rols (docs/14_modul_lots.md).
 * @remarks Multitenancy: delega a getLotsAmbRecompte
 * (src/lib/db/queries/lots.ts), aïllada via queryTenant/search_path.
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

  try {
    const lots = await getLotsAmbRecompte(ctx)
    return NextResponse.json({ lots })
  } catch (error) {
    console.error('[GET /api/lots]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/lots
 *
 * Crea un nou lot.
 *
 * @param request - Body: { nomLot }
 * @returns JSON { id: number }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a crearLot
 * (src/lib/db/queries/lots.ts), aïllada via queryTenant/search_path.
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = crearLotSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const resultat = await crearLot(ctx, parsed.data.nomLot)

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_LOT',
      taulaAfectada: 'lots',
      registreId: resultat.id,
      dadesJson: { nomLot: parsed.data.nomLot },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/lots]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
