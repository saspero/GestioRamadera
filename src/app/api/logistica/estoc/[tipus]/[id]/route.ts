import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { canviarEstatMagatzem } from '@/lib/db/queries/logistica'
import { canviarEstatMagatzemSchema } from '@/lib/validators/logistica'

/**
 * PATCH /api/logistica/estoc/[tipus]/[id]
 *
 * Canvia l'estat (Actiu/Deshabilitat) d'una sitja o magatzem de
 * farratge. `tipus` a la URL ha de ser 'sitja' o 'magatzem'.
 *
 * @param request - Body: { tipus, estat } (tipus es revalida contra
 * el paràmetre de ruta per coherència)
 * @param context - Paràmetres de ruta: tipus i id
 * @returns JSON { ok: true }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin únicament
 * (docs/09_modul_logistica_farratges.md, secció 4.2).
 * @remarks Multitenancy: delega a canviarEstatMagatzem
 * (src/lib/db/queries/logistica.ts), aïllada via queryTenant/search_path.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tipus: string; id: string }> }
) {
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
    const { tipus, id } = await context.params
    const body = await request.json()
    const parsed = canviarEstatMagatzemSchema.safeParse({ ...body, tipus })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await canviarEstatMagatzem(ctx, parsed.data.tipus, Number(id), parsed.data.estat)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/logistica/estoc/[tipus]/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
