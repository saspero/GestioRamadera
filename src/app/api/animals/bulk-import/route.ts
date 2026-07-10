import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import {
  trobarDibsExistents,
  resoldreLotsPerNom,
  importarAnimalsMassiu,
} from '@/lib/db/queries/animals'
import { bulkImportSchema } from '@/lib/validators/animals'

/**
 * POST /api/animals/bulk-import
 *
 * Confirma l'alta massiva d'animals a partir d'un bloc ja validat i
 * previsualitzat al client (docs/08_modul_llistat_actius.md, secció 4.3).
 *
 * @param request - Body: { animals: FilaAltaMassiva[], assignacio: AssignacioBase }
 * @returns JSON { nombreCreats: number }, o error 400/401/403/409/500
 *
 * @remarks Control d'accés: Admin únicament (docs/08_modul_llistat_actius.md,
 * secció "Rols amb accés").
 * @remarks Multitenancy: delega a importarAnimalsMassiu
 * (src/lib/db/queries/animals.ts), aïllada via queryTenant/search_path.
 * @remarks Seguretat: revalida els DIB contra la BD just abans
 * d'inserir (encara que el client ja els hagi comprovat a la
 * previsualització), per evitar condicions de carrera si dos Admins
 * importen simultàniament el mateix DIB — retorna 409 si en troba.
 * @remarks Lot per fila: si una fila indica `lot_nom`, es resol (o
 * es crea) abans de la importació i té prioritat sobre el lot per
 * defecte de `assignacio` per a aquell animal concret.
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
  if (ctx.rol !== 'Admin') {
    return NextResponse.json({ error: 'Sense permisos per a aquesta operació' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = bulkImportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { animals, assignacio } = parsed.data

    // Revalidació de duplicats contra la BD (defensa en profunditat)
    const dibs = animals.map((a) => a.dib)
    const duplicats = await trobarDibsExistents(ctx, dibs)
    if (duplicats.length > 0) {
      return NextResponse.json(
        { error: 'Alguns DIB ja existeixen a la base de dades', duplicats },
        { status: 409 }
      )
    }

    // Resoldre els lots propis de fila (lot_nom), si n'hi ha
    const nomsLotPerFila = animals
      .map((a) => a.lot_nom?.trim())
      .filter((nom): nom is string => !!nom)
    const mapaLots = await resoldreLotsPerNom(ctx, nomsLotPerFila)

    const resultat = await importarAnimalsMassiu(
      ctx,
      animals.map((a) => ({
        dib: a.dib,
        dataNaixement: a.data_naixement || undefined,
        sexe: (a.sexe || undefined) as 'Mascle' | 'Femella' | undefined,
        lotId: a.lot_nom?.trim() ? mapaLots.get(a.lot_nom.trim()) : undefined,
      })),
      assignacio
    )

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'ALTA_MASSIVA',
      taulaAfectada: 'animals',
      dadesJson: { nombreAnimals: resultat.nombreCreats, assignacio },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat)
  } catch (error) {
    console.error('[POST /api/animals/bulk-import]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
