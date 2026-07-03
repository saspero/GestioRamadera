import { NextRequest, NextResponse } from 'next/server'
import { queryPublic } from '@/lib/db/client'
import { verifyPassword } from '@/lib/auth/password'
import { signAccessToken, signRefreshToken } from '@/lib/auth/jwt'
import { setSessionCookies } from '@/lib/auth/session'
import { loginSchema } from '@/lib/validators/auth'
import {
  comprovarRateLimit,
  registrarIntent,
  extreureIp,
} from '@/lib/auth/rateLimit'
import type { User } from '@/types/db'

// Missatge genèric per evitar enumeració d'usuaris
const ERROR_CREDENCIALS = 'Email o contrasenya incorrectes'
const ERROR_BLOQUEJAT   = 'Massa intents. Torna-ho a provar d\'aquí a 15 minuts.'

type UserRow = User & { passwordHash: string; tenantSchema: string; tenantId: number }

export async function POST(request: NextRequest) {
  const ipOrigen = extreureIp(request.headers)

  try {
    // 1. Validar i parsejar el body amb Zod
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dades incorrectes', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    // 2. Comprovar rate limiting ABANS de tocar la BD d'usuaris
    //    (per IP o per email, el que salti primer)
    const rateLimit = await comprovarRateLimit(email, ipOrigen)
    if (rateLimit.bloquejat) {
      // Registrem el bloqueig a l'auditoria (sense user_id, no identificat)
      await queryPublic(
        `INSERT INTO public.audit_log (accio, ip_origen, dades_json)
         VALUES ('LOGIN_BLOCKED', $1, $2)`,
        [ipOrigen, JSON.stringify({ email, motiu: rateLimit.motiu })]
      )
      return NextResponse.json({ error: ERROR_BLOQUEJAT }, { status: 429 })
    }

    // 3. Buscar l'usuari i el seu tenant (JOIN per obtenir el schema_name)
    const rows = await queryPublic<UserRow>(
      `SELECT
        u.id, u.tenant_id AS "tenantId", u.nom, u.email,
        u.password_hash AS "passwordHash", u.rol, u.actiu,
        t.schema_name AS "tenantSchema"
       FROM public.users u
       JOIN public.tenants t ON t.id = u.tenant_id
       WHERE u.email = $1
         AND u.actiu = TRUE
         AND t.actiu = TRUE`,
      [email]
    )

    const user = rows[0]

    // 4. Verificar contrasenya (temps constant — evita timing attacks)
    //    Si no existeix l'usuari, comparem igualment contra un hash fictici
    //    per no revelar si l'email existeix (enumeració d'usuaris)
    const hashDummy = '$2b$12$invalidhashfordummycomparison1234567890'
    const passwordValid = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, hashDummy)

    if (!user || !passwordValid) {
      // Registrar l'intent fallit — ambdues taules, responsabilitats separades
      await registrarIntent(email, ipOrigen, false)
      await queryPublic(
        `INSERT INTO public.audit_log (accio, ip_origen, dades_json)
         VALUES ('LOGIN_FAILED', $1, $2)`,
        [ipOrigen, JSON.stringify({ email })]
      )
      return NextResponse.json({ error: ERROR_CREDENCIALS }, { status: 401 })
    }

    // 5. Login correcte — generar tokens JWT
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({
        sub:          String(user.id),
        tenantId:     user.tenantId,
        tenantSchema: user.tenantSchema,
        rol:          user.rol,
      }),
      signRefreshToken(user.id),
    ])

    // 6. Actualitzar darrer_acces i registrar èxit a ambdues taules
    await queryPublic(
      `UPDATE public.users SET darrer_acces = NOW() WHERE id = $1`,
      [user.id]
    )
    await registrarIntent(email, ipOrigen, true)
    await queryPublic(
      `INSERT INTO public.audit_log (tenant_id, user_id, accio, ip_origen)
       VALUES ($1, $2, 'LOGIN', $3)`,
      [user.tenantId, user.id, ipOrigen]
    )

    // 7. Desar tokens a cookies HttpOnly i retornar resposta mínima
    await setSessionCookies(accessToken, refreshToken)

    return NextResponse.json({
      rol: user.rol,
      nom: user.nom,
    })

  } catch (error) {
    console.error('[POST /api/auth/login]', error)
    return NextResponse.json(
      { error: 'Error intern del servidor' },
      { status: 500 }
    )
  }
}
