import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { crearCort } from '@/lib/db/queries/infraestructura'
import { crearCortSchema } from '@/lib/validators/infraestructura'

/**
 * POST /api/infraestructura/corts
 *
 * Crea una nova cort dins d'una zona de tipus NAU_ANIMALS.
 *
 * @param request - Body: { zonaId, codiCort, capacitatMaxima? }
 * @returns JSON { id: number }, o error 400/401/403/422/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks La BD rebutja la inserció (trigger trg_corts_zona_tipus)
 * si zonaId no és una zona NAU_ANIMALS. Aquest endpoint intercepta
 * aquest error concret i el tradueix a un 422 amb missatge clar en
 * comptes de deixar-lo com a 500 genèric.
 * @remarks Multitenancy: delega a crearCort
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
    const parsed = crearCortSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    let resultat
    try {
      resultat = await crearCort(ctx, parsed.data)
    } catch (dbError) {
      const esErrorDeZona =
        dbError instanceof Error && dbError.message.includes('NAU_ANIMALS')
      if (esErrorDeZona) {
        return NextResponse.json(
          { error: 'La zona seleccionada no és una nau d\'animals' },
          { status: 422 }
        )
      }
      throw dbError
    }

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_CORT',
      taulaAfectada: 'corts',
      registreId: resultat.id,
      dadesJson: parsed.data,
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/infraestructura/corts]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
