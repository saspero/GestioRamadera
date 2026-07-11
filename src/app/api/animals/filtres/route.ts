import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getFiltresAnimals } from '@/lib/db/queries/animals'

/**
 * GET /api/animals/filtres
 *
 * Retorna els catàlegs necessaris per als desplegables de filtre en
 * cascada (Granja → Zona → Lot) de la pantalla d'Animals.
 *
 * @param request - Petició entrant
 * @returns JSON { ubicacions, zones, lots }, o 401
 *
 * @remarks Control d'accés: lectura oberta als 3 rols.
 * @remarks Multitenancy: delega a getFiltresAnimals
 * (src/lib/db/queries/animals.ts), aïllada via queryTenant/search_path.
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

  try {
    const filtres = await getFiltresAnimals(ctx)
    return NextResponse.json(filtres)
  } catch (error) {
    console.error('[GET /api/animals/filtres]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
