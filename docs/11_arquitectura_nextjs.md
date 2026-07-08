# 11 — Arquitectura Next.js (Frontend + Backend)

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026  
> **Framework:** Next.js 15 — App Router  
> **Desplegament:** Vercel

---

## 1. Stack Tecnològic

| Capa | Tecnologia | Versió | Justificació |
|------|-----------|--------|-------------|
| **Framework** | Next.js | 15+ | Full-stack: frontend + API Routes en un sol projecte |
| **Llenguatge** | TypeScript | 5+ | Tipat estàtic, detecció d'errors en temps de compilació |
| **Estils** | Tailwind CSS | 3+ | Utilitats CSS, ideal per a dissenys responsiu |
| **Components UI** | Shadcn/ui | últim | Components accessibles pre-construïts sobre Tailwind |
| **Autenticació** | JWT manual + `jose` | — | Màxim control, compatible amb Edge Runtime de Vercel |
| **Contrasenyes** | `bcryptjs` | — | Hash segur de contrasenyes (cost factor >= 12) |
| **BD Client** | `pg` (node-postgres) | — | Client PostgreSQL directe, suporta `search_path` per sessió |
| **Validació** | `zod` | — | Validació d'esquemes TypeScript als endpoints |
| **Desplegament** | Vercel | — | Natiu per a Next.js, CI/CD automàtic des de GitHub |

---

## 2. Estructura de Carpetes del Projecte

```
/                                      ← Arrel del repositori
├── README.md
├── next.config.ts                     ← Configuració de Next.js
├── tailwind.config.ts                 ← Configuració de Tailwind
├── tsconfig.json                      ← Configuració de TypeScript
├── .env.local                         ← Variables d'entorn locals (NO pujar a Git)
├── .env.example                       ← Plantilla de variables d'entorn (SÍ pujar)
├── .gitignore
│
├── database/                          ← Scripts SQL (ja existents)
│   ├── 01_schema_public.sql
│   ├── 02_schema_tenant_template.sql
│   ├── 03_rls_public.sql
│   ├── 00_neteja_reintent.sql
│   └── verificar_extensio.sql
│
├── docs/                              ← Documentació tècnica (ja existent)
│   └── *.md
│
└── src/
    ├── app/                           ← App Router de Next.js
    │   ├── layout.tsx                 ← Layout arrel (fonts, metadades globals)
    │   ├── page.tsx                   ← Pàgina d'inici (redirigeix a /login o /dashboard)
    │   │
    │   ├── (auth)/                    ← Grup de rutes públiques (sense sidebar)
    │   │   └── login/
    │   │       └── page.tsx           ← Pantalla de login
    │   │
    │   ├── (app)/                     ← Grup de rutes protegides (amb sidebar)
    │   │   ├── layout.tsx             ← Layout amb sidebar + comprovació de sessió
    │   │   ├── dashboard/
    │   │   │   └── page.tsx
    │   │   ├── animals/
    │   │   │   ├── page.tsx           ← Llistat d'actius
    │   │   │   └── [crotalId]/
    │   │   │       └── page.tsx       ← Fitxa d'animal
    │   │   ├── lots/
    │   │   │   └── page.tsx
    │   │   ├── sanitari/
    │   │   │   ├── page.tsx           ← Tractaments actius
    │   │   │   └── magatzem/
    │   │   │       └── page.tsx       ← Magatzem de medicaments
    │   │   ├── logistica/
    │   │   │   └── page.tsx
    │   │   ├── arxiu/
    │   │   │   └── page.tsx
    │   │   └── configuracio/
    │   │       ├── usuaris/
    │   │       │   └── page.tsx
    │   │       └── races/
    │   │           └── page.tsx
    │   │
    │   └── api/                       ← API Routes (backend, només servidor)
    │       ├── auth/
    │       │   ├── login/
    │       │   │   └── route.ts       ← POST /api/auth/login
    │       │   └── logout/
    │       │       └── route.ts       ← POST /api/auth/logout
    │       ├── animals/
    │       │   ├── route.ts           ← GET /api/animals · POST /api/animals
    │       │   └── [id]/
    │       │       └── route.ts       ← GET · PATCH · DELETE /api/animals/[id]
    │       ├── lots/
    │       │   └── route.ts
    │       ├── sanitari/
    │       │   ├── medicaments/
    │       │   │   └── route.ts
    │       │   └── tractaments/
    │       │       └── route.ts
    │       ├── logistica/
    │       │   ├── consums/
    │       │   │   └── route.ts
    │       │   └── magatzems/
    │       │       └── route.ts
    │       └── arxiu/
    │           └── route.ts
    │
    ├── lib/                           ← Lògica compartida (no és un component ni una ruta)
    │   ├── db/
    │   │   ├── client.ts              ← Pool de connexions PostgreSQL
    │   │   └── queries/               ← Funcions SQL per mòdul
    │   │       ├── animals.ts
    │   │       ├── sanitari.ts
    │   │       ├── logistica.ts
    │   │       └── arxiu.ts
    │   ├── auth/
    │   │   ├── jwt.ts                 ← Signar i verificar tokens JWT (jose)
    │   │   ├── password.ts            ← Hash i verificació de contrasenyes (bcryptjs)
    │   │   └── session.ts             ← Llegir/escriure la cookie de sessió
    │   └── validators/                ← Esquemes Zod per validar inputs
    │       ├── animals.ts
    │       └── auth.ts
    │
    ├── components/                    ← Components React reutilitzables
    │   ├── ui/                        ← Components Shadcn/ui (generats automàticament)
    │   ├── layout/
    │   │   ├── Sidebar.tsx
    │   │   └── Header.tsx
    │   ├── animals/
    │   │   ├── TaulaAnimals.tsx       ← Graella d'edició ràpida
    │   │   └── FitxaAnimal.tsx
    │   └── shared/
    │       ├── IndicadorSupressio.tsx ← Icona de bloqueig comercial
    │       └── CercadorRapid.tsx
    │
    ├── hooks/                         ← Custom React Hooks
    │   ├── useAnimals.ts
    │   └── useSession.ts
    │
    ├── types/                         ← Definicions de tipus TypeScript
    │   ├── api.ts                     ← Tipus de request/response de l'API
    │   ├── db.ts                      ← Tipus que reflecteixen les taules de la BD
    │   └── session.ts                 ← Tipus del payload JWT
    │
    └── middleware.ts                  ← Middleware global (protecció de rutes)
```

