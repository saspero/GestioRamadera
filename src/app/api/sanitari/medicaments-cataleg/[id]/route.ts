import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { actualitzarMedicamentCataleg, eliminarMedicamentCataleg } from '@/lib/db/queries/sanitari'
import { actualitzarMedicamentCatalegSchema } from '@/lib/validators/sanitari'

/**
 * PATCH /api/sanitari/medicaments-cataleg/[id]
 *
 * Actualitza un medicament del catàleg (dades mestres).
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a actualitzarMedicamentCataleg,
 * aïllada via queryTenant/search_path.
 */
export async function PATCH(
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    const body = await request.json()
    const parsed = actualitzarMedicamentCatalegSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    try {
      await actualitzarMedicamentCataleg(ctx, Number(id), {
        ...parsed.data,
        posologiaStandard: parsed.data.posologiaStandard || undefined,
      })
    } catch (dbError) {
      const esDuplicat = dbError instanceof Error && dbError.message.includes('duplicate key')
      if (esDuplicat) {
        return NextResponse.json(
          { error: 'Ja existeix un medicament amb aquest nom al catàleg' },
          { status: 409 }
        )
      }
      throw dbError
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PATCH /api/sanitari/medicaments-cataleg/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * DELETE /api/sanitari/medicaments-cataleg/[id]
 *
 * Elimina un medicament del catàleg.
 *
 * @remarks Si hi ha entrades d'estoc que en depenen, la BD rebutja
 * l'eliminació per FK (ON DELETE RESTRICT) — es tradueix a un 409
 * amb missatge clar.
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a eliminarMedicamentCataleg, aïllada
 * via queryTenant/search_path.
 */
export async function DELETE(
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const { id } = await context.params
    try {
      await eliminarMedicamentCataleg(ctx, Number(id))
    } catch (dbError) {
      const esViolacioFk =
        dbError instanceof Error &&
        (dbError.message.includes('foreign key') || dbError.message.includes('violates'))
      if (esViolacioFk) {
        return NextResponse.json(
          { error: 'No es pot eliminar: hi ha entrades d\'estoc que fan servir aquest medicament' },
          { status: 409 }
        )
      }
      throw dbError
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/sanitari/medicaments-cataleg/[id]]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
