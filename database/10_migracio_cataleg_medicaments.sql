-- ================================================================
-- MIGRACIÓ: Catàleg de Medicaments (separa dades mestres de l'estoc)
-- Versió: 1.0.0 | Juliol 2026
-- ================================================================
-- ⚠️ EXECUTAR AL SQL EDITOR DE SUPABASE (tenant_00001), TOT EN UNA
--    SOLA EXECUCIÓ.
-- ⚠️ Aquesta migració PRESERVA les dades existents a `medicaments`
--    (confirmat: 1 fila real a data d'aquesta migració) — a
--    diferència de la migració de sitges/pinsos, aquí NO es pot
--    esborrar i recrear, cal traslladar les dades.
--
-- Motiu: `medicaments` conflava dades mestres (nom, principi actiu,
-- posologia, dies de supressió — que no canvien) amb dades de cada
-- compra/lot (lot, quantitat, preu — que sí canvien). Es crea
-- `medicaments_cataleg` amb les dades mestres, i `medicaments` queda
-- reduïda a les dades de cada entrada d'estoc, referenciant el
-- catàleg per FK.
-- ================================================================

SET search_path TO tenant_00001, public;

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
-- (deduplicades per nom_medicament — si hi hagués dues files amb el
-- mateix nom, es queda amb la més recent)
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
-- Pas 4: Verificació de seguretat — atura's si alguna fila ha
-- quedat sense enllaçar (no hauria de passar, però per seguretat)
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

-- ----------------------------------------------------------------
-- Pas 5: Ara que està poblada i verificada, fer-la NOT NULL
-- ----------------------------------------------------------------
ALTER TABLE medicaments ALTER COLUMN medicament_cataleg_id SET NOT NULL;

-- ----------------------------------------------------------------
-- Pas 6: Eliminar les columnes ara redundants de medicaments
-- ----------------------------------------------------------------
ALTER TABLE medicaments DROP COLUMN nom_medicament;
ALTER TABLE medicaments DROP COLUMN principi_actiu;
ALTER TABLE medicaments DROP COLUMN posologia_standard;
ALTER TABLE medicaments DROP COLUMN dies_supressio;

COMMENT ON COLUMN medicaments.medicament_cataleg_id IS
    'Referència al medicament del catàleg (medicaments_cataleg). ON DELETE RESTRICT: no es pot eliminar un medicament del catàleg mentre hi hagi entrades d''estoc que el referenciïn.';

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
-- la fila del catàleg de dalt, i SENSE columnes nom_medicament/
-- principi_actiu/posologia_standard/dies_supressio

SET search_path TO public;
-- ================================================================