---

## 3. Variables d'Entorn

Fitxer `.env.local` (mai pujar a Git — afegir a `.gitignore`):

```bash
# Base de dades — Supabase connection string directa
# Obtenir a: Supabase Dashboard → Settings → Database → Connection string
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"

# JWT — clau secreta per signar els tokens
# Generar amb: openssl rand -base64 64
JWT_SECRET="clau_secreta_molt_llarga_i_aleatoria_min_32_chars"

# Durada dels tokens
JWT_ACCESS_EXPIRY="1h"
JWT_REFRESH_EXPIRY="30d"

# Cron Jobs — protegeix els endpoints de tasques programades (ex: purga login_attempts)
# Generar amb: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CRON_SECRET="clau_secreta_per_al_cron"

# Entorn
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Fitxer `.env.example` (SÍ pujar a Git — documenta quines variables calen):

```bash
DATABASE_URL=""
JWT_SECRET=""
JWT_ACCESS_EXPIRY="1h"
JWT_REFRESH_EXPIRY="30d"
CRON_SECRET=""
NODE_ENV="development"
NEXT_PUBLIC_APP_URL=""
```

> **Vercel:** Les variables d'entorn de producció es configuren a  
> `Vercel Dashboard → Project → Settings → Environment Variables`  
> Mai s'han d'escriure als fitxers de codi.  
> **Nota sobre `CRON_SECRET`:** Vercel injecta automàticament aquesta capçalera a les crides dels seus Cron Jobs si la variable d'entorn té exactament aquest nom — no cal configuració addicional a `vercel.json` per a l'autenticació.

---

## 4. Connexió a PostgreSQL

### 4.1. Pool de Connexions (`src/lib/db/client.ts`)

A Vercel Serverless, cada invocació pot crear una connexió nova. Per evitar exhaurir el pool de Supabase, cal usar el **Transaction Pooler de Supabase** (port 6543) i reutilitzar el pool entre invocacions quan sigui possible.

```typescript
// src/lib/db/client.ts
import { Pool } from 'pg'

