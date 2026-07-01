-- ================================================================
-- GESTIÓ RAMADERA BOVINA — SCHEMA PÚBLIC
-- Versió: 1.1.0 | Juny 2026
-- Motor: PostgreSQL 16+ (Supabase)
-- ================================================================
-- ⚠️ EXECUTAR NOMÉS UN COP, en donar d'alta la plataforma.
-- Conté les taules GLOBALS compartides per tots els tenants:
--   · public.tenants    → llistat de totes les granges clients
--   · public.users      → tots els usuaris de totes les granges
--   · public.audit_log  → registre d'auditoria transversal
--   · fn_set_updated_at() → funció reutilitzada pels triggers
--
-- Prerequisit: extensió pg_trgm activada (ja fet ✅)
-- Següents passos:
--   1. Executar 03_rls_public.sql per activar RLS a aquest schema.
--   2. Executar 02_schema_tenant_template.sql per crear el primer tenant.
-- ================================================================

-- ================================================================
-- BLOC 1 — SCHEMA PÚBLIC
-- ================================================================

-- Tipus enumerats globals
CREATE TYPE public.tipus_explotacio_enum AS ENUM ('Llet', 'Engreix', 'Extensiu');
CREATE TYPE public.rol_usuari_enum       AS ENUM ('Admin', 'Veterinari', 'Treballador');

-- ----------------------------------------------------------------
-- Taula: tenants
-- ----------------------------------------------------------------
CREATE TABLE public.tenants (
    id               SERIAL PRIMARY KEY,
    nom_empresa      VARCHAR(255) NOT NULL,
    tipus_explotacio public.tipus_explotacio_enum NOT NULL,
    schema_name      VARCHAR(63)  NOT NULL UNIQUE,
    actiu            BOOLEAN      NOT NULL DEFAULT TRUE,
    creat_el         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualitzat_el   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.tenants IS
    'Registre de clients (granges) de la plataforma SaaS. Cada fila correspon a un schema PostgreSQL independent.';
COMMENT ON COLUMN public.tenants.schema_name IS
    'Nom del schema PostgreSQL per a aquest tenant. Format: tenant_XXXXX. Màxim 63 caràcters (límit PostgreSQL).';

-- ----------------------------------------------------------------
-- Taula: users
-- ----------------------------------------------------------------
CREATE TABLE public.users (
    id             SERIAL PRIMARY KEY,
    tenant_id      INTEGER     NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    nom            VARCHAR(255) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    rol            public.rol_usuari_enum NOT NULL,
    actiu          BOOLEAN     NOT NULL DEFAULT TRUE,
    darrer_acces   TIMESTAMPTZ,
    creat_el       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_users_email     ON public.users(email);

COMMENT ON TABLE  public.users IS
    'Usuaris de la plataforma. Cada usuari pertany a exactament un tenant.';
COMMENT ON COLUMN public.users.password_hash IS
    'Hash de la contrasenya. Obligatori bcrypt amb cost factor >= 12. Mai emmagatzemar la contrasenya en clar.';
COMMENT ON COLUMN public.users.rol IS
    'Admin: accés total. Veterinari: mòdul sanitari i animals. Treballador: registre diari.';

-- ----------------------------------------------------------------
-- Taula: audit_log (transversal a tots els tenants)
-- ----------------------------------------------------------------
CREATE TABLE public.audit_log (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      INTEGER     REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id        INTEGER     REFERENCES public.users(id)   ON DELETE SET NULL,
    accio          VARCHAR(100) NOT NULL,
    taula_afectada VARCHAR(100),
    registre_id    INTEGER,
    dades_json     JSONB,
    ip_origen      INET,
    creat_el       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON public.audit_log(tenant_id, creat_el DESC);
CREATE INDEX idx_audit_user   ON public.audit_log(user_id,   creat_el DESC);

COMMENT ON TABLE public.audit_log IS
    'Registre immutable d''accions crítiques. Retenció mínima: 5 anys. No s''actualitza mai, només INSERT.';


-- ================================================================
-- BLOC 2 — FUNCIÓ SHARED: updated_at automàtic
-- Reutilitzada per totes les taules amb columna actualitzat_el
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualitzat_el = NOW();
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_set_updated_at() IS
    'Funció compartida per tots els triggers updated_at. Actualitza automàticament la columna actualitzat_el en cada UPDATE.';


