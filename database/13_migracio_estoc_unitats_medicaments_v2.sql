-- ================================================================
-- MIGRACIÓ: Estoc de medicaments com a (nombre d'unitats × quantitat
--           per unitat) en comptes d'un total introduït a mà
-- Versió: 1.1.0 | Juliol 2026 (corregeix fals positiu del check de seguretat)
-- ================================================================
-- ⚠️ EXECUTAR AL SQL EDITOR DE SUPABASE (tenant_00001), TOT EN UNA
--    SOLA EXECUCIÓ.
-- ⚠️ PRESERVA la fila existent (confirmat: 1 fila, 240,000 ml).
--
-- Correcció respecte a la v1.0.0: el Pas 0 comprovava qualsevol
-- vista que DEPENGUÉS de la taula `medicaments` (via pg_depend),
-- cosa massa àmplia — v_animals_en_supressio hi depèn (fa un JOIN),
-- però NO fa servir les columnes quantitat_estoc/unitat_estoc que
-- s'eliminen (ja la vam corregir en una migració anterior). Ara la
-- comprovació busca el TEXT de la definició de cada vista, només
-- pel nom de les columnes concretes que s'eliminaran.
-- ================================================================

SET search_path TO tenant_00001, public;

-- ----------------------------------------------------------------
-- Pas 0: Comprovació de seguretat — nomes vistes/funcions que
-- REALMENT facin servir quantitat_estoc o unitat_estoc
-- ----------------------------------------------------------------
DO $$
DECLARE
    v_vistes TEXT;
    v_funcions TEXT;
BEGIN
    SELECT string_agg(viewname, ', ')
    INTO v_vistes
    FROM pg_views
    WHERE schemaname = 'tenant_00001'
      AND (definition ILIKE '%quantitat_estoc%' OR definition ILIKE '%unitat_estoc%');

    IF v_vistes IS NOT NULL THEN
        RAISE EXCEPTION 'Hi ha vistes que referencien quantitat_estoc/unitat_estoc i cal revisar-les abans de continuar: %', v_vistes;
    END IF;

    SELECT string_agg(p.proname, ', ')
    INTO v_funcions
    FROM pg_proc p
    WHERE p.pronamespace = 'tenant_00001'::regnamespace
      AND (p.prosrc ILIKE '%quantitat_estoc%' OR p.prosrc ILIKE '%unitat_estoc%');

    IF v_funcions IS NOT NULL THEN
        RAISE EXCEPTION 'Hi ha funcions que referencien quantitat_estoc/unitat_estoc que cal revisar abans de continuar: %', v_funcions;
    END IF;
END $$;

-- ----------------------------------------------------------------
-- Pas 0b: Neteja preventiva — per si l'intent v1.0.0 (que va fallar
-- al Pas 0) hagués deixat alguna part aplicada (no hauria de ser
-- el cas, ja que va fallar abans de tocar cap columna, però per
-- seguretat es fa idempotent)
-- ----------------------------------------------------------------
ALTER TABLE medicaments DROP COLUMN IF EXISTS nombre_unitats;
ALTER TABLE medicaments DROP COLUMN IF EXISTS unitat_paquet;
ALTER TABLE medicaments DROP COLUMN IF EXISTS quantitat_per_unitat;
ALTER TABLE medicaments DROP COLUMN IF EXISTS unitat_contingut;

-- ----------------------------------------------------------------
-- Pas 1: Afegir les columnes noves
-- ----------------------------------------------------------------
ALTER TABLE medicaments ADD COLUMN nombre_unitats DECIMAL(10,3);
ALTER TABLE medicaments ADD COLUMN unitat_paquet VARCHAR(20);
ALTER TABLE medicaments ADD COLUMN quantitat_per_unitat DECIMAL(10,3);
ALTER TABLE medicaments ADD COLUMN unitat_contingut VARCHAR(20);

-- ----------------------------------------------------------------
-- Pas 2: Migrar la fila existent, preservant el total exacte
-- ----------------------------------------------------------------
UPDATE medicaments
SET nombre_unitats       = 1,
    unitat_paquet        = 'unitats',
    quantitat_per_unitat = quantitat_estoc,
    unitat_contingut     = unitat_estoc;

-- ----------------------------------------------------------------
-- Pas 3: NOT NULL i constraints, un cop poblades i verificades
-- ----------------------------------------------------------------
DO $$
DECLARE
    v_sense_poblar INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_sense_poblar
    FROM medicaments
    WHERE nombre_unitats IS NULL OR quantitat_per_unitat IS NULL;
    IF v_sense_poblar > 0 THEN
        RAISE EXCEPTION 'Hi ha % files sense poblar. Migració aturada.', v_sense_poblar;
    END IF;
END $$;

ALTER TABLE medicaments ALTER COLUMN nombre_unitats SET NOT NULL;
ALTER TABLE medicaments ALTER COLUMN unitat_paquet SET NOT NULL;
ALTER TABLE medicaments ALTER COLUMN quantitat_per_unitat SET NOT NULL;
ALTER TABLE medicaments ALTER COLUMN unitat_contingut SET NOT NULL;

ALTER TABLE medicaments ADD CONSTRAINT medicaments_nombre_unitats_valid CHECK (nombre_unitats >= 0);
ALTER TABLE medicaments ADD CONSTRAINT medicaments_quantitat_per_unitat_valid CHECK (quantitat_per_unitat > 0);

-- ----------------------------------------------------------------
-- Pas 4: Eliminar les columnes antigues
-- ----------------------------------------------------------------
ALTER TABLE medicaments DROP COLUMN quantitat_estoc;
ALTER TABLE medicaments DROP COLUMN unitat_estoc;

COMMENT ON COLUMN medicaments.nombre_unitats IS
    'Nombre d''ampolles/sobres/unitats restants. Pot quedar amb decimals després de consumir dosi parcial d''una unitat (Ex: 9,4 ampolles). L''estoc total = nombre_unitats × quantitat_per_unitat.';
COMMENT ON COLUMN medicaments.quantitat_per_unitat IS
    'Quantitat que conté cada ampolla/sobre (Ex: 50 ml). Fix un cop creada l''entrada — no varia amb el consum.';

SET search_path TO public;

-- ================================================================
-- Verificació
-- ================================================================
SET search_path TO tenant_00001, public;
SELECT id, nombre_unitats, unitat_paquet, quantitat_per_unitat, unitat_contingut,
       nombre_unitats * quantitat_per_unitat AS total_calculat
FROM medicaments;
-- RESULTAT ESPERAT: 1 fila, nombre_unitats=1, unitat_paquet='unitats',
-- quantitat_per_unitat=240, unitat_contingut='ml', total_calculat=240
SET search_path TO public;
-- ================================================================