// El pool es crea una sola vegada per instància serverless
// i es reutilitza entre peticions a la mateixa instància
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,          // Màxim de connexions per instància serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

export type TenantContext = {
  tenantSchema: string
  userId: number
  rol: 'Admin' | 'Veterinari' | 'Treballador'
}

/**
 * Executa una query dins del schema del tenant correcte.
 * Estableix search_path per a cada transacció — necessari en
 * entorn serverless on no hi ha sessió persistent.
 */
export async function queryTenant<T>(
  ctx: TenantContext,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await pool.connect()
  try {
    // Establir search_path al schema del tenant per a aquesta transacció
    await client.query(
      `SET LOCAL search_path TO ${client.escapeIdentifier(ctx.tenantSchema)}, public`
    )
    const result = await client.query<T>(sql, params)
    return result.rows
  } finally {
    client.release()
  }
}

/**
 * Executa una query al schema públic (tenants, users, audit_log).
 */
export async function queryPublic<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query<T>(sql, params)
    return result.rows
  } finally {
    client.release()
  }
}
```

> **Nota de seguretat:** `SET LOCAL search_path` afecta únicament la transacció actual, no la connexió sencera del pool. Això evita que una connexió reutilitzada del pool conservi el `search_path` d'un tenant anterior.

---

## 5. Flux d'Autenticació JWT Manual

### 5.1. Login

```
Client (navegador)
    │
    │ POST /api/auth/login
    │ Body: { email, password }
    │ (HTTPS obligatori)
    ▼
API Route: /api/auth/login
    │
    ├─ Validar input amb Zod (email format, password no buit)
    │
    ├─ SELECT * FROM public.users WHERE email = $1 AND actiu = TRUE
    │
    ├─ Verificar password amb bcryptjs.compare()
    │   └─ Si falla → 401 { error: "Credencials incorrectes" }
    │      (Mateix missatge per email no trobat i password incorrecte
    │       → evita enumeració d'usuaris)
    │
    ├─ Generar access_token (JWT, 1h):
    │   Payload: { sub: userId, tenantId, tenantSchema, rol, iat, exp }
    │
    ├─ Generar refresh_token (JWT, 30d):
    │   Payload: { sub: userId, type: "refresh", iat, exp }
    │
    ├─ UPDATE public.users SET darrer_acces = NOW() WHERE id = $1
    │
    ├─ INSERT INTO public.audit_log (accio: 'LOGIN', user_id, ip_origen)
    │
    └─ Response 200:
        Set-Cookie: access_token=...; HttpOnly; Secure; SameSite=Strict; Path=/
        Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth
        Body: { rol, nom }   ← Mínim necessari per al frontend
```

### 5.2. Protecció de Rutes (Middleware)

El fitxer `src/middleware.ts` s'executa a Vercel Edge abans de cada request:

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_ROUTES = ['/login', '/api/auth/login']
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutes públiques: deixar passar sense verificació
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Verificar access_token de la cookie
  const token = request.cookies.get('access_token')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    // Afegir el context del tenant a les capçaleres per a les API Routes
    const response = NextResponse.next()
    response.headers.set('x-user-id', String(payload.sub))
    response.headers.set('x-tenant-schema', payload.tenantSchema as string)
    response.headers.set('x-user-rol', payload.rol as string)
    return response
  } catch {
    // Token expirat o invàlid → redirigir al login
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### 5.3. Lectura del Context a les API Routes

```typescript
// Exemple: src/app/api/animals/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { queryTenant, TenantContext } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  // El middleware ja ha verificat el JWT i ha afegit les capçaleres
  const ctx: TenantContext = {
    userId:       Number(request.headers.get('x-user-id')),
    tenantSchema: request.headers.get('x-tenant-schema') ?? '',
    rol:          request.headers.get('x-user-rol') as TenantContext['rol'],
  }

  // Verificació de rol (exemple: Treballadors no poden accedir a l'arxiu)
  if (!ctx.tenantSchema) {
    return NextResponse.json({ error: 'No autoritzat' }, { status: 401 })
  }

  const animals = await queryTenant(ctx,
    `SELECT * FROM v_animals_actius ORDER BY crotal_id`,
  )

  return NextResponse.json({ animals })
}
```

### 5.4. Rate Limiting del Login

Per protegir el login contra atacs de força bruta, s'aplica un límit de **5 intents fallits en 15 minuts**, comprovat tant per **IP** com per **email** — el que es superi primer bloqueja l'intent.

**Emmagatzematge:** taula `public.login_attempts` (vegeu [`database/04_schema_login_attempts.sql`](../database/04_schema_login_attempts.sql)). No s'usa memòria en procés perquè Vercel Serverless no garanteix persistència entre invocacions ni entre instàncies.

```
Petició de login
      │
      ▼
