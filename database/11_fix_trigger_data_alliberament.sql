-- ================================================================
-- FIX: fn_calcula_data_alliberament() referenciava una columna
--      eliminada del catàleg de medicaments
-- Versió: 1.0.0 | Juliol 2026
-- ================================================================
-- ⚠️ EXECUTAR AL SQL EDITOR DE SUPABASE (tenant_00001)
--
-- Motiu: aquest trigger (BEFORE INSERT a `tractaments`) calcula
-- data_alliberament = data_inici + dies_supressio, però dies_supressio
-- ja no viu a `medicaments` des de la migració
-- 10_migracio_cataleg_medicaments.sql — ara viu a medicaments_cataleg.
-- No es va detectar en aquella migració perquè els triggers de
-- PL/pgSQL no queden registrats a pg_depend com les vistes, així
-- que l'error només ha aparegut ara, en aplicar el primer tractament
-- des d'aquell canvi.
--
-- CREATE OR REPLACE FUNCTION: no cal DROP previ, se substitueix
-- directament sense afectar el trigger que ja la crida
-- (trg_tractament_alliberament segueix intacte).
-- ================================================================

SET search_path TO tenant_00001, public;

CREATE OR REPLACE FUNCTION fn_calcula_data_alliberament()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_dies_supressio INTEGER;
BEGIN
    SELECT mc.dies_supressio INTO v_dies_supressio
    FROM medicaments m
    JOIN medicaments_cataleg mc ON mc.id = m.medicament_cataleg_id
    WHERE m.id = NEW.medicament_id;

    NEW.data_alliberament := NEW.data_inici + v_dies_supressio;
    RETURN NEW;
END;
$function$;

SET search_path TO public;

-- ================================================================
-- Verificació
-- ================================================================
SET search_path TO tenant_00001, public;
SELECT pg_get_functiondef('fn_calcula_data_alliberament'::regproc);
-- RESULTAT ESPERAT: la definició ha de mostrar el JOIN a
-- medicaments_cataleg i "mc.dies_supressio", no "dies_supressio"
-- a soles
SET search_path TO public;
-- ================================================================
