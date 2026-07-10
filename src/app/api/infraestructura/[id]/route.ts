import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { actualitzarUbicacio } from '@/lib/db/queries/infraestructura'
import { actualitzarUbicacioSchema } from '@/lib/validators/infraestructura'

/**
 * PATCH /api/infraestructura/[id]
 *
 * Actualitza el nom o codi de pastura extensiu d'una ubicació existent.
 *
 * @param request - Body: { nom, codiPasturaExtensiu? }
 * @param context - Paràmetres de ruta amb l'id de la ubicació
 * @returns JSON { ok: true }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a actualitzarUbicacio
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
    const parsed = actualitzarUbicacioSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await actualitzarUbicacio(ctx, Number(id), {
      nom: parsed.data.nom,
      codiPasturaExtensiu: parsed.data.codiPasturaExtensiu || undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/infraestructura/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