[comprovarRateLimit(email, ip)]
      │
      ├─ Intents fallits per IP en 15 min >= 5?    → 429 Bloquejat (motiu: IP)
      ├─ Intents fallits per email en 15 min >= 5? → 429 Bloquejat (motiu: EMAIL)
      │
      ▼ (si no bloquejat)
[Validar credencials contra public.users]
      │
      ├─ Incorrecte → registrarIntent(exit=false) + audit_log('LOGIN_FAILED')
      │               → 401
      │
      └─ Correcte   → registrarIntent(exit=true)  + audit_log('LOGIN')
                      → Generar tokens + cookies
                      → 200
```

**Separació de responsabilitats (important per RGPD):**

| Taula | Propòsit | Retenció |
|-------|---------|---------|
| `public.login_attempts` | Mecanisme tècnic de rate limiting | **48 hores** (purga automàtica) |
| `public.audit_log` | Auditoria legal (`LOGIN`, `LOGIN_FAILED`, `LOGIN_BLOCKED`) | **5 anys** (ja documentat a `04_seguretat_i_rols.md`) |

Es tracta de dues responsabilitats independents: `login_attempts` no és un registre d'auditoria i no s'ha de conservar indefinidament (minimització de dades, Art. 5.1.c RGPD); `audit_log` sí és l'auditoria legal i ja té la seva política de retenció definida.

**Purga automàtica:** un Vercel Cron Job (`vercel.json`) crida diàriament `/api/cron/purge-login-attempts`, protegit amb `CRON_SECRET`, que executa `public.fn_purgar_login_attempts()` per eliminar els registres de més de 48 hores.

### 5.5. Refresh Automàtic del Token en Segon Pla

Per evitar que l'usuari hagi de tornar a fer login cada hora (caducitat de l'access token), el sistema refresca el token **automàticament i en segon pla**, sense interrompre la feina de l'usuari a peu de granja.

**Flux:**

```
1. El middleware verifica el JWT a cada petició.
   Si al token li queden < 5 minuts abans de caducar,
   afegeix la capçalera: x-token-refresh-suggested: true

2. Al client, useAutoRefresh() intercepta totes les crides fetch().
   Si detecta aquesta capçalera a una resposta:
     → Crida POST /api/auth/refresh en segon pla
     → No bloqueja ni interromp la petició original

3. POST /api/auth/refresh:
     · Verifica el refresh_token (cookie HttpOnly, 30 dies)
     · Comprova que l'usuari i el tenant segueixen actius
     · ROTACIÓ: emet un access_token I un refresh_token nous
     · Desa els dos a cookies (substitueixen els anteriors)

