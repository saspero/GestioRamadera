import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { crearZona } from '@/lib/db/queries/infraestructura'
import { crearZonaSchema } from '@/lib/validators/infraestructura'

/**
 * POST /api/infraestructura/zones
 *
 * Crea una nova zona (nau, cobert d'emmagatzematge o pastura)
 * dins d'una ubicació existent.
 *
 * @param request - Body: { ubicacioId, nom, tipusZona }
 * @returns JSON { id: number }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a crearZona
 * (src/lib/db/queries/infraestructura.ts), aïllada via queryTenant/search_path.
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
    const parsed = crearZonaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const resultat = await crearZona(ctx, parsed.data)

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_ZONA',
      taulaAfectada: 'zones_infraestructura',
      registreId: resultat.id,
      dadesJson: parsed.data,
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/infraestructura/zones]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
