-- ================================================================
-- MIGRACIÓ: Vinculació de sitges/magatzems a una nau o pastura
-- Versió: 1.0.0 | Juliol 2026
-- ================================================================
-- ⚠️ EXECUTAR AL SQL EDITOR DE SUPABASE (tenant_00001), tot en una
--    sola execució.
--
-- Motiu: permetre vincular opcionalment una sitja o magatzem de
-- farratge a la nau/pastura on habitualment es consumeix el seu
-- contingut. Quan hi ha vinculació, el formulari de Consums Massius
-- precompleta i bloqueja el camp Destí automàticament — evita
-- errors de selecció i garanteix una imputació de cost consistent
-- als animals d'aquella zona. El registre del consum en si segueix
-- sent una acció manual (quantitat + data).
-- ================================================================

SET search_path TO tenant_00001, public;

-- ----------------------------------------------------------------
-- Pas 1: Afegir la columna a totes dues taules
-- ----------------------------------------------------------------
ALTER TABLE sitges
    ADD COLUMN IF NOT EXISTS zona_vinculada_id INTEGER REFERENCES zones_infraestructura(id) ON DELETE SET NULL;

ALTER TABLE magatzems_farratge
    ADD COLUMN IF NOT EXISTS zona_vinculada_id INTEGER REFERENCES zones_infraestructura(id) ON DELETE SET NULL;

COMMENT ON COLUMN sitges.zona_vinculada_id IS
    'Nau o pastura on habitualment es consumeix el contingut d''aquesta sitja (opcional). Si s''informa, el formulari de Consums Massius precompleta i bloqueja el Destí automàticament.';
COMMENT ON COLUMN magatzems_farratge.zona_vinculada_id IS
    'Nau o pastura on habitualment es consumeix el contingut d''aquest magatzem (opcional). Mateix comportament que sitges.zona_vinculada_id.';

-- ----------------------------------------------------------------
-- Pas 2: Trigger de validació — la zona vinculada ha de ser
-- NAU_ANIMALS o PASTURA (mai un altre COBERT_EMMAGATZEMATGE)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_valida_zona_vinculada()
RETURNS TRIGGER AS $$
DECLARE
    v_tipus zones_infraestructura.tipus_zona%TYPE;
BEGIN
    IF NEW.zona_vinculada_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT tipus_zona INTO v_tipus
    FROM zones_infraestructura
    WHERE id = NEW.zona_vinculada_id;

    IF v_tipus NOT IN ('NAU_ANIMALS', 'PASTURA') THEN
        RAISE EXCEPTION
            'La zona vinculada ha de ser una nau d''animals o una pastura (és %). Un cobert d''emmagatzematge no consumeix aliment, no té sentit vincular-hi un magatzem.',
            v_tipus;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sitges_zona_vinculada ON sitges;
CREATE TRIGGER trg_sitges_zona_vinculada
    BEFORE INSERT OR UPDATE OF zona_vinculada_id ON sitges
    FOR EACH ROW EXECUTE FUNCTION trg_fn_valida_zona_vinculada();

DROP TRIGGER IF EXISTS trg_magatzem_zona_vinculada ON magatzems_farratge;
CREATE TRIGGER trg_magatzem_zona_vinculada
    BEFORE INSERT OR UPDATE OF zona_vinculada_id ON magatzems_farratge
    FOR EACH ROW EXECUTE FUNCTION trg_fn_valida_zona_vinculada();

SET search_path TO public;

-- ================================================================
-- Verificació
-- ================================================================
SET search_path TO tenant_00001, public;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'sitges' AND column_name = 'zona_vinculada_id';
SELECT column_name FROM information_schema.columns
WHERE table_name = 'magatzems_farratge' AND column_name = 'zona_vinculada_id';
SET search_path TO public;
-- RESULTAT ESPERAT: una fila a cada consulta
-- ================================================================