4. Si el refresh_token també ha caducat (usuari inactiu > 30 dies):
     → 401 des de /api/auth/refresh
     → useAutoRefresh() redirigeix a /login?motiu=sessio_expirada
```

**Per què rotació de refresh token:** cada vegada que es fa servir un refresh token per obtenir un access token nou, se'n genera un altre per substituir-lo. Això limita la finestra d'ús d'un refresh token robat: un cop usat legítimament pel propietari, qualsevol còpia robada anterior queda obsoleta en la següent renovació natural.

**Fitxers implicats:**

| Fitxer | Responsabilitat |
|--------|-----------------|
| `src/middleware.ts` | Detecta caducitat propera i afegeix la capçalera de senyal |
| `src/hooks/useAutoRefresh.ts` | Intercepta `fetch()` al client i llança el refresh |
| `src/app/api/auth/refresh/route.ts` | Verifica, rota i emet els nous tokens |
| `src/app/(app)/layout.tsx` | Munta `useAutoRefresh()` a l'àrea protegida |

---

## 6. Control d'Accés per Rol a les API Routes

Cada endpoint verifica que el rol de l'usuari tingui permís per a l'operació:

```typescript
// src/lib/auth/roles.ts

export type Rol = 'Admin' | 'Veterinari' | 'Treballador'

// Matriu de permisos per endpoint i mètode HTTP
const PERMISOS: Record<string, Rol[]> = {
  'GET /api/animals':              ['Admin', 'Veterinari', 'Treballador'],
  'POST /api/animals':             ['Admin'],
  'POST /api/animals/bulk-import': ['Admin'],
  'GET /api/sanitari/medicaments': ['Admin', 'Veterinari'],
  'POST /api/sanitari/tractaments':['Admin', 'Veterinari'],
  'POST /api/logistica/consums':   ['Admin', 'Treballador'],
  'GET /api/arxiu':                ['Admin', 'Veterinari'],
  'POST /api/arxiu':               ['Admin'],
  // ... (veure doc 04_seguretat_i_rols.md per la matriu completa)
}

export function tePermis(endpoint: string, rol: Rol): boolean {
  const rols = PERMISOS[endpoint]
  if (!rols) return false
  return rols.includes(rol)
}
```

---

## 7. Seguretat — Mesures Implementades

| Mesura | Implementació |
|--------|-------------|
| **Cookies HttpOnly** | Els tokens JWT mai accessibles des de JavaScript del navegador |
| **Cookies Secure** | Només s'envien per HTTPS (Vercel sempre usa HTTPS) |
| **SameSite=Strict** | Protecció contra CSRF |
| **search_path per transacció** | `SET LOCAL` evita contaminació entre tenants al pool |
| **Validació d'inputs** | Zod a tots els endpoints abans de tocar la BD |
| **Queries parametritzades** | `pg` amb `$1, $2...` — mai concatenació de strings SQL |
| **Missatges d'error genèrics** | Login retorna sempre el mateix missatge (evita enumeració) |
| **Rate limiting login** | Màxim 5 intents per IP per 15 minuts (via middleware) |
| **Capçaleres de seguretat** | Configurades a `next.config.ts` (CSP, HSTS, X-Frame-Options...) |
| **Variables d'entorn** | Secrets mai al codi font, sempre a Vercel Environment Variables |
| **RLS a la BD** | Bloqueig total d'accés directe a Supabase com a segona capa |

### 7.1. Capçaleres de Seguretat HTTP (`next.config.ts`)

```typescript
// next.config.ts
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',  value: 'on' },
  { key: 'X-Frame-Options',         value: 'DENY' },
  { key: 'X-Content-Type-Options',  value: 'nosniff' },
  { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',      value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe necessari per Next.js
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  },
]

