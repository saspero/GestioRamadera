-- ================================================================
-- GESTIÓ RAMADERA BOVINA — RLS SCHEMA PÚBLIC
-- Versió: 1.0.0 | Juny 2026
-- Motor: PostgreSQL 16+ (Supabase)
-- ================================================================
-- Activa RLS a les tres taules del schema públic sense definir
-- cap política explícita. Efecte idèntic al del schema tenant:
--
--   · Rol anon / authenticated de Supabase → BLOCAT completament
--   · Rol postgres (connexió directa del backend) → NO afectat
--
-- ⚠️ EXECUTAR DESPRÉS DE 01_schema_public.sql
-- ⚠️ S'executa UNA SOLA VEGADA (igual que el schema públic).
-- ================================================================

ALTER TABLE public.tenants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- Verificació: mostra les tres taules amb RLS activat
-- ================================================================
SELECT
    schemaname  AS schema,
    tablename   AS taula,
    rowsecurity AS rls_actiu
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('tenants', 'users', 'audit_log')
ORDER BY tablename;

-- ================================================================
-- RESULTAT ESPERAT: rls_actiu = TRUE per a les 3 taules
-- ================================================================
