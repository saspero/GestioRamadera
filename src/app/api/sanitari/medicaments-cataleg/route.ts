import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getMedicamentsCataleg, crearMedicamentCataleg } from '@/lib/db/queries/sanitari'
import { crearMedicamentCatalegSchema } from '@/lib/validators/sanitari'

/**
 * GET /api/sanitari/medicaments-cataleg
 *
 * Retorna el catàleg complet de medicaments (dades mestres).
 *
 * @remarks Control d'accés: Admin i Veterinari (lectura+escriptura),
 * Treballador només lectura.
 * @remarks Multitenancy: delega a getMedicamentsCataleg, aïllada via
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

  try {
    const medicamentsCataleg = await getMedicamentsCataleg(ctx)
    return NextResponse.json({ medicamentsCataleg })
  } catch (error) {
    console.error('[GET /api/sanitari/medicaments-cataleg]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/sanitari/medicaments-cataleg
 *
 * Crea un medicament nou al catàleg (només dades mestres, sense
 * cap entrada d'estoc).
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a crearMedicamentCataleg, aïllada
 * via queryTenant/search_path.
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
    const parsed = crearMedicamentCatalegSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    let resultat
    try {
      resultat = await crearMedicamentCataleg(ctx, {
        ...parsed.data,
        posologiaStandard: parsed.data.posologiaStandard || undefined,
      })
    } catch (dbError) {
      const esDuplicat =
        dbError instanceof Error && dbError.message.includes('duplicate key')
      if (esDuplicat) {
        return NextResponse.json(
          { error: 'Ja existeix un medicament amb aquest nom al catàleg' },
          { status: 409 }
        )
      }
      throw dbError
    }

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_MEDICAMENT_CATALEG',
      taulaAfectada: 'medicaments_cataleg',
      registreId: resultat.id,
      dadesJson: { nomMedicament: parsed.data.nomMedicament },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/sanitari/medicaments-cataleg]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
