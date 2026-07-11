import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { TenantContext, Rol } from '@/lib/db/client'
import { trobarMedicamentsExistents } from '@/lib/db/queries/sanitari'

const comprovarSchema = z.object({
  combinacions: z
    .array(z.object({ nomMedicament: z.string().min(1), lot: z.string().min(1) }))
    .min(1)
    .max(1000),
})

/**
 * POST /api/sanitari/medicaments/comprovar-duplicats
 *
 * Rep una llista de combinacions nom_medicament+lot (extretes del CSV
 * al client) i retorna quines ja existeixen a la BD, per marcar-les
 * a la pantalla de previsualització de la importació.
 *
 * @param request - Body: { combinacions: { nomMedicament, lot }[] }
 * @returns JSON { existents: boolean[] } (mateix ordre que combinacions), o 401/403
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a trobarMedicamentsExistents
 * (src/lib/db/queries/sanitari.ts), aïllada via queryTenant/search_path.
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = comprovarSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Dades incorrectes' }, { status: 400 })
    }

    const ids = await trobarMedicamentsExistents(ctx, parsed.data.combinacions)
    return NextResponse.json({ existents: ids.map((id) => id !== null) })
  } catch (error) {
    console.error('[POST /api/sanitari/medicaments/comprovar-duplicats]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
