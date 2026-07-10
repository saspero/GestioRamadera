import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { actualitzarZona } from '@/lib/db/queries/infraestructura'
import { actualitzarZonaSchema } from '@/lib/validators/infraestructura'

/**
 * PATCH /api/infraestructura/zones/[id]
 *
 * Actualitza el nom d'una zona existent. El tipus de zona no es pot
 * canviar un cop creada (veure docs a src/lib/db/queries/infraestructura.ts).
 *
 * @param request - Body: { nom }
 * @param context - Paràmetres de ruta amb l'id de la zona
 * @returns JSON { ok: true }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a actualitzarZona
 * (src/lib/db/queries/infraestructura.ts), aïllada via queryTenant/search_path.
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
    const parsed = actualitzarZonaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await actualitzarZona(ctx, Number(id), parsed.data.nom)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/infraestructura/zones/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
