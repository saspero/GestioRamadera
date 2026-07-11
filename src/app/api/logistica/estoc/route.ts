import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getEstocComplet } from '@/lib/db/queries/logistica'

/**
 * GET /api/logistica/estoc
 *
 * Retorna l'estoc de tots els magatzems i sitges (actius i
 * deshabilitats), per a la pantalla de Control d'Estoc.
 *
 * @param request - Petició entrant
 * @returns JSON { estoc: EstocMagatzemComplet[] }, o 401/403
 *
 * @remarks Control d'accés: Admin i Treballador. Veterinari sense
 * accés (docs/09_modul_logistica_farratges.md, secció 1).
 * @remarks Multitenancy: delega a getEstocComplet
 * (src/lib/db/queries/logistica.ts), aïllada via queryTenant/search_path.
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Treballador') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const estoc = await getEstocComplet(ctx)
    return NextResponse.json({ estoc })
  } catch (error) {
    console.error('[GET /api/logistica/estoc]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
