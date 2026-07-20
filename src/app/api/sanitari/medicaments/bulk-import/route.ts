import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { importarMedicamentsMassiu } from '@/lib/db/queries/sanitari'
import { bulkImportMedicamentsSchema } from '@/lib/validators/sanitari'

/**
 * Converteix un valor numèric en format text amb coma decimal
 * (docs/06_modul_sanitari.md, secció 3.2) a un número JavaScript.
 */
function parseNumeroCatala(valor: string): number {
  return Number(valor.replace(',', '.'))
}

/**
 * POST /api/sanitari/medicaments/bulk-import
 *
 * Confirma la importació massiva de medicaments des d'un CSV ja
 * validat i previsualitzat al client. Els duplicats (mateix nom+lot)
 * actualitzen automàticament l'estoc sumant la quantitat, sense
 * preguntar a l'usuari (decisió confirmada — veure
 * docs/06_modul_sanitari.md, secció 3.3, ampliat).
 *
 * @param request - Body: { medicaments: FilaCsvMedicament[] }
 * @returns JSON { nombreCatalegsCreats, nombreEntradesCreades, nombreEntradesActualitzades }, o error 400/401/403/500
 *
 * @remarks Control d'accés: Admin i Veterinari.
 * @remarks Conversió numèrica: els camps quantitat/preu arriben com
 * a text amb coma decimal (format del CSV) — es converteixen aquí,
 * al backend, abans de passar-los a importarMedicamentsMassiu().
 * @remarks Multitenancy: delega a importarMedicamentsMassiu
 * (src/lib/db/queries/sanitari.ts), aïllada via queryTenant/search_path.
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
    const parsed = bulkImportMedicamentsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const medicaments = parsed.data.medicaments.map((m) => ({
      nomMedicament: m.nom_medicament,
      principiActiu: m.principi_actiu,
      lot: m.lot,
      nombreUnitats: parseNumeroCatala(m.nombre_unitats),
      unitatPaquet: m.unitat_paquet,
      quantitatPerUnitat: parseNumeroCatala(m.quantitat_per_unitat),
      unitatContingut: m.unitat_contingut,
      posologia: m.posologia || undefined,
      preu: parseNumeroCatala(m.preu),
      diesSupressio: Number(m.dies_supressio),
    }))

    const resultat = await importarMedicamentsMassiu(ctx, medicaments)

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'IMPORTAR_MEDICAMENTS',
      taulaAfectada: 'medicaments',
      dadesJson: resultat,
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat)
  } catch (error) {
    console.error('[POST /api/sanitari/medicaments/bulk-import]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
