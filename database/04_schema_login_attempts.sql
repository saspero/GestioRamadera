-- ================================================================
-- GESTIÓ RAMADERA BOVINA — TAULA DE RATE LIMITING (LOGIN)
-- Versió: 1.0.0 | Juny 2026
-- Motor: PostgreSQL 16+ (Supabase)
-- ================================================================
-- ⚠️ EXECUTAR UN COP, al schema public (després de 01_schema_public.sql)
--
-- Propòsit: mecanisme TÈCNIC de rate limiting per al login.
-- NO és un registre d'auditoria legal — per això té purga automàtica.
-- L'auditoria legal (retenció 5 anys) viu a public.audit_log amb
-- l'esdeveniment LOGIN_FAILED (veure 01_schema_public.sql).
--
-- Política de retenció: purga automàtica de registres > 48h.
-- Base legal: minimització de dades (Art. 5.1.c RGPD) — la finalitat
-- (detectar força bruta en finestres de 15 min) no requereix
-- conservació més enllà d'un marge de seguretat curt.
-- ================================================================

CREATE TABLE public.login_attempts (
    id             BIGSERIAL PRIMARY KEY,
    email          VARCHAR(255) NOT NULL,
    ip_origen      INET         NOT NULL,
    exit           BOOLEAN      NOT NULL,
    creat_el       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índexs per a les dues comprovacions (per email i per IP) en finestra de temps
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email, creat_el DESC);
CREATE INDEX idx_login_attempts_ip    ON public.login_attempts(ip_origen, creat_el DESC);

-- Índex per a la purga eficient
CREATE INDEX idx_login_attempts_creat_el ON public.login_attempts(creat_el);

COMMENT ON TABLE public.login_attempts IS
    'Mecanisme tècnic de rate limiting per al login. Vida curta (purga >48h). NO és el registre d''auditoria legal — vegeu public.audit_log per a LOGIN_FAILED amb retenció 5 anys.';
COMMENT ON COLUMN public.login_attempts.email IS
    'Email tal com es va introduir a l''intent (encara que no existeixi com a usuari).';

-- ----------------------------------------------------------------
-- Funció de purga: elimina intents de més de 48 hores
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_purgar_login_attempts()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_esborrats INTEGER;
BEGIN
    DELETE FROM public.login_attempts
    WHERE creat_el < NOW() - INTERVAL '48 hours';

    GET DIAGNOSTICS v_esborrats = ROW_COUNT;
    RETURN v_esborrats;
END;
$$;

COMMENT ON FUNCTION public.fn_purgar_login_attempts() IS
    'Elimina els intents de login de més de 48 hores. Cridar periòdicament (veure secció Programació a la documentació). Retorna el nombre de files esborrades.';

-- ================================================================
-- PROGRAMACIÓ DE LA PURGA
-- ================================================================
-- Supabase no inclou pg_cron activat per defecte als plans base.
-- Dues opcions equivalents (triar-ne UNA):
--
-- OPCIÓ A (recomanada, sense dependències de BD):
--   Cron job extern que crida un endpoint /api/cron/purge-login-attempts
--   Vercel Cron Jobs (vercel.json) executa'l 1 cop/dia.
--   Aquest endpoint fa: SELECT public.fn_purgar_login_attempts();
--
-- OPCIÓ B (si pg_cron està disponible al pla de Supabase):
--   SELECT cron.schedule(
--     'purgar_login_attempts_diari',
--     '0 3 * * *',  -- cada dia a les 03:00
--     $$SELECT public.fn_purgar_login_attempts();$$
--   );
--
-- Aquest projecte usa l'OPCIÓ A — veure src/app/api/cron/purge-login-attempts/route.ts
-- ================================================================
