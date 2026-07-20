-- ================================================================
-- MIGRACIÓ: Log d'eliminacions de tractaments
-- Versió: 1.0.0 | Juliol 2026
-- ================================================================
-- ⚠️ EXECUTAR AL SQL EDITOR DE SUPABASE (tenant_00001)
--
-- Motiu: en eliminar un tractament (DELETE real, decisió confirmada
-- amb l'usuari), es perd tota la informació — incloent-hi si
-- l'animal estava en període de supressió per aquell tractament.
-- Aquesta taula guarda una còpia (snapshot) de les dades clau del
-- tractament abans d'eliminar-lo, més el motiu de l'eliminació.
-- ================================================================

SET search_path TO tenant_00001, public;

CREATE TABLE tractaments_eliminats_log (
    id                      SERIAL PRIMARY KEY,
    tractament_id_original  INTEGER      NOT NULL,
    animal_id               INTEGER      NOT NULL REFERENCES animals(id),
    animal_dib              VARCHAR(50)  NOT NULL,
    nom_medicament          VARCHAR(255) NOT NULL,
    data_inici              DATE         NOT NULL,
    data_alliberament       DATE,
    dosi_aplicada           DECIMAL(10,3),
    unitat_dosi             VARCHAR(20),
    motiu                   VARCHAR(100) NOT NULL,
    motiu_altres            TEXT,
    eliminat_per            INTEGER      NOT NULL REFERENCES public.users(id),
    eliminat_el             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE tractaments_eliminats_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_tractaments_eliminats_animal ON tractaments_eliminats_log(animal_id);

COMMENT ON TABLE tractaments_eliminats_log IS
    'Còpia (snapshot) de les dades clau d''un tractament eliminat, amb el motiu. tractament_id_original NO és una FK (el registre original ja no existeix a tractaments després del DELETE) — es guarda només com a referència informativa.';
COMMENT ON COLUMN tractaments_eliminats_log.motiu IS
    'Motiu predefinit (Ex: "Error d''entrada", "Duplicat", "Dosi incorrecta", "Medicament incorrecte", "Altres"). Si motiu = "Altres", motiu_altres conté el text lliure introduït.';

SET search_path TO public;

-- ================================================================
-- Verificació
-- ================================================================
SET search_path TO tenant_00001, public;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tractaments_eliminats_log'
ORDER BY ordinal_position;
SET search_path TO public;
-- ================================================================
