import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getMedicaments, crearMedicament } from '@/lib/db/queries/sanitari'
import { crearMedicamentSchema } from '@/lib/validators/sanitari'

/**
 * GET /api/sanitari/medicaments
 *
 * Retorna l'inventari complet de medicaments.
 *
 * @param request - Petició entrant
 * @returns JSON { medicaments: Medicament[] }, o 401/403
 *
 * @remarks Control d'accés: Admin i Veterinari (lectura+escriptura),
 * Treballador només lectura (ampliació sobre docs/06_modul_sanitari.md,
 * secció 1). Els 3 rols poden fer GET; només Admin/Veterinari poden
 * escriure (comprovat als altres mètodes/endpoints).
 * @remarks Multitenancy: delega a getMedicaments
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
    const medicaments = await getMedicaments(ctx)
    return NextResponse.json({ medicaments })
  } catch (error) {
    console.error('[GET /api/sanitari/medicaments]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/sanitari/medicaments
 *
 * Crea un medicament individualment (formulari, no CSV).
 *
 * @param request - Body: CrearMedicamentInput
 * @returns JSON { id: number }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Multitenancy: delega a crearMedicament, aïllada via
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
    const parsed = crearMedicamentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const resultat = await crearMedicament(ctx, {
      ...parsed.data,
      posologiaStandard: parsed.data.posologiaStandard || undefined,
    })

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_MEDICAMENT',
      taulaAfectada: 'medicaments',
      registreId: resultat.id,
      dadesJson: { nomMedicament: parsed.data.nomMedicament, lot: parsed.data.lot },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/sanitari/medicaments]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
