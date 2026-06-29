# 04 — Seguretat i Control d'Accés per Rols

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026

---

## 1. Principis de Seguretat

- **Mínim privilegi:** Cada rol té accés únicament a les operacions que necessita per a la seva funció.
- **Defensa en profunditat:** L'accés es controla a tres nivells: schema de BD, RLS, i capa d'aplicació (API).
- **Autenticació robusta:** JWT de curta durada amb refresh tokens.
- **Auditoria:** Totes les operacions crítiques deixen rastre identificable.

---

## 2. Rols d'Usuari

### 2.1. Definició de Rols

| Rol | Perfil Típic | Descripció |
|-----|-------------|-----------|
| **Admin** | Propietari de la granja, cap d'explotació | Accés complet a tots els mòduls i a la configuració del tenant |
| **Veterinari** | Veterinari extern o de la granja | Accés al mòdul sanitari i consulta de fitxes d'animals |
| **Treballador** | Peó, operari diari | Registre de dades del dia: pesos, consums, estat de salut bàsic |

### 2.2. Matriu de Permisos per Mòdul

> **Llegenda:** ✅ Accés total · 📖 Només lectura · ✏️ Lectura + creació (sense editar/esborrar) · ❌ Sense accés

| Mòdul / Acció | Admin | Veterinari | Treballador |
|---------------|-------|-----------|------------|
| **Dashboard** | ✅ | 📖 | 📖 (limitat) |
| **Animals — Llistat actius** | ✅ | 📖 | ✏️ (pes, llet, estat salut) |
| **Animals — Alta individual** | ✅ | ❌ | ❌ |
| **Animals — Alta massiva CSV** | ✅ | ❌ | ❌ |
| **Animals — Baixa (venda/mort)** | ✅ | ❌ | ❌ |
| **Lots i Corts — Consulta** | ✅ | 📖 | 📖 |
| **Lots i Corts — Gestió (moure, dividir)** | ✅ | ❌ | ❌ |
| **Mòdul Sanitari — Tractaments** | ✅ | ✅ | ❌ |
| **Mòdul Sanitari — Magatzem fàrmacs** | ✅ | ✅ | ❌ |
| **Mòdul Sanitari — Càrrega CSV fàrmacs** | ✅ | ✅ | ❌ |
| **Logística — Consums massius** | ✅ | ❌ | ✅ |
| **Logística — Estoc magatzems** | ✅ | ❌ | 📖 |
| **Arxiu / Històric** | ✅ | 📖 | ❌ |
| **Vedells Mamons — Registre lactància** | ✅ | ❌ | ✅ |
| **Vedells Mamons — Configuració presets** | ✅ | ❌ | ❌ |
| **Configuració — Catàleg de races** | ✅ | ❌ | ❌ |
| **Configuració — Gestió d'usuaris** | ✅ | ❌ | ❌ |
| **Configuració — Paràmetres generals** | ✅ | ❌ | ❌ |

---

## 3. Autenticació

### 3.1. Flux d'Autenticació JWT

```
Client                        API                          BD (public)
  │                            │                               │
  │── POST /api/v1/auth/login ─►│                               │
  │   { email, password }       │── SELECT users WHERE email ──►│
  │                            │◄── { user, tenant, rol } ──────│
  │                            │                               │
  │                            │  [Valida bcrypt password_hash] │
  │                            │  [Genera JWT + Refresh Token]  │
  │                            │                               │
  │◄── 200 { access_token,     │                               │
  │          refresh_token } ──│                               │
  │                            │                               │
  │── GET /api/v1/animals ─────►│                               │
  │   Authorization: Bearer... │  [Valida JWT]                 │
  │                            │  [Extreu tenant_id, rol]      │
  │                            │── SET search_path TO ─────────►│
  │                            │   tenant_00001, public        │
  │◄── 200 { animals: [...] } ─│◄── [ ResultSet ] ─────────────│
```

