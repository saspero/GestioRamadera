import { NextRequest, NextResponse } from 'next/server'
import type { TenantContext, Rol } from '@/lib/db/client'
import { auditLog } from '@/lib/db/client'
import { getUsuaris, crearUsuari } from '@/lib/db/queries/configuracio'
import { crearUsuariSchema } from '@/lib/validators/configuracio'

/**
 * GET /api/configuracio/usuaris
 *
 * Retorna tots els usuaris del tenant.
 *
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: delega a getUsuaris, aïllada per tenant_id
 * explícit (la taula users viu a l'schema public, compartida).
 */
export async function GET(request: NextRequest) {
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
    const usuaris = await getUsuaris(tenantId)
    return NextResponse.json({ usuaris })
  } catch (error) {
    console.error('[GET /api/configuracio/usuaris]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}

/**
 * POST /api/configuracio/usuaris
 *
 * Crea un usuari nou per al tenant.
 *
 * @remarks Control d'accés: Admin únicament.
 * @remarks Multitenancy: delega a crearUsuari, aïllada per tenant_id
 * explícit.
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
    const parsed = crearUsuariSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    let resultat
    try {
      resultat = await crearUsuari(tenantId, parsed.data)
    } catch (dbError) {
      const esDuplicat =
        dbError instanceof Error && dbError.message.includes('duplicate key')
      if (esDuplicat) {
        return NextResponse.json({ error: 'Aquest email ja està en ús' }, { status: 409 })
      }
      throw dbError
    }

    await auditLog({
      tenantId,
      userId: ctx.userId,
      accio: 'CREAR_USUARI',
      taulaAfectada: 'public.users',
      registreId: resultat.id,
      dadesJson: { nom: parsed.data.nom, email: parsed.data.email, rol: parsed.data.rol },
      ipOrigen: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(resultat, { status: 201 })
  } catch (error) {
    console.error('[POST /api/configuracio/usuaris]', error)
    return NextResponse.json({ error: 'Error intern del servidor' }, { status: 500 })
  }
}
