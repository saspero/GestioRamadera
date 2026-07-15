-- ================================================================
-- MIGRACIÓ: Catàleg de tipus de pinso (amb components) +
--           sitges.tipus_pinso passa de text lliure a FK
-- Versió: 1.1.0 | Juliol 2026 (corregeix ordre DROP VIEW/columna + RLS)
-- ================================================================
-- ⚠️ EXECUTAR AL SQL EDITOR DE SUPABASE, dins del schema del tenant
--    (ajustar "tenant_00001" si el tenant té un altre nom).
--
-- Correccions respecte a la v1.0.0:
--   1. DROP VIEW ara va ABANS de l'ALTER TABLE que elimina la
--      columna (la vista en depenia — error 2BP01 a la v1.0.0).
--   2. Afegit ENABLE ROW LEVEL SECURITY a les dues taules noves,
--      seguint el mateix principi de seguretat que la resta del
--      projecte ("totes les taules tenen RLS activat sense
--      polítiques").
--
-- Prerequisit: la taula sitges ha d'estar buida.
-- ================================================================

SET search_path TO tenant_00001, public;

-- ----------------------------------------------------------------
-- Pas 0: Neteja preventiva — per si un intent anterior d'aquest
-- script (v1.0.0, que va fallar) hagués deixat alguna part aplicada
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS component_pinso CASCADE;
DROP TABLE IF EXISTS tipus_pinso_cataleg CASCADE;
ALTER TABLE sitges DROP COLUMN IF EXISTS tipus_pinso_id;

-- ----------------------------------------------------------------
-- Pas 1: Verificació de seguretat — atura si hi ha sitges
-- ----------------------------------------------------------------
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM sitges;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'La taula sitges conté % registres. Aquesta migració canvia el tipus de la columna tipus_pinso i esborraria el seu contingut actual. Atura''t i fes una migració de dades primer.', v_count;
    END IF;
END $$;

-- ----------------------------------------------------------------
-- Pas 2: Catàleg de tipus de pinso
-- ----------------------------------------------------------------
CREATE TABLE tipus_pinso_cataleg (
    id       SERIAL PRIMARY KEY,
    codi     VARCHAR(50)  NOT NULL UNIQUE,
    nom      VARCHAR(255) NOT NULL,
    creat_el TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE tipus_pinso_cataleg ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE tipus_pinso_cataleg IS
    'Catàleg de tipus de pinso disponibles al tenant, amb la seva composició a component_pinso.';
COMMENT ON COLUMN tipus_pinso_cataleg.codi IS
    'Codi curt identificatiu del tipus de pinso (Ex: "PI-ENGREIX-18"). Únic dins del tenant.';

-- ----------------------------------------------------------------
-- Pas 3: Components de cada tipus de pinso
-- ----------------------------------------------------------------
CREATE TABLE component_pinso (
    id             SERIAL PRIMARY KEY,
    tipus_pinso_id INTEGER      NOT NULL REFERENCES tipus_pinso_cataleg(id) ON DELETE CASCADE,
    nom_component  VARCHAR(255) NOT NULL,
    percentatge    DECIMAL(5,2) NOT NULL,
    CONSTRAINT component_percentatge_valid CHECK (percentatge > 0 AND percentatge <= 100)
);

ALTER TABLE component_pinso ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_component_pinso_tipus ON component_pinso(tipus_pinso_id);

COMMENT ON TABLE component_pinso IS
    'Ingredients que composen un tipus de pinso del catàleg, amb el seu percentatge. La suma dels percentatges d''un mateix tipus_pinso_id s''hauria d''aproximar a 100 — es valida a la capa d''aplicació, no amb un CHECK de BD (restricció multi-fila).';

-- ----------------------------------------------------------------
-- Pas 4: Eliminar la vista que depèn de sitges.tipus_pinso
-- (HA D'ANAR ABANS de l'ALTER TABLE — aquest era el bug de la v1.0.0)
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_estoc_magatzems;

-- ----------------------------------------------------------------
-- Pas 5: sitges.tipus_pinso (text lliure) -> tipus_pinso_id (FK)
-- ----------------------------------------------------------------
ALTER TABLE sitges DROP COLUMN IF EXISTS tipus_pinso;
ALTER TABLE sitges ADD COLUMN tipus_pinso_id INTEGER REFERENCES tipus_pinso_cataleg(id) ON DELETE RESTRICT;

COMMENT ON COLUMN sitges.tipus_pinso_id IS
    'Tipus de pinso emmagatzemat, referenciant tipus_pinso_cataleg. ON DELETE RESTRICT: no es pot eliminar un tipus de pinso del catàleg mentre hi hagi sitges que l''utilitzin.';

-- ----------------------------------------------------------------
-- Pas 6: Recrear v_estoc_magatzems (ara amb JOIN al catàleg de pinso)
-- ----------------------------------------------------------------
CREATE VIEW v_estoc_magatzems AS
SELECT
    'sitja'              AS tipus,
    s.id,
    s.nom,
    tp.nom               AS tipus_producte,
    s.estoc_actual_kg    AS estoc_actual,
    'kg'                 AS unitat,
    COALESCE(s.estoc_minim_kg, cg.estoc_minim_default_kg) AS llindar_alerta,
    s.estat,
    CASE
        WHEN s.estoc_actual_kg = 0
             THEN 'Esgotat'
        WHEN s.estoc_actual_kg <= COALESCE(s.estoc_minim_kg, cg.estoc_minim_default_kg)
             THEN 'Baix'
        ELSE 'Normal'
    END AS estat_estoc
FROM sitges s
LEFT JOIN tipus_pinso_cataleg tp ON tp.id = s.tipus_pinso_id
CROSS JOIN configuracio_general cg
WHERE s.estat = 'Actiu'

UNION ALL

SELECT
    'magatzem'           AS tipus,
    mf.id,
    z.nom                AS nom,
    mf.tipus_farratge    AS tipus_producte,
    mf.estoc_actual_tones AS estoc_actual,
    'tones'              AS unitat,
    COALESCE(mf.estoc_minim_tones, cg.estoc_minim_default_tones) AS llindar_alerta,
    mf.estat,
    CASE
        WHEN mf.estoc_actual_tones = 0
             THEN 'Esgotat'
        WHEN mf.estoc_actual_tones <= COALESCE(mf.estoc_minim_tones, cg.estoc_minim_default_tones)
             THEN 'Baix'
        ELSE 'Normal'
    END AS estat_estoc
FROM magatzems_farratge mf
JOIN zones_infraestructura z ON z.id = mf.zona_id
CROSS JOIN configuracio_general cg
WHERE mf.estat = 'Actiu';

-- Restaurar search_path per defecte
SET search_path TO public;

-- ================================================================
-- Verificació
-- ================================================================
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'tenant_00001' AND table_name = 'sitges'
ORDER BY ordinal_position;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'tenant_00001' AND tablename IN ('tipus_pinso_cataleg', 'component_pinso');

-- RESULTAT ESPERAT:
--   1a consulta: columna "tipus_pinso_id" (integer), CAP "tipus_pinso" (text)
--   2a consulta: rowsecurity = true a les dues files
-- ================================================================
