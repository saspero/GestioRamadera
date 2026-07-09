import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getAnimalsActius, cercarPerCrotal } from '@/lib/db/queries/animals'

/**
 * GET /api/animals
 *
 * Retorna el llistat d'animals actius. Si es passa el paràmetre de
 * consulta `cerca`, filtra per coincidència parcial de crotal_id.
 *
 * @param request - Petició entrant; el middleware ja hi ha afegit les
 * capçaleres x-user-id, x-tenant-schema i x-user-rol a partir del JWT.
 * Paràmetre opcional `?cerca=` a la query string.
 * @returns JSON { animals: AnimalActiu[] }, o 401 si no hi ha context
 * de tenant vàlid
 *
 * @remarks Control d'accés: lectura oberta als 3 rols (Admin,
 * Veterinari, Treballador) — docs/08_modul_llistat_actius.md,
 * secció "Rols amb accés".
 * @remarks Multitenancy: delega a getAnimalsActius/cercarPerCrotal
 * (src/lib/db/queries/animals.ts), que apliquen SET LOCAL search_path
 * al schema del tenant via queryTenant().
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
    const cerca = request.nextUrl.searchParams.get('cerca')?.trim()
    const animals = cerca ? await cercarPerCrotal(ctx, cerca) : await getAnimalsActius(ctx)
    return NextResponse.json({ animals })
  } catch (error) {
    console.error('[GET /api/animals]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
