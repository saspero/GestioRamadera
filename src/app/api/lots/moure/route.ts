import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { moureAnimalsDeLot } from '@/lib/db/queries/lots'
import { moureAnimalsSchema } from '@/lib/validators/lots'

/**
 * POST /api/lots/moure
 *
 * Mou un o més animals a un altre lot, opcionalment canviant també
 * la cort de destí. Endpoint compartit: cridat tant des de la
 * pantalla de Lots (moure animals des del detall d'un lot) com des
 * de la pantalla d'Animals (selecció múltiple a la taula).
 *
 * @param request - Body: { animalIds, lotDestiId, cortDestiId? }
 * @returns JSON { nombreMoguts: number }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari (docs/14_modul_lots.md
 * i docs/08_modul_llistat_actius.md, secció 3).
 * @remarks Multitenancy: delega a moureAnimalsDeLot
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
    const parsed = moureAnimalsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const resultat = await moureAnimalsDeLot(ctx, parsed.data)

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'MOURE_ANIMALS_LOT',
      taulaAfectada: 'distribucio_animals',
      dadesJson: parsed.data,
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat)
  } catch (error) {
    console.error('[POST /api/lots/moure]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
