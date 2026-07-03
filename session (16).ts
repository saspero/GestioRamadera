import { NextRequest, NextResponse } from 'next/server'
import { queryPublic } from '@/lib/db/client'
import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setSessionCookies, clearSessionCookies } from '@/lib/auth/session'
import { cookies } from 'next/headers'
import type { User } from '@/types/db'

type UserRow = User & { tenantSchema: string; tenantId: number }

/**
 * Renova l'access token a partir d'un refresh token vàlid.
 * Es crida automàticament pel client quan l'access token està a punt
 * de caducar (vegeu src/hooks/useSession.ts).
 *
 * Rotació de refresh token: cada renovació emet un refresh token NOU
 * i invalida l'anterior (el vell deixa de ser útil un cop usat).
 */
export async function POST() {
  try {
    const cookieStore = await cookies()
    const refreshToken = cookieStore.get('refresh_token')?.value

    if (!refreshToken) {
      return NextResponse.json({ error: 'No hi ha sessió' }, { status: 401 })
    }

    // 1. Verificar el refresh token
    let payload
    try {
      payload = await verifyRefreshToken(refreshToken)
    } catch {
      await clearSessionCookies()
      return NextResponse.json(
        { error: 'Sessió expirada, cal tornar a iniciar sessió' },
        { status: 401 }
      )
    }

    const userId = Number(payload.sub)

    // 2. Comprovar que l'usuari i el tenant segueixen actius
    //    (evita que un usuari desactivat pugui seguir refrescant sessió)
    const rows = await queryPublic<UserRow>(
      `SELECT
        u.id, u.tenant_id AS "tenantId", u.nom, u.email, u.rol, u.actiu,
        t.schema_name AS "tenantSchema"
       FROM public.users u
       JOIN public.tenants t ON t.id = u.tenant_id
       WHERE u.id = $1
         AND u.actiu = TRUE
         AND t.actiu = TRUE`,
      [userId]
    )

    const user = rows[0]
    if (!user) {
      await clearSessionCookies()
      return NextResponse.json(
        { error: 'Usuari no disponible' },
        { status: 401 }
      )
    }

    // 3. Generar un NOU access token i un NOU refresh token (rotació)
    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken({
        sub:          String(user.id),
        tenantId:     user.tenantId,
        tenantSchema: user.tenantSchema,
        rol:          user.rol,
      }),
      signRefreshToken(user.id),
    ])

    await setSessionCookies(newAccessToken, newRefreshToken)

    return NextResponse.json({ ok: true })

  } catch (error) {
    console.error('[POST /api/auth/refresh]', error)
    return NextResponse.json({ error: 'Error intern' }, { status: 500 })
  }
}
