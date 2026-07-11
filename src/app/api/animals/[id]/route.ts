import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { getFitxaAnimal } from '@/lib/db/queries/animals'

/**
 * GET /api/animals/[id]
 *
 * Retorna la fitxa completa d'un animal: dades bàsiques, ubicació
 * actual, historial de pesos i historial de tractaments.
 *
 * @param request - Petició entrant
 * @param context - Paràmetres de ruta amb l'id de l'animal
 * @returns JSON FitxaAnimal, o 404 si l'animal no existeix
 *
 * @remarks Control d'accés: lectura oberta als 3 rols
 * (docs/08_modul_llistat_actius.md — la fitxa de només consulta és
 * visible per tothom; el botó de baixa es controla a
 * POST /api/animals/[id]/baixa, no aquí).
 * @remarks Multitenancy: delega a getFitxaAnimal
 * (src/lib/db/queries/animals.ts), aïllada via queryTenant/search_path.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx: TenantContext = {
    userId: Number(request.headers.get('x-user-id')),
    tenantSchema: request.headers.get('x-tenant-schema') ?? '',
    rol: request.headers.get('x-user-rol') as Rol,
  }

  if (!ctx.tenantSchema) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const fitxa = await getFitxaAnimal(ctx, Number(id))
    if (!fitxa) {
      return NextResponse.json({ error: 'Animal no trobat' }, { status: 404 })
    }
    return NextResponse.json(fitxa)
  } catch (error) {
    console.error('[GET /api/animals/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
