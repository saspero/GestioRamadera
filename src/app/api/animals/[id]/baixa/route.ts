import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { comprovarBloquejComercial, registrarBaixa } from '@/lib/db/queries/baixes'
import { registrarBaixaSchema } from '@/lib/validators/baixes'

/**
 * POST /api/animals/[id]/baixa
 *
 * Registra la baixa d'un animal (venda o mort), seguint el flux
 * documentat a docs/07_modul_arxiu_historic.md.
 *
 * @param request - Body: RegistrarBaixaInput (venda o mort, discriminat per `motiu`)
 * @param context - Paràmetres de ruta amb l'id de l'animal
 * @returns JSON { ok: true }, o error 400/401/403/404/409/500
 *
 * @remarks Control d'accés: Admin i Veterinari (ampliació sobre
 * docs/07_modul_arxiu_historic.md, secció 1, que reservava el
 * registre de baixes exclusivament a Admin dins del mòdul Arxiu —
 * decisió confirmada per a l'accés des de la fitxa d'Animals actius).
 * @remarks Validació prèvia (docs/07_modul_arxiu_historic.md, secció
 * 3.3): si l'animal té un tractament actiu amb bloqueig comercial
 * (data_alliberament > avui), es rebutja la venda amb 409 i un
 * missatge que indica el medicament i la data d'alliberament. Aquesta
 * comprovació només aplica a vendes — un animal pot morir encara que
 * estigui en període de supressió.
 * @remarks Multitenancy: delega a comprovarBloquejComercial i
 * registrarBaixa (src/lib/db/queries/baixes.ts), aïllades via
 * queryTenant/search_path.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    const { id } = await context.params
    const animalId = Number(id)

    const body = await request.json()
    const parsed = registrarBaixaSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (parsed.data.motiu === 'Venda') {
      const bloqueig = await comprovarBloquejComercial(ctx, animalId)
      if (bloqueig) {
        return NextResponse.json(
          {
            error: `L'animal ${bloqueig.dib} no pot ser venut fins al ${bloqueig.dataAlliberament} per període de supressió del tractament ${bloqueig.nomMedicament}.`,
          },
          { status: 409 }
        )
      }
    }

    await registrarBaixa(ctx, animalId, parsed.data)

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: parsed.data.motiu === 'Venda' ? 'BAIXA_VENDA' : 'BAIXA_MORT',
      taulaAfectada: 'baixes',
      registreId: animalId,
      dadesJson: parsed.data,
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[POST /api/animals/[id]/baixa]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