### 3.2. Estructura del JWT

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "42",
    "tenant_id": "1",
    "tenant_schema": "tenant_00001",
    "rol": "Treballador",
    "iat": 1719000000,
    "exp": 1719003600
  }
}
```

> **Durada tokens:**
> - `access_token`: **1 hora** (operativa a peu de granja)
> - `refresh_token`: **30 dies** (renovat en cada ús actiu)

### 3.3. Renovació de Token

```
Client                        API
  │                            │
  │── POST /api/v1/auth/refresh►│
  │   { refresh_token }         │  [Valida refresh_token]
  │                            │  [Comprova que l'usuari segueix actiu]
  │◄── 200 { access_token,     │  [Genera nous tokens]
  │          refresh_token } ──│  [Invalida el refresh_token anterior]
```

### 3.4. Gestió de Contrasenyes

- Emmagatzematge: **bcrypt** amb cost factor **>= 12**
- Longitud mínima: **10 caràcters**
- Sense restriccions de composició (evitar patrons previsibles)
- Restabliment: per correu electrònic amb token d'un sol ús (TTL: 1 hora)

---

## 4. Autorització a Nivell d'API

### 4.1. Middleware de Verificació de Rol

Cada endpoint de l'API declara els rols permesos. El middleware intercepta el request i verifica:

1. Presència i validesa del JWT
2. Que el rol de l'usuari estigui autoritzat per a l'endpoint
3. Que el tenant de l'usuari coincideixi amb els recursos sol·licitats

```
Exemple de decoradors per endpoint (pseudocodi):

@requires_auth
@requires_rol(['Admin'])
POST /api/v1/animals/bulk-import

@requires_auth
@requires_rol(['Admin', 'Veterinari'])
POST /api/v1/medicaments/

@requires_auth
@requires_rol(['Admin', 'Treballador'])
POST /api/v1/registre-pes/
```

### 4.2. Respostes d'Error d'Autorització

| Situació | Codi HTTP | Resposta |
|----------|----------|---------|
| Sense token | 401 | `{ "error": "Token d'autenticació requerit" }` |
| Token expirat | 401 | `{ "error": "Token expirat", "code": "TOKEN_EXPIRED" }` |
| Token invàlid | 401 | `{ "error": "Token invàlid" }` |
| Rol insuficient | 403 | `{ "error": "Sense permisos per a aquesta operació" }` |

---

## 5. Seguretat de les Comunicacions

### 5.1. HTTPS Obligatori

- Tot el tràfic sota **TLS 1.3** (mínim TLS 1.2)
- Redirect automàtic de HTTP a HTTPS
- **HSTS** activat: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- Certificats: Let's Encrypt amb renovació automàtica

### 5.2. Capçaleres de Seguretat HTTP

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### 5.3. Protecció contra Atacs Comuns

| Atac | Mesura |
|------|--------|
| **Injecció SQL** | Queries parametritzades (mai concatenació de strings) |
| **Força bruta login** | Rate limiting: màxim 5 intents per IP per 15 minuts |
| **CSRF** | Tokens CSRF per a formularis; APIs REST usen JWT (immune per disseny) |
| **XSS** | CSP estricta + sanitització d'inputs al backend |
| **Exposició de dades** | Cap dada de tenant en URLs; sempre body o capçaleres |

---

## 6. Auditoria d'Accions Crítiques

Les següents accions generen un registre d'auditoria immutable:

| Acció | Dades registrades |
|-------|------------------|
| Login / Logout | Usuari, IP, timestamp, èxit/error |
| Alta/Baixa d'animals | Usuari, animal_id, timestamp, rol |
| Aplicació de tractaments | Usuari, animal_id, medicament, dosi, timestamp |
| Baixa per mort | Usuari, animal_id, causa, codi recollida, timestamp |
| Baixa per venda | Usuari, animal_id, comprador, pes, preu, timestamp |
| Càrrega de CSV | Usuari, tipus (animals/fàrmacs), nº registres, timestamp |
| Canvi de contrasenya | Usuari, timestamp, IP |
| Creació/eliminació d'usuaris | Admin, usuari afectat, timestamp |

```sql
-- Taula d'auditoria al schema públic (transversal a tots els tenants)
CREATE TABLE public.audit_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       INTEGER REFERENCES public.tenants(id),
    user_id         INTEGER REFERENCES public.users(id),
    accio           VARCHAR(100) NOT NULL,
    taula_afectada  VARCHAR(100),
    registre_id     INTEGER,
    dades_json      JSONB,
    ip_origen       INET,
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON public.audit_log(tenant_id, creat_el DESC);
CREATE INDEX idx_audit_user ON public.audit_log(user_id, creat_el DESC);
```

> **Retenció:** Els logs d'auditoria es conserven un mínim de **5 anys** per compliment legal (normativa sectorial agrícola i RGPD).
