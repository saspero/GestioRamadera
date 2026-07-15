import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getAnimalsInactius } from '@/lib/db/queries/arxiu'

/**
 * GET /api/arxiu
 *
 * Retorna els animals donats de baixa, amb filtres opcionals.
 *
 * @param request - Query params: ?cerca=&motiu=&dataDes=&dataFins=
 * @returns JSON { animals: AnimalInactiu[] }, o 401/403
 *
 * @remarks Control d'accés: Admin i Veterinari (només lectura —
 * aquest mòdul és exclusivament de consulta, docs/07_modul_arxiu_historic.md,
 * secció 1). Treballador sense accés en absolut.
 * @remarks Multitenancy: delega a getAnimalsInactius, aïllada via
 * queryTenant/search_path.
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const params = request.nextUrl.searchParams
    const animals = await getAnimalsInactius(ctx, {
      cerca: params.get('cerca')?.trim() || undefined,
      motiu: params.get('motiu') || undefined,
      dataDes: params.get('dataDes') || undefined,
      dataFins: params.get('dataFins') || undefined,
    })
    return NextResponse.json({ animals })
  } catch (error) {
    console.error('[GET /api/arxiu]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
