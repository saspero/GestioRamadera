-- ================================================================
-- GESTIÓ RAMADERA BOVINA — ROW LEVEL SECURITY (RLS)
-- Versió: 1.0.0 | Juny 2026
-- Motor: PostgreSQL 16+ (Supabase)
-- ================================================================
-- Activa RLS a totes les taules del schema tenant sense definir
-- cap política explícita. Efecte:
--
--   · Rol anon / authenticated de Supabase → BLOCAT completament
--   · Rol postgres (connexió directa del backend) → NO afectat
--     (els superusuaris i owners ignoren RLS per defecte a PostgreSQL)
--
-- Això satisfà l'Advisor de seguretat de Supabase i garanteix que
-- cap accés via API REST de Supabase (PostgREST) pugui llegir ni
-- escriure dades, fins i tot si les claus arribessin a estar exposades.
--
-- ⚠️ EXECUTAR DESPRÉS DE 02_schema_tenant_template.sql
-- ⚠️ Cal ajustar "tenant_00001" si el tenant té un altre nom.
-- ================================================================

SET search_path TO tenant_00001, public;

-- ----------------------------------------------------------------
-- Infraestructura física
-- ----------------------------------------------------------------
ALTER TABLE ubicacions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones_infraestructura   ENABLE ROW LEVEL SECURITY;
ALTER TABLE corts                   ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Emmagatzematge d'aliments
-- ----------------------------------------------------------------
ALTER TABLE sitges                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE magatzems_farratge      ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Animals
-- ----------------------------------------------------------------
ALTER TABLE races_cataleg           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estat_salut   ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribucio_animals     ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Registres de producció
-- ----------------------------------------------------------------
ALTER TABLE registre_pes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE registre_llet           ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Logística d'alimentació
-- ----------------------------------------------------------------
ALTER TABLE consums_pinso_nau       ENABLE ROW LEVEL SECURITY;
ALTER TABLE moviments_farratge      ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Mòdul sanitari
-- ----------------------------------------------------------------
ALTER TABLE medicaments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tractaments             ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Baixes i configuració
-- ----------------------------------------------------------------
ALTER TABLE baixes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracio_general    ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets_llet_pols       ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- Verificació: mostra totes les taules amb RLS activat
-- ================================================================
SELECT
    schemaname  AS schema,
    tablename   AS taula,
    rowsecurity AS rls_actiu
FROM pg_tables
WHERE schemaname = 'tenant_00001'
ORDER BY tablename;

-- ================================================================
-- RESULTAT ESPERAT: rls_actiu = TRUE per a les 19 taules
-- ================================================================
