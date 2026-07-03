import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

if (!process.env.JWT_SECRET) {
  throw new Error('Variable d\'entorn JWT_SECRET no definida')
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)
const ACCESS_EXPIRY  = (process.env.JWT_ACCESS_EXPIRY  ?? '1h')  as `${number}${'h'|'m'|'d'}`
const REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY ?? '30d') as `${number}${'h'|'m'|'d'}`

export type AccessTokenPayload = JWTPayload & {
  sub:          string   // userId
  tenantId:     number
  tenantSchema: string
  rol:          'Admin' | 'Veterinari' | 'Treballador'
}

export type RefreshTokenPayload = JWTPayload & {
  sub:  string   // userId
  type: 'refresh'
}

/**
 * Genera un access token JWT amb el context de l'usuari i el tenant.
 * Caducitat: 1 hora (configurable via JWT_ACCESS_EXPIRY).
 */
export async function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRY)
    .sign(JWT_SECRET)
}

/**
 * Genera un refresh token JWT.
 * Caducitat: 30 dies (configurable via JWT_REFRESH_EXPIRY).
 */
export async function signRefreshToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId), type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(JWT_SECRET)
}

/**
 * Verifica i retorna el payload d'un access token.
 * Llança excepció si el token és invàlid o ha caducat.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET)
  return payload as AccessTokenPayload
}

/**
 * Verifica i retorna el payload d'un refresh token.
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET)
  if (payload['type'] !== 'refresh') {
    throw new Error('Token tipus incorrecte')
  }
  return payload as RefreshTokenPayload
}
