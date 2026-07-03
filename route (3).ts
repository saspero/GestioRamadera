import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import type { AccessTokenPayload } from '@/lib/auth/jwt'

// Rutes accessibles sense autenticació
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
]

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Deixar passar les rutes públiques
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Llegir el token de la cookie HttpOnly
  const token = request.cookies.get('access_token')?.value

  if (!token) {
    // Redirigir al login si és una pàgina, o retornar 401 si és una API
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'No autenticat' },
        { status: 401 }
      )
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const session = payload as AccessTokenPayload

    // Propagar el context de sessió a les API Routes via capçaleres internes
    const response = NextResponse.next()
    response.headers.set('x-user-id',      String(session.sub))
    response.headers.set('x-tenant-id',    String(session.tenantId))
    response.headers.set('x-tenant-schema', session.tenantSchema)
    response.headers.set('x-user-rol',     session.rol)

    // Si al token li queden menys de 5 minuts, avisem el client perquè
    // llenci un refresh en segon pla (veure src/hooks/useSession.ts).
    // No bloquegem la petició actual — només afegim un senyal.
    const araEnSegons = Math.floor(Date.now() / 1000)
    const segonsRestants = (session.exp ?? 0) - araEnSegons
    if (segonsRestants < 5 * 60) {
      response.headers.set('x-token-refresh-suggested', 'true')
    }

    return response

  } catch {
    // Token expirat o invàlid
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Sessió expirada', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      )
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    // Eliminar cookies invàlides
    response.cookies.delete('access_token')
    response.cookies.delete('refresh_token')
    return response
  }
}

export const config = {
  // Excloure fitxers estàtics i recursos de Next.js
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)',
  ],
}
