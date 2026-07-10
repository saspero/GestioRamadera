import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getJerarquiaCompleta, crearUbicacio } from '@/lib/db/queries/infraestructura'
import { crearUbicacioSchema } from '@/lib/validators/infraestructura'

/**
 * GET /api/infraestructura
 *
 * Retorna la jerarquia completa Granja (ubicació) → Zona → Cort.
 *
 * @param request - Petició entrant; el middleware ja hi ha afegit les
 * capçaleres x-user-id, x-tenant-schema i x-user-rol a partir del JWT
 * @returns JSON { ubicacions: UbicacioAmbJerarquia[] }, o 401/403
 *
 * @remarks Control d'accés: lectura oberta als 3 rols (Admin,
 * Veterinari, Treballador). La creació/edició (POST/PATCH als altres
 * endpoints d'aquest mòdul) es manté restringida a Admin i Veterinari
 * — docs/13_modul_granja_corts.md.
 * @remarks Multitenancy: delega a getJerarquiaCompleta
 * (src/lib/db/queries/infraestructura.ts), aïllada via queryTenant/search_path.
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
    const ubicacions = await getJerarquiaCompleta(ctx)
    return NextResponse.json({ ubicacions })
  } catch (error) {
    console.error('[GET /api/infraestructura]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/infraestructura
 *
 * Crea una nova ubicació (granja/finca).
 *
 * @param request - Body: { nom, codiPasturaExtensiu? }
 * @returns JSON { id: number }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a crearUbicacio
 * (src/lib/db/queries/infraestructura.ts), aïllada via queryTenant/search_path.
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
    const parsed = crearUbicacioSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const resultat = await crearUbicacio(ctx, {
      nom: parsed.data.nom,
      codiPasturaExtensiu: parsed.data.codiPasturaExtensiu || undefined,
    })

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_UBICACIO',
      taulaAfectada: 'ubicacions',
      registreId: resultat.id,
      dadesJson: { nom: parsed.data.nom },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/infraestructura]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
