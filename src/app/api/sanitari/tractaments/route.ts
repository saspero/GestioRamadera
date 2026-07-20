import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getTractaments, aplicarTractament, getAnimalIdsDelLot } from '@/lib/db/queries/sanitari'
import { aplicarTractamentSchema } from '@/lib/validators/sanitari'

/**
 * GET /api/sanitari/tractaments
 *
 * Retorna els tractaments aplicats, amb el nom del medicament i el
 * DIB de l'animal, els més recents primer.
 *
 * @param request - Petició entrant
 * @returns JSON { tractaments: TractamentAmbMedicament[] }, o 401
 *
 * @remarks Control d'accés: lectura oberta als 3 rols (Treballador
 * només lectura, ampliació sobre docs/06_modul_sanitari.md, secció 1).
 * @remarks Multitenancy: delega a getTractaments
 * (src/lib/db/queries/sanitari.ts), aïllada via queryTenant/search_path.
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
    const tractaments = await getTractaments(ctx)
    return NextResponse.json({ tractaments })
  } catch (error) {
    console.error('[GET /api/sanitari/tractaments]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/sanitari/tractaments
 *
 * Aplica un tractament a un o més animals seleccionats directament,
 * o a tots els animals actius d'un lot (mode "Per lot" —
 * docs/06_modul_sanitari.md, secció 4.1).
 *
 * @param request - Body: AplicarTractamentInput + `lotId` opcional
 * (si `lotId` s'informa, substitueix `animalIds` pels animals
 * actius d'aquell lot)
 * @returns JSON { nombreTractaments: number }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Mode "Per lot": s'expandeix lotId als seus animal_ids
 * actius abans de cridar aplicarTractament() — tots reben la mateixa
 * dosi/data (confirmat amb l'usuari, sense personalització per animal).
 * @remarks Multitenancy: delega a getAnimalIdsDelLot i
 * aplicarTractament (src/lib/db/queries/sanitari.ts), aïllades via
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
  if (ctx.rol !== 'Admin' && ctx.rol !== 'Veterinari') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const lotId = typeof body.lotId === 'number' ? body.lotId : undefined

    let animalIds = body.animalIds
    if (lotId !== undefined) {
      animalIds = await getAnimalIdsDelLot(ctx, lotId)
      if (animalIds.length === 0) {
        return NextResponse.json(
          { error: 'El lot seleccionat no té animals actius' },
          { status: 400 }
        )
      }
    }

    const parsed = aplicarTractamentSchema.safeParse({ ...body, animalIds })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const resultat = await aplicarTractament(ctx, {
      ...parsed.data,
      dataFiPrevista: parsed.data.dataFiPrevista || undefined,
      unitatDosi: parsed.data.unitatDosi || undefined,
      notes: parsed.data.notes || undefined,
    })

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'APLICAR_TRACTAMENT',
      taulaAfectada: 'tractaments',
      dadesJson: { ...parsed.data, lotId },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat)
  } catch (error) {
    console.error('[POST /api/sanitari/tractaments]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
