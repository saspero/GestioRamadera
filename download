import { NextRequest, NextResponse } from 'next/server'
import { queryTenant, type TenantContext } from '@/lib/db/client'
import type { AnimalActiu } from '@/types/db'

export async function GET(request: NextRequest) {
  const ctx: TenantContext = {
    userId:       Number(request.headers.get('x-user-id')),
    tenantSchema: request.headers.get('x-tenant-schema') ?? '',
    rol:          request.headers.get('x-user-rol') as TenantContext['rol'],
  }

  if (!ctx.tenantSchema) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  try {
    const animals = await queryTenant<AnimalActiu>(
      ctx,
      `SELECT * FROM v_animals_actius ORDER BY crotal_id`,
    )
    return NextResponse.json({ animals })
  } catch (error) {
    console.error('[GET /api/animals]', error)
    return NextResponse.json({ error: 'Error intern' }, { status: 500 })
  }
}
