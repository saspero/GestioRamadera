import { cookies } from 'next/headers'
import { verifyAccessToken, type AccessTokenPayload } from './jwt'

const ACCESS_COOKIE  = 'access_token'
const REFRESH_COOKIE = 'refresh_token'

// Configuració de cookies segures
const COOKIE_OPTIONS_ACCESS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path:     '/',
  maxAge:   60 * 60, // 1 hora en segons
}

const COOKIE_OPTIONS_REFRESH = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path:     '/api/auth', // Restringit als endpoints d'auth
  maxAge:   60 * 60 * 24 * 30, // 30 dies en segons
}

/**
 * Desa els tokens a les cookies segures HttpOnly.
 */
export async function setSessionCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ACCESS_COOKIE,  accessToken,  COOKIE_OPTIONS_ACCESS)
  cookieStore.set(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS_REFRESH)
}

/**
 * Elimina les cookies de sessió (logout).
 */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(ACCESS_COOKIE)
  cookieStore.delete(REFRESH_COOKIE)
}

/**
 * Llegeix i verifica la sessió actual.
 * Retorna el payload del JWT o null si no hi ha sessió vàlida.
 */
export async function getSession(): Promise<AccessTokenPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(ACCESS_COOKIE)?.value
    if (!token) return null
    return await verifyAccessToken(token)
  } catch {
    return null
  }
}
