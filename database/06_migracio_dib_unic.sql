-- ================================================================
-- MIGRACIÓ: Fusionar crotal_id + dib en un únic camp "dib"
-- Versió: 1.0.0 | Juliol 2026
-- ================================================================
-- ⚠️ EXECUTAR AL SQL EDITOR DE SUPABASE, dins del schema del tenant
--    (ajustar "tenant_00001" si el tenant té un altre nom).
--
-- Motiu: el DIB (Document d'Identificació Bovina) i el crotal físic
-- a l'orella són LA MATEIXA DADA (el crotal és la representació
-- física del mateix número que consta al document DIB). Mantenir-los
-- com a dues columnes separades era redundant i obria la porta a
-- inconsistències. A partir d'ara, "dib" és l'únic identificador
-- oficial de l'animal.
--
-- Prerequisit: la taula animals ha d'estar buida (sense animals
-- reals encara). Si no ho està, aquest script NO s'ha d'executar
-- tal qual — caldria una migració de dades en comptes d'un DROP.
-- ================================================================

SET search_path TO tenant_00001, public;

-- ----------------------------------------------------------------
-- Pas 1: Verificació de seguretat — atura si hi ha animals
-- ----------------------------------------------------------------
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM animals;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'La taula animals conté % registres. Aquesta migració fa DROP i esborraria dades reals. Atura''t i fes una migració amb ALTER TABLE en comptes d''aquest script.', v_count;
    END IF;
END $$;

-- ----------------------------------------------------------------
-- Pas 2: Eliminar la vista que depèn d'animals (es recrea al pas 5)
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_animals_actius;

-- ----------------------------------------------------------------
-- Pas 3: Recrear la taula animals amb dib com a únic identificador
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS animals CASCADE;

CREATE TABLE animals (
    id             SERIAL PRIMARY KEY,
    dib            VARCHAR(50)      NOT NULL UNIQUE,
    raca_id        INTEGER          REFERENCES races_cataleg(id) ON DELETE SET NULL,
    data_naixement DATE,
    estat_salut    estat_salut_enum NOT NULL DEFAULT 'Sa',
    sexe           sexe_enum,
    estat_actiu    BOOLEAN          NOT NULL DEFAULT TRUE,
    creat_el       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    actualitzat_el TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_animals_actiu ON animals(estat_actiu);
CREATE INDEX idx_animals_raca  ON animals(raca_id);

-- Índex trigram per a cerca parcial ràpida pel DIB (substitueix
-- l'antic idx_animals_crotal_trgm, que era sobre crotal_id)
CREATE INDEX idx_animals_dib_trgm ON animals USING gin (dib extensions.gin_trgm_ops);

COMMENT ON COLUMN animals.dib IS
    'Identificador oficial únic de l''animal (Document d''Identificació Bovina). El crotal físic a l''orella porta el mateix número — no és un camp separat.';
COMMENT ON COLUMN animals.estat_actiu IS
    'Mai s''esborra un animal. estat_actiu=FALSE indica baixa per venda o mort. Historial sempre preservat.';
COMMENT ON INDEX idx_animals_dib_trgm IS
    'Índex GIN per a cerca parcial (LIKE %text%) en temps real sobre dib. Requereix extensió pg_trgm.';

-- ----------------------------------------------------------------
-- Pas 4: Recrear el trigger updated_at (es perd amb el DROP TABLE)
-- ----------------------------------------------------------------
CREATE TRIGGER trg_animals_updated_at
    BEFORE UPDATE ON animals
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Recrear el trigger d'historial d'estat de salut (es perd amb el DROP)
CREATE TRIGGER trg_animals_historial_salut
    BEFORE UPDATE OF estat_salut ON animals
    FOR EACH ROW EXECUTE FUNCTION fn_registra_canvi_estat_salut();

-- ----------------------------------------------------------------
-- Pas 5: Recrear v_animals_actius amb dib en comptes de crotal_id
-- ----------------------------------------------------------------
CREATE VIEW v_animals_actius AS
SELECT
    a.id,
    a.dib,
    r.nom_raca,
    a.data_naixement,
    a.estat_salut,
    a.sexe,
    l.nom_lot,
    c.codi_cort,
    z.nom  AS nom_zona,
    da.data_entrada,
    (CURRENT_DATE - a.data_naixement) AS edat_dies
FROM animals a
LEFT JOIN distribucio_animals  da ON da.animal_id = a.id AND da.data_sortida IS NULL
LEFT JOIN lots                  l  ON l.id  = da.lot_id
LEFT JOIN corts                 c  ON c.id  = da.cort_id
LEFT JOIN zones_infraestructura z  ON z.id  = c.zona_id
LEFT JOIN races_cataleg         r  ON r.id  = a.raca_id
WHERE a.estat_actiu = TRUE;

COMMENT ON VIEW v_animals_actius IS
    'Animals en actiu amb lot, cort i edat en dies. Utilitzada per al llistat diari i el Dashboard.';

-- ----------------------------------------------------------------
-- Pas 6: Recrear v_animals_en_supressio (també referenciava crotal_id)
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_animals_en_supressio;

CREATE VIEW v_animals_en_supressio AS
SELECT
    a.id          AS animal_id,
    a.dib,
    a.estat_salut,
    t.data_inici,
    t.data_alliberament,
    (t.data_alliberament - CURRENT_DATE) AS dies_restants_supressio,
    m.nom_medicament,
    m.dies_supressio
FROM tractaments t
JOIN animals     a ON a.id = t.animal_id
JOIN medicaments m ON m.id = t.medicament_id
WHERE t.data_alliberament > CURRENT_DATE
  AND a.estat_actiu = TRUE
ORDER BY t.data_alliberament ASC;

COMMENT ON VIEW v_animals_en_supressio IS
    'Animals amb bloqueig comercial actiu per període de supressió. Inclou dies restants. Utilitzada al Dashboard i al mòdul de baixes.';

-- Restaurar search_path per defecte
SET search_path TO public;

-- ================================================================
-- Verificació
-- ================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'tenant_00001' AND table_name = 'animals'
ORDER BY ordinal_position;

-- RESULTAT ESPERAT: columna "dib" amb is_nullable = 'NO', i CAP
-- columna "crotal_id"
-- ================================================================
