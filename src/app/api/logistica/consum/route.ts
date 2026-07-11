import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { registrarConsum } from '@/lib/db/queries/logistica'
import { registrarConsumSchema } from '@/lib/validators/logistica'

/**
 * POST /api/logistica/consum
 *
 * Registra un consum massiu, escrivint a la taula corresponent
 * segons el tipus d'origen (consums_pinso_nau per a sitges,
 * moviments_farratge per a magatzems de farratge).
 *
 * @param request - Body: RegistrarConsumInput
 * @returns JSON { estocResultant: number, alertaGenerada: boolean }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Validació addicional: si l'origen és una sitja, `unitat`
 * ha de ser 'kg' — les sitges no admeten Tones ni Unitats (bales),
 * a diferència dels magatzems de farratge.
 * @remarks Multitenancy: delega a registrarConsum
 * (src/lib/db/queries/logistica.ts), aïllada via queryTenant/search_path.
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
    const parsed = registrarConsumSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (parsed.data.origenTipus === 'sitja' && parsed.data.unitat !== 'kg') {
      return NextResponse.json(
        { error: 'Les sitges només admeten consums en kg' },
        { status: 400 }
      )
    }

    let resultat
    try {
      resultat = await registrarConsum(ctx, parsed.data)
    } catch (dbError) {
      const missatge =
        dbError instanceof Error ? dbError.message : 'Error en registrar el consum'
      return NextResponse.json({ error: missatge }, { status: 400 })
    }

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'REGISTRAR_CONSUM',
      taulaAfectada: parsed.data.origenTipus === 'sitja' ? 'consums_pinso_nau' : 'moviments_farratge',
      dadesJson: parsed.data,
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat)
  } catch (error) {
    console.error('[POST /api/logistica/consum]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