const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
```

---

## 8. RGPD / LOPDGDD — Consideracions Frontend

| Requisit | Implementació |
|---------|-------------|
| **Consentiment** | No s'usa cap cookie de seguiment ni analítica. Únicament cookies de sessió tècniques (exemptes de consentiment) |
| **Dret d'accés** | Panell d'Admin amb exportació de dades pròpies del tenant |
| **Dret a l'oblit** | `DROP SCHEMA tenant_XXXXX CASCADE` (documentat a `03_multitenancy.md`) |
| **Minimització de dades** | El JWT conté únicament el mínim necessari: `userId`, `tenantSchema`, `rol` |
| **Seguretat de la transmissió** | HTTPS obligatori a Vercel (TLS 1.3) |
| **Registre d'activitat** | `public.audit_log` registra totes les accions crítiques |
| **Notificació de bretxes** | Procés documentat a `05_backup_i_dr.md` (72h a l'AEPD) |

---

## 9. Dependències del Projecte

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "jose": "^5.0.0",
    "bcryptjs": "^2.4.3",
    "pg": "^8.11.0",
    "zod": "^3.22.0",
    "lucide-react": "^0.469.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/pg": "^8.11.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## 11. Sidebar i Navegació per Rol

### 11.1. Arquitectura de Components

```
src/app/(app)/layout.tsx          ← Server Component: llegeix sessió (JWT),
                                      resol nom d'usuari, redirigeix si no n'hi ha
        │
        ▼
src/components/layout/AppShell.tsx ← Client Component: gestiona estat
                                      obert/tancat del Sidebar en mòbil,
                                      activa useAutoRefresh()
        │
        ├── src/components/layout/Sidebar.tsx  ← Navegació + peu (nom/rol/logout)
        └── src/components/layout/Header.tsx   ← Només mòbil: botó hamburguesa
```

### 11.2. Comportament Responsive

| Breakpoint | Comportament |
|-----------|-------------|
| `< md` (mòbil/tauleta petita) | Sidebar amagat per defecte, s'obre com a overlay complet sobre el contingut en prémer el botó hamburguesa del Header |
| `>= md` (escriptori/tauleta gran) | Sidebar fix, sempre visible, el contingut s'ajusta al costat. El Header mòbil no es renderitza |

### 11.3. Navegació Filtrada per Rol

La visibilitat de cada secció es defineix a **`src/lib/navigation/menuItems.ts`**, que actua com a font de veritat única per a l'estructura del menú. Cada element declara `rolsPermesos: Rol[]`, i `getMenuForRol(rol)` retorna només els elements visibles per a l'usuari actual.

**Important:** aquest filtre és únicament visual/UX. La protecció real de cada ruta la fa el middleware (`src/middleware.ts`) i la comprovació de rol a cada API Route (`src/lib/auth/roles.ts`, documentat a la secció 6). Un usuari que navegui manualment a una URL no autoritzada per al seu rol continua sent bloquejat pel backend, independentment del que mostri el Sidebar.

Matriu de visibilitat actual (ha de coincidir amb `docs/04_seguretat_i_rols.md`, secció 2.2):

| Secció | Admin | Veterinari | Treballador |
|--------|-------|-----------|------------|
| Dashboard | ✅ | ✅ | ✅ |
| Animals | ✅ | ✅ | ✅ |
| Lots i Corts | ✅ | ✅ | ✅ |
| Sanitari | ✅ | ✅ | ❌ |
| Logística | ✅ | ❌ | ✅ |
| Arxiu | ✅ | ✅ | ❌ |
| Configuració | ✅ | ❌ | ❌ |

---

## 12. Primers Passos per Iniciar el Projecte

```bash
# 1. Crear el projecte Next.js amb TypeScript i Tailwind
npx create-next-app@latest gestio-ramadera \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*"

cd gestio-ramadera

# 2. Instal·lar les dependències del projecte
npm install jose bcryptjs pg zod
npm install -D @types/bcryptjs @types/pg

# 3. Instal·lar Shadcn/ui (inicialització interactiva)
npx shadcn@latest init

# 4. Afegir els primers components Shadcn necessaris
npx shadcn@latest add table button input form dialog badge

# 5. Crear el fitxer .env.local amb les variables (vegeu secció 3)
# 6. Connectar el repositori a Vercel
# 7. Configurar les variables d'entorn a Vercel Dashboard
```
