import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { registrarEntradaEstoc } from '@/lib/db/queries/logistica'
import { registrarEntradaEstocSchema } from '@/lib/validators/logistica'

/**
 * POST /api/logistica/entrada-estoc
 *
 * Registra una entrada d'estoc repartida manualment entre diversos
 * silos o magatzems del mateix tipus (Ex: un camió de 16 tones
 * dividit entre 3 sitges).
 *
 * @remarks Control d'accés: Admin i Treballador.
 * @remarks Multitenancy: delega a registrarEntradaEstoc, aïllada via
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Treballador') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = registrarEntradaEstocSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const resultat = await registrarEntradaEstoc(ctx, parsed.data)

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'REGISTRAR_ENTRADA_ESTOC',
      taulaAfectada: parsed.data.tipus === 'sitja' ? 'sitges' : 'magatzems_farratge',
      dadesJson: parsed.data,
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat)
  } catch (error) {
    console.error('[POST /api/logistica/entrada-estoc]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
