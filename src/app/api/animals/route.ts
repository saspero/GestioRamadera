import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getAnimalsActius, cercarPerDib, crearAnimalIndividual } from '@/lib/db/queries/animals'
import { crearAnimalSchema } from '@/lib/validators/animals'

/**
 * GET /api/animals
 *
 * Retorna el llistat d'animals actius. Si es passa el paràmetre de
 * consulta `cerca`, filtra per coincidència parcial del DIB.
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
 * @remarks Multitenancy: delega a getAnimalsActius/cercarPerDib
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
    const animals = cerca ? await cercarPerDib(ctx, cerca) : await getAnimalsActius(ctx)
    return NextResponse.json({ animals })
  } catch (error) {
    console.error('[GET /api/animals]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/animals
 *
 * Dona d'alta un animal individual amb la seva distribució inicial
 * (lot + cort), fora del flux d'importació massiva.
 *
 * @param request - Body: CrearAnimalInput (dib, racaId?, dataNaixement?,
 * sexe?, lotId, cortId)
 * @returns JSON { id: number }, o error 400/401/403/409/500
 *
 * @remarks Control d'accés: Admin i Veterinari (docs/08_modul_llistat_actius.md,
 * secció 5 — ampliació respecte al disseny original, que només
 * contemplava Admin: un veterinari sovint és qui rep i registra un
 * animal nou durant una visita). Treballador NO hi té accés.
 * @remarks Multitenancy: delega a crearAnimalIndividual
 * (src/lib/db/queries/animals.ts), aïllada via queryTenant/search_path.
 * @remarks Seguretat: comprova explícitament que el DIB no existeixi
 * abans d'inserir, retornant 409 amb un missatge clar en comptes de
 * deixar que la constraint UNIQUE de la BD llenci un error genèric.
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
    const parsed = crearAnimalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { dib, racaId, dataNaixement, sexe, lotId, cortId } = parsed.data

    let resultat
    try {
      resultat = await crearAnimalIndividual(ctx, {
        dib,
        racaId,
        dataNaixement: dataNaixement || undefined,
        sexe: (sexe || undefined) as 'Mascle' | 'Femella' | undefined,
        lotId,
        cortId,
      })
    } catch (dbError) {
      // La constraint UNIQUE de animals.dib llança un error de PostgreSQL
      // (codi 23505) si el DIB ja existeix — el traduïm a un 409 clar.
      const isDuplicat =
        dbError instanceof Error && dbError.message.includes('duplicate key')
      if (isDuplicat) {
        return NextResponse.json(
          { error: 'Aquest DIB ja existeix a la base de dades' },
          { status: 409 }
        )
      }
      throw dbError
    }

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'ALTA_INDIVIDUAL',
      taulaAfectada: 'animals',
      registreId: resultat.id,
      dadesJson: { dib },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/animals]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
