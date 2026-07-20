-- ================================================================
-- MIGRACIÓ: Catàleg de Medicaments (separa dades mestres de l'estoc)
-- Versió: 1.1.0 | Juliol 2026 (corregeix vistes dependents)
-- ================================================================
-- ⚠️ EXECUTAR AL SQL EDITOR DE SUPABASE (tenant_00001), TOT EN UNA
--    SOLA EXECUCIÓ.
--
-- Correccions respecte a la v1.0.0:
--   La v1.0.0 va fallar amb l'error 2BP01 perquè DUES vistes dificultaven
--   l'ALTER TABLE DROP COLUMN: v_animals_en_supressio (detectada per
--   l'error) i possiblement altres — es van comprovar EXHAUSTIVAMENT
--   totes les vistes dependents de `medicaments` abans de reintentar
--   (confirmat: només v_animals_en_supressio). Ara totes dues vistes
--   (v_animals_en_supressio) s'eliminen ABANS de tocar les columnes,
--   i es recreen DESPRÉS amb JOIN a medicaments_cataleg.
--
-- ⚠️ PRESERVA les dades existents a `medicaments`.
-- ================================================================

SET search_path TO tenant_00001, public;

-- ----------------------------------------------------------------
-- Pas 0: Neteja preventiva — per si l'intent v1.0.0 (que va fallar)
-- hagués deixat alguna part aplicada
-- ----------------------------------------------------------------
ALTER TABLE medicaments DROP COLUMN IF EXISTS medicament_cataleg_id;
DROP TABLE IF EXISTS medicaments_cataleg CASCADE;

-- ----------------------------------------------------------------
-- Pas 1: Crear la taula de catàleg
-- ----------------------------------------------------------------
CREATE TABLE medicaments_cataleg (
    id                 SERIAL PRIMARY KEY,
    nom_medicament     VARCHAR(255) NOT NULL,
    principi_actiu     VARCHAR(255) NOT NULL,
    posologia_standard TEXT,
    dies_supressio     INTEGER NOT NULL,
    creat_el           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT medicaments_cataleg_nom_unic UNIQUE (nom_medicament),
    CONSTRAINT medicaments_cataleg_dies_supressio_valid CHECK (dies_supressio >= 0)
);

ALTER TABLE medicaments_cataleg ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE medicaments_cataleg IS
    'Dades mestres de cada medicament (nom, principi actiu, posologia, dies de supressió). Separat de medicaments (entrades d''estoc/compra) des de juliol 2026.';

-- ----------------------------------------------------------------
-- Pas 2: Migrar les dades mestres existents al catàleg
-- ----------------------------------------------------------------
INSERT INTO medicaments_cataleg (nom_medicament, principi_actiu, posologia_standard, dies_supressio)
SELECT DISTINCT ON (nom_medicament)
    nom_medicament, principi_actiu, posologia_standard, dies_supressio
FROM medicaments
ORDER BY nom_medicament, creat_el DESC;

-- ----------------------------------------------------------------
-- Pas 3: Afegir la FK a medicaments i poblar-la
-- ----------------------------------------------------------------
ALTER TABLE medicaments ADD COLUMN medicament_cataleg_id INTEGER REFERENCES medicaments_cataleg(id) ON DELETE RESTRICT;

UPDATE medicaments m
SET medicament_cataleg_id = mc.id
FROM medicaments_cataleg mc
WHERE mc.nom_medicament = m.nom_medicament;

-- ----------------------------------------------------------------
-- Pas 4: Verificació de seguretat
-- ----------------------------------------------------------------
DO $$
DECLARE
    v_sense_enllacar INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sense_enllacar FROM medicaments WHERE medicament_cataleg_id IS NULL;
    IF v_sense_enllacar > 0 THEN
        RAISE EXCEPTION 'Hi ha % files a medicaments sense enllaçar al catàleg. Migració aturada abans d''eliminar columnes.', v_sense_enllacar;
    END IF;
END $$;

ALTER TABLE medicaments ALTER COLUMN medicament_cataleg_id SET NOT NULL;

-- ----------------------------------------------------------------
-- Pas 5: Eliminar la vista dependent ABANS de tocar les columnes
-- (aquest era el bug de la v1.0.0)
-- ----------------------------------------------------------------
DROP VIEW IF EXISTS v_animals_en_supressio;

-- ----------------------------------------------------------------
-- Pas 6: Eliminar les columnes ara redundants de medicaments
-- ----------------------------------------------------------------
ALTER TABLE medicaments DROP COLUMN nom_medicament;
ALTER TABLE medicaments DROP COLUMN principi_actiu;
ALTER TABLE medicaments DROP COLUMN posologia_standard;
ALTER TABLE medicaments DROP COLUMN dies_supressio;

COMMENT ON COLUMN medicaments.medicament_cataleg_id IS
    'Referència al medicament del catàleg (medicaments_cataleg). ON DELETE RESTRICT: no es pot eliminar un medicament del catàleg mentre hi hagi entrades d''estoc que el referenciïn.';

-- ----------------------------------------------------------------
-- Pas 7: Recrear v_animals_en_supressio amb JOIN a medicaments_cataleg
-- (nom_medicament i dies_supressio ara viuen al catàleg, no a medicaments)
-- ----------------------------------------------------------------
CREATE VIEW v_animals_en_supressio AS
SELECT
    a.id AS animal_id,
    a.dib,
    a.estat_salut,
    t.data_inici,
    t.data_alliberament,
    t.data_alliberament - CURRENT_DATE AS dies_restants_supressio,
    mc.nom_medicament,
    mc.dies_supressio
FROM tractaments t
JOIN animals a              ON a.id = t.animal_id
JOIN medicaments m          ON m.id = t.medicament_id
JOIN medicaments_cataleg mc ON mc.id = m.medicament_cataleg_id
WHERE t.data_alliberament > CURRENT_DATE AND a.estat_actiu = true
ORDER BY t.data_alliberament;

SET search_path TO public;

-- ================================================================
-- Verificació
-- ================================================================
SET search_path TO tenant_00001, public;

SELECT * FROM medicaments_cataleg;
-- RESULTAT ESPERAT: 1 fila — "Selectan", "Florfenicol",
-- "1ml per 15kg/pes viu", 20

SELECT id, medicament_cataleg_id, lot, quantitat_estoc, unitat_estoc, preu_compra FROM medicaments;
-- RESULTAT ESPERAT: 1 fila, amb medicament_cataleg_id apuntant a
-- la fila del catàleg de dalt

SELECT * FROM v_animals_en_supressio;
-- RESULTAT ESPERAT: 0 o més files, sense error (buit si cap animal
-- està actualment en període de supressió)

SET search_path TO public;
-- ================================================================
