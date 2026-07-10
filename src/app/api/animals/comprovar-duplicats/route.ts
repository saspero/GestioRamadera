import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { TenantContext, Rol } from '@/lib/db/client'
import { trobarDibsExistents } from '@/lib/db/queries/animals'

const comprovarSchema = z.object({
  dibs: z.array(z.string().trim().min(1)).min(1).max(1000),
})

/**
 * POST /api/animals/comprovar-duplicats
 *
 * Rep una llista de DIB (extrets del CSV al client) i retorna quins
 * ja existeixen a la base de dades, per marcar-los a la pantalla de
 * previsualització de l'alta massiva.
 *
 * @param request - Body: { dibs: string[] }
 * @returns JSON { existents: string[] }, o 401/403 segons correspongui
 *
 * @remarks Control d'accés: Admin únicament (mateix àmbit que
 * l'alta massiva en si).
 * @remarks Multitenancy: delega a trobarDibsExistents
 * (src/lib/db/queries/animals.ts), aïllada via queryTenant/search_path.
 */
export async function POST(request: NextRequest) {
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
    const parsed = comprovarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dades incorrectes' }, { status: 400 })
    }

    const existents = await trobarDibsExistents(ctx, parsed.data.dibs)
    return NextResponse.json({ existents })
  } catch (error) {
    console.error('[POST /api/animals/comprovar-duplicats]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
