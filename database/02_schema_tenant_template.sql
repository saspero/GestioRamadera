-- ================================================================
-- GESTIÓ RAMADERA BOVINA — SCHEMA TENANT (PLANTILLA)
-- Versió: 1.1.0 | Juny 2026
-- Motor: PostgreSQL 16+ (Supabase)
-- ================================================================
-- ⚠️ EXECUTAR UN COP PER CADA TENANT NOU (cada granja client).
-- Prerequisit: 01_schema_public.sql ja ha d'estar executat.
--
-- INSTRUCCIONS D'ÚS:
--   1. Substitueix TOTES les aparicions de "tenant_00001" per
--      l'identificador real del nou tenant (ex: tenant_00002).
--      Pots fer-ho amb cerca i reemplaça abans d'enganxar al
--      SQL Editor de Supabase.
--   2. Executa el fitxer sencer d'un sol cop.
--   3. Després de crear el schema, recorda inserir el registre
--      corresponent a public.tenants amb el mateix schema_name.
--
-- Per al primer tenant de prova, ja ve preparat amb "tenant_00001".
-- ================================================================

-- Crea el schema aïllat per a aquest tenant
CREATE SCHEMA IF NOT EXISTS tenant_00001;

-- A partir d'aquí, totes les taules es creen DINS d'aquest schema
SET search_path TO tenant_00001, public;

-- ================================================================
-- BLOC 3 — TAULES DEL TENANT
-- ================================================================

-- Tipus enumerats per schema tenant
CREATE TYPE tipus_zona_enum     AS ENUM ('NAU_ANIMALS', 'COBERT_EMMAGATZEMATGE', 'PASTURA');
CREATE TYPE estat_salut_enum    AS ENUM ('Sa', 'En tractament', 'Observació', 'Crític');
CREATE TYPE sexe_enum           AS ENUM ('Mascle', 'Femella');
CREATE TYPE motiu_baixa_enum    AS ENUM ('Venda', 'Mort');
CREATE TYPE unitat_mesura_enum  AS ENUM ('kg', 'Tones', 'Unitats');
CREATE TYPE estat_magatzem_enum AS ENUM ('Actiu', 'Deshabilitat');


-- ----------------------------------------------------------------
-- Infraestructura física
-- ----------------------------------------------------------------

CREATE TABLE ubicacions (
    id                    SERIAL PRIMARY KEY,
    nom                   VARCHAR(255) NOT NULL,
    codi_pastura_extensiu VARCHAR(50),
    creat_el              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN ubicacions.codi_pastura_extensiu IS
    'Nul·lable. Només per a explotacions extensives amb parcel·les de pastura identificades.';


CREATE TABLE zones_infraestructura (
    id          SERIAL PRIMARY KEY,
    ubicacio_id INTEGER         NOT NULL REFERENCES ubicacions(id) ON DELETE RESTRICT,
    nom         VARCHAR(255)    NOT NULL,
    tipus_zona  tipus_zona_enum NOT NULL,
    creat_el    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zones_ubicacio   ON zones_infraestructura(ubicacio_id);
CREATE INDEX idx_zones_tipus_zona ON zones_infraestructura(tipus_zona);

COMMENT ON TABLE zones_infraestructura IS
    'Zones dins d''una ubicació. El tipus_zona determina quins elements es poden crear dins (corts, magatzems...).';


CREATE TABLE corts (
    id               SERIAL PRIMARY KEY,
    zona_id          INTEGER      NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    codi_cort        VARCHAR(50)  NOT NULL,
    capacitat_maxima INTEGER,
    creat_el         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    -- Validació de tipus_zona: gestionada pel trigger trg_corts_valida_zona
);

COMMENT ON TABLE corts IS
    'Corts físiques on s''allotgen animals. Només poden existir en zones de tipus NAU_ANIMALS (validat per trigger).';


-- ----------------------------------------------------------------
-- Emmagatzematge d'aliments
-- ----------------------------------------------------------------

CREATE TABLE sitges (
    id              SERIAL PRIMARY KEY,
    ubicacio_id     INTEGER             NOT NULL REFERENCES ubicacions(id) ON DELETE RESTRICT,
    nom             VARCHAR(255)        NOT NULL,
    capacitat_kg    DECIMAL(12,2),
    estoc_actual_kg DECIMAL(12,2)       NOT NULL DEFAULT 0,
    tipus_pinso     VARCHAR(100),
    estoc_minim_kg  DECIMAL(12,2),
    estat           estat_magatzem_enum NOT NULL DEFAULT 'Actiu',
    creat_el        TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    actualitzat_el  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT sitges_estoc_positiu CHECK (estoc_actual_kg >= 0)
);

COMMENT ON COLUMN sitges.estoc_minim_kg IS
    'Llindar d''alerta d''estoc mínim específic per a aquesta sitja. Si NULL, hereta el valor de configuracio_general.';


CREATE TABLE magatzems_farratge (
    id                     SERIAL PRIMARY KEY,
    zona_id                INTEGER             NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    tipus_farratge         VARCHAR(100)        NOT NULL,
    estoc_actual_tones     DECIMAL(12,3)       NOT NULL DEFAULT 0,
    capacitat_maxima_tones DECIMAL(12,3),
    pes_mitja_bala_kg      DECIMAL(8,2),
    estoc_minim_tones      DECIMAL(12,3),
    estat                  estat_magatzem_enum NOT NULL DEFAULT 'Actiu',
    creat_el               TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    actualitzat_el         TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    -- Validació de tipus_zona: gestionada pel trigger trg_magatzems_valida_zona
    CONSTRAINT magatzem_estoc_positiu CHECK (estoc_actual_tones >= 0)
);

COMMENT ON COLUMN magatzems_farratge.pes_mitja_bala_kg IS
    'Pes mitjà en kg per bala. Necessari per convertir "Unitats" a kg en el formulari de consums massius.';
COMMENT ON COLUMN magatzems_farratge.estoc_minim_tones IS
    'Llindar d''alerta específic. Si NULL, hereta el valor de configuracio_general.';


-- ----------------------------------------------------------------
-- Catàleg de races
-- ----------------------------------------------------------------

CREATE TABLE races_cataleg (
    id        SERIAL PRIMARY KEY,
    nom_raca  VARCHAR(100) NOT NULL,
    es_global BOOLEAN      NOT NULL DEFAULT FALSE,
    creat_el  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT races_nom_unic UNIQUE (nom_raca)
);

CREATE INDEX idx_races_global ON races_cataleg(es_global);

COMMENT ON COLUMN races_cataleg.es_global IS
    'TRUE = raça estàndard precarregada (Frisona, Limousin...). FALSE = raça personalitzada per aquest tenant.';
COMMENT ON TABLE races_cataleg IS
    'Les races amb es_global=TRUE es precarreguen automàticament en crear el schema tenant. El tenant pot afegir-ne de pròpies.';


-- ----------------------------------------------------------------
-- Lots i animals
-- ----------------------------------------------------------------

CREATE TABLE lots (
    id           SERIAL PRIMARY KEY,
    nom_lot      VARCHAR(100) NOT NULL,
    data_creacio DATE         NOT NULL DEFAULT CURRENT_DATE,
    creat_el     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


CREATE TABLE animals (
    id             SERIAL PRIMARY KEY,
    crotal_id      VARCHAR(20)     NOT NULL UNIQUE,
    dib            VARCHAR(50),
    raca_id        INTEGER         REFERENCES races_cataleg(id) ON DELETE SET NULL,
    data_naixement DATE,
    estat_salut    estat_salut_enum NOT NULL DEFAULT 'Sa',
    sexe           sexe_enum,
    estat_actiu    BOOLEAN          NOT NULL DEFAULT TRUE,
    creat_el       TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    actualitzat_el TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Índex estàndard
CREATE INDEX idx_animals_actiu ON animals(estat_actiu);
CREATE INDEX idx_animals_raca  ON animals(raca_id);

-- Índex de text complet per cerca ràpida per crotal (parcial, com fa el cercador)
CREATE INDEX idx_animals_crotal_trgm ON animals USING gin (crotal_id extensions.gin_trgm_ops);

COMMENT ON COLUMN animals.estat_actiu IS
    'Mai s''esborra un animal. estat_actiu=FALSE indica baixa (venda o mort). L''historial es preserva sempre.';
COMMENT ON COLUMN animals.estat_salut IS
    'Estat actual. Els canvis queden enregistrats a historial_estat_salut per traçabilitat clínica.';
COMMENT ON INDEX  idx_animals_crotal_trgm IS
    'Índex trigram per a cerques parcials ràpides per crotal (LIKE, ILIKE). Requereix extensió pg_trgm.';


-- ----------------------------------------------------------------
-- MILLORA: Historial d'estat de salut
-- ----------------------------------------------------------------

CREATE TABLE historial_estat_salut (
    id          BIGSERIAL PRIMARY KEY,
    animal_id   INTEGER          NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    estat_antic estat_salut_enum NOT NULL,
    estat_nou   estat_salut_enum NOT NULL,
    motiu       TEXT,
    canviat_per INTEGER          REFERENCES public.users(id) ON DELETE SET NULL,
    canviat_el  TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historial_salut_animal ON historial_estat_salut(animal_id, canviat_el DESC);

COMMENT ON TABLE historial_estat_salut IS
    'Registre cronològic de tots els canvis d''estat de salut d''un animal. Permet traçabilitat clínica completa. Populat automàticament pel trigger trg_animals_historial_salut.';


-- ----------------------------------------------------------------
-- Distribució d'animals (lot + cort)
-- ----------------------------------------------------------------

CREATE TABLE distribucio_animals (
    id           SERIAL PRIMARY KEY,
    animal_id    INTEGER     NOT NULL REFERENCES animals(id)  ON DELETE RESTRICT,
    lot_id       INTEGER     REFERENCES lots(id)              ON DELETE SET NULL,
    cort_id      INTEGER     REFERENCES corts(id)             ON DELETE SET NULL,
    data_entrada DATE        NOT NULL DEFAULT CURRENT_DATE,
    data_sortida DATE,
    creat_el     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT distribucio_dates_check CHECK (data_sortida IS NULL OR data_sortida >= data_entrada)
);

CREATE INDEX idx_distribucio_animal ON distribucio_animals(animal_id);
CREATE INDEX idx_distribucio_lot    ON distribucio_animals(lot_id);
CREATE INDEX idx_distribucio_activa ON distribucio_animals(animal_id) WHERE data_sortida IS NULL;

COMMENT ON INDEX idx_distribucio_activa IS
    'Índex parcial per recuperar ràpidament la distribució activa d''un animal (data_sortida IS NULL).';


-- ----------------------------------------------------------------
-- Registres de producció
-- ----------------------------------------------------------------

CREATE TABLE registre_pes (
    id            SERIAL PRIMARY KEY,
    animal_id     INTEGER       NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    data          DATE          NOT NULL,
    pes_kg        DECIMAL(8,2)  NOT NULL,
    registrat_per INTEGER       REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT pes_positiu CHECK (pes_kg > 0)
);

CREATE INDEX idx_pes_animal_data ON registre_pes(animal_id, data DESC);


CREATE TABLE registre_llet (
    id            SERIAL PRIMARY KEY,
    animal_id     INTEGER       NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    data          DATE          NOT NULL,
    litres        DECIMAL(8,2)  NOT NULL,
    registrat_per INTEGER       REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT litres_positius CHECK (litres >= 0)
);

CREATE INDEX idx_llet_animal_data ON registre_llet(animal_id, data DESC);


-- ----------------------------------------------------------------
-- Logística d'alimentació
-- ----------------------------------------------------------------

CREATE TABLE consums_pinso_nau (
    id            SERIAL PRIMARY KEY,
    zona_id       INTEGER       NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    sitge_id      INTEGER       NOT NULL REFERENCES sitges(id)                ON DELETE RESTRICT,
    data          DATE          NOT NULL,
    kg_consumits  DECIMAL(10,2) NOT NULL,
    registrat_per INTEGER       REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT kg_positius CHECK (kg_consumits > 0)
);

CREATE INDEX idx_consums_pinso_data ON consums_pinso_nau(data DESC);


CREATE TABLE moviments_farratge (
    id               SERIAL PRIMARY KEY,
    magatzem_id      INTEGER            NOT NULL REFERENCES magatzems_farratge(id)     ON DELETE RESTRICT,
    zona_desti_id    INTEGER            NOT NULL REFERENCES zones_infraestructura(id)  ON DELETE RESTRICT,
    data             DATE               NOT NULL,
    quantitat        DECIMAL(12,3)      NOT NULL,
    unitat           unitat_mesura_enum NOT NULL,
    quantitat_kg_real DECIMAL(12,3)     NOT NULL,
    registrat_per    INTEGER            REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el         TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    CONSTRAINT quantitat_positiva CHECK (quantitat > 0)
);

CREATE INDEX idx_moviments_farratge_data     ON moviments_farratge(data DESC);
CREATE INDEX idx_moviments_farratge_magatzem ON moviments_farratge(magatzem_id);

COMMENT ON COLUMN moviments_farratge.quantitat_kg_real IS
    'Sempre en kg. Si unitat=Unitats (bales), = quantitat * pes_mitja_bala_kg del magatzem origen.';


-- ----------------------------------------------------------------
-- Mòdul sanitari
-- ----------------------------------------------------------------

CREATE TABLE medicaments (
    id                 SERIAL PRIMARY KEY,
    nom_medicament     VARCHAR(255)  NOT NULL,
    principi_actiu     VARCHAR(255)  NOT NULL,
    lot                VARCHAR(100)  NOT NULL,
    quantitat_estoc    DECIMAL(12,3) NOT NULL DEFAULT 0,
    unitat_estoc       VARCHAR(20)   NOT NULL DEFAULT 'ml',
    posologia_standard TEXT,
    preu_compra        DECIMAL(10,2) NOT NULL,
    dies_supressio     INTEGER       NOT NULL,
    creat_el           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    actualitzat_el     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT medicament_dies_supressio_positiu CHECK (dies_supressio >= 0),
    CONSTRAINT medicament_estoc_positiu          CHECK (quantitat_estoc >= 0),
    CONSTRAINT medicament_preu_positiu           CHECK (preu_compra >= 0)
);

CREATE INDEX idx_medicaments_nom_lot ON medicaments(nom_medicament, lot);

COMMENT ON COLUMN medicaments.dies_supressio IS
    'Dies d''espera obligatoris abans de vendre l''animal tractat. Genera bloqueig comercial automàtic.';


CREATE TABLE tractaments (
    id               SERIAL PRIMARY KEY,
    animal_id        INTEGER       NOT NULL REFERENCES animals(id)     ON DELETE RESTRICT,
    medicament_id    INTEGER       NOT NULL REFERENCES medicaments(id)  ON DELETE RESTRICT,
    data_inici       DATE          NOT NULL,
    data_fi_prevista DATE,
    data_fi_real     DATE,
    dosi_aplicada    DECIMAL(10,3),
    unitat_dosi      VARCHAR(20),
    data_alliberament DATE,
    -- Calculat automàticament pel trigger trg_tractaments_alliberament:
    -- data_inici + dies_supressio del medicament associat
    notes            TEXT,
    aplicat_per      INTEGER       REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT tractament_dates_check CHECK (data_fi_prevista IS NULL OR data_fi_prevista >= data_inici)
);

CREATE INDEX idx_tractaments_animal       ON tractaments(animal_id);
CREATE INDEX idx_tractaments_alliberament ON tractaments(data_alliberament)
    WHERE data_alliberament IS NOT NULL;

COMMENT ON COLUMN tractaments.data_alliberament IS
    'Data a partir de la qual l''animal pot ser comercialitzat. Calculada automàticament pel trigger: data_inici + dies_supressio del medicament.';


-- ----------------------------------------------------------------
-- Baixes (vendes i morts)
-- ----------------------------------------------------------------

CREATE TABLE baixes (
    id                      SERIAL PRIMARY KEY,
    animal_id               INTEGER         NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    motiu                   motiu_baixa_enum NOT NULL,
    data_baixa              DATE            NOT NULL,
    -- Camps de venda
    pes_viu_kg              DECIMAL(8,2),
    pes_canal_kg            DECIMAL(8,2),
    preu_kg                 DECIMAL(8,2),
    cost_transport          DECIMAL(10,2),
    comprador_escorxador    VARCHAR(255),
    -- Camps de mort
    causa_mort              VARCHAR(255),
    codi_recollida_cadavers VARCHAR(100),
    -- Auditoria
    registrat_per           INTEGER         REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    -- Validacions de negoci
    CONSTRAINT baixa_venda_check CHECK (
        motiu != 'Venda' OR (pes_viu_kg IS NOT NULL AND preu_kg IS NOT NULL)
    ),
    CONSTRAINT baixa_mort_check CHECK (
        motiu != 'Mort' OR (causa_mort IS NOT NULL AND codi_recollida_cadavers IS NOT NULL)
    )
);

CREATE INDEX idx_baixes_animal ON baixes(animal_id);
CREATE INDEX idx_baixes_motiu  ON baixes(motiu);
CREATE INDEX idx_baixes_data   ON baixes(data_baixa DESC);

COMMENT ON COLUMN baixes.codi_recollida_cadavers IS
    'Obligatori per a morts. Número de bitllet de l''empresa de retirada de cadàvers. Necessari per a DARP i assegurança.';


-- ----------------------------------------------------------------
-- Configuració general del tenant
-- ----------------------------------------------------------------

CREATE TABLE configuracio_general (
    id                        SERIAL PRIMARY KEY,
    estoc_minim_default_kg    DECIMAL(12,2) NOT NULL DEFAULT 500,
    estoc_minim_default_tones DECIMAL(12,3) NOT NULL DEFAULT 1,
    creat_el                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    actualitzat_el            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT un_sol_registre CHECK (id = 1)
);

INSERT INTO configuracio_general (id) VALUES (1);

COMMENT ON TABLE configuracio_general IS
    'Sempre exactament una fila per tenant. Valors de fallback per a magatzems sense estoc mínim específic.';


-- ----------------------------------------------------------------
-- Presets de llet en pols (vedells mamons)
-- ----------------------------------------------------------------

CREATE TABLE presets_llet_pols (
    id                  SERIAL PRIMARY KEY,
    nom                 VARCHAR(100)  NOT NULL,
    preu_compra_sac_kg  DECIMAL(10,4) NOT NULL,
    dosi_standard_g_dia DECIMAL(10,2) NOT NULL,
    preu_repercutit_dia DECIMAL(10,4) GENERATED ALWAYS AS
                        ((dosi_standard_g_dia / 1000.0) * preu_compra_sac_kg) STORED,
    actiu               BOOLEAN       NOT NULL DEFAULT TRUE,
    creat_el            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    -- Sense actualitzat_el: un preset no es modifica mai, se'n crea un de nou
);

COMMENT ON TABLE presets_llet_pols IS
    'Un preset no es modifica: quan canvia el preu es crea un preset nou i l''anterior es marca actiu=FALSE.';
COMMENT ON COLUMN presets_llet_pols.preu_repercutit_dia IS
    'Camp calculat automàticament: (dosi_standard_g_dia / 1000) * preu_compra_sac_kg. Cost diari per vedell.';


-- ================================================================
-- BLOC 4 — TRIGGERS
-- ================================================================

-- ----------------------------------------------------------------
-- T1: updated_at automàtic per a les taules del schema tenant
-- (Els triggers de public.tenants i public.users ja es creen
--  a 01_schema_public.sql — no es repeteixen aquí)
-- ----------------------------------------------------------------

CREATE TRIGGER trg_sitges_updated_at
    BEFORE UPDATE ON sitges
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_magatzems_updated_at
    BEFORE UPDATE ON magatzems_farratge
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_animals_updated_at
    BEFORE UPDATE ON animals
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_medicaments_updated_at
    BEFORE UPDATE ON medicaments
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_configuracio_updated_at
    BEFORE UPDATE ON configuracio_general
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


-- ----------------------------------------------------------------
-- T2: Validació que una CORT pertany a una zona NAU_ANIMALS
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_valida_zona_cort()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_tipus tipus_zona_enum;
BEGIN
    SELECT tipus_zona INTO v_tipus
    FROM zones_infraestructura
    WHERE id = NEW.zona_id;

    IF v_tipus IS DISTINCT FROM 'NAU_ANIMALS' THEN
        RAISE EXCEPTION
            'La zona_id % té tipus "%". Una cort només pot pertànyer a una zona de tipus NAU_ANIMALS.',
            NEW.zona_id, v_tipus;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_corts_valida_zona
    BEFORE INSERT OR UPDATE OF zona_id ON corts
    FOR EACH ROW EXECUTE FUNCTION fn_valida_zona_cort();


-- ----------------------------------------------------------------
-- T3: Validació que un MAGATZEM pertany a una zona COBERT_EMMAGATZEMATGE
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_valida_zona_magatzem()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_tipus tipus_zona_enum;
BEGIN
    SELECT tipus_zona INTO v_tipus
    FROM zones_infraestructura
    WHERE id = NEW.zona_id;

    IF v_tipus IS DISTINCT FROM 'COBERT_EMMAGATZEMATGE' THEN
        RAISE EXCEPTION
            'La zona_id % té tipus "%". Un magatzem de farratge només pot pertànyer a una zona de tipus COBERT_EMMAGATZEMATGE.',
            NEW.zona_id, v_tipus;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_magatzems_valida_zona
    BEFORE INSERT OR UPDATE OF zona_id ON magatzems_farratge
    FOR EACH ROW EXECUTE FUNCTION fn_valida_zona_magatzem();


-- ----------------------------------------------------------------
-- T4: Càlcul automàtic de data_alliberament en INSERT de tractament
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_calcula_data_alliberament()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_dies_supressio INTEGER;
BEGIN
    SELECT dies_supressio INTO v_dies_supressio
    FROM medicaments
    WHERE id = NEW.medicament_id;

    NEW.data_alliberament := NEW.data_inici + v_dies_supressio;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tractaments_alliberament
    BEFORE INSERT ON tractaments
    FOR EACH ROW EXECUTE FUNCTION fn_calcula_data_alliberament();

COMMENT ON FUNCTION fn_calcula_data_alliberament() IS
    'Calcula data_alliberament = data_inici + dies_supressio del medicament. Si dies_supressio=0, data_alliberament = data_inici (sense bloqueig).';


-- ----------------------------------------------------------------
-- T5: Historial automàtic de canvis d'estat de salut
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_registra_canvi_estat_salut()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    -- Només registra si l'estat de salut ha canviat realment
    IF NEW.estat_salut IS DISTINCT FROM OLD.estat_salut THEN
        INSERT INTO historial_estat_salut (
            animal_id,
            estat_antic,
            estat_nou,
            canviat_el
        ) VALUES (
            NEW.id,
            OLD.estat_salut,
            NEW.estat_salut,
            NOW()
        );
        -- Nota: canviat_per s'ha d'informar des de l'aplicació via
        -- UPDATE animals SET estat_salut=X, _canviat_per=Y
        -- o bé l'aplicació insereix directament a historial_estat_salut
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_animals_historial_salut
    BEFORE UPDATE OF estat_salut ON animals
    FOR EACH ROW EXECUTE FUNCTION fn_registra_canvi_estat_salut();

COMMENT ON FUNCTION fn_registra_canvi_estat_salut() IS
    'Insereix automàticament un registre a historial_estat_salut quan canvia l''estat_salut d''un animal. El camp canviat_per s''ha d''informar des de la capa d''aplicació.';


-- ================================================================
-- BLOC 5 — VISTES
-- ================================================================

-- Vista: animals actius amb distribució actual
CREATE VIEW v_animals_actius AS
SELECT
    a.id,
    a.crotal_id,
    a.dib,
    r.nom_raca,
    a.data_naixement,
    a.estat_salut,
    a.sexe,
    l.nom_lot,
    c.codi_cort,
    z.nom  AS nom_zona,
    da.data_entrada,
    -- Edat calculada en dies (útil per a GMD i informes)
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


-- Vista: animals en període de supressió (bloqueig comercial actiu)
CREATE VIEW v_animals_en_supressio AS
SELECT
    a.id          AS animal_id,
    a.crotal_id,
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


-- Vista: estoc actual de magatzems amb estat d'alerta
CREATE VIEW v_estoc_magatzems AS
SELECT
    'sitja'            AS tipus,
    s.id,
    s.nom,
    s.tipus_pinso      AS tipus_producte,
    s.estoc_actual_kg  AS estoc_actual,
    'kg'               AS unitat,
    s.capacitat_kg     AS capacitat,
    COALESCE(s.estoc_minim_kg, cg.estoc_minim_default_kg) AS estoc_minim_efectiu,
    s.estat,
    CASE
        WHEN s.estoc_actual_kg = 0                                                          THEN 'ESGOTAT'
        WHEN s.estoc_actual_kg <= COALESCE(s.estoc_minim_kg, cg.estoc_minim_default_kg)    THEN 'BAIX'
        ELSE 'NORMAL'
    END AS estat_alerta
FROM sitges s
CROSS JOIN configuracio_general cg

UNION ALL

SELECT
    'magatzem'              AS tipus,
    mf.id,
    mf.tipus_farratge       AS nom,
    mf.tipus_farratge       AS tipus_producte,
    mf.estoc_actual_tones   AS estoc_actual,
    'tones'                 AS unitat,
    mf.capacitat_maxima_tones AS capacitat,
    COALESCE(mf.estoc_minim_tones, cg.estoc_minim_default_tones) AS estoc_minim_efectiu,
    mf.estat,
    CASE
        WHEN mf.estoc_actual_tones = 0                                                                  THEN 'ESGOTAT'
        WHEN mf.estoc_actual_tones <= COALESCE(mf.estoc_minim_tones, cg.estoc_minim_default_tones)     THEN 'BAIX'
        ELSE 'NORMAL'
    END AS estat_alerta
FROM magatzems_farratge mf
CROSS JOIN configuracio_general cg;

COMMENT ON VIEW v_estoc_magatzems IS
    'Vista unificada de sitges i magatzems amb estat d''alerta calculat (NORMAL/BAIX/ESGOTAT). Aplica el llindar específic o el global per defecte.';


-- ================================================================
-- BLOC 6 — DADES INICIALS: Races globals precarregades
-- S'insereixen en crear cada schema tenant
-- ================================================================

INSERT INTO races_cataleg (nom_raca, es_global) VALUES
    -- Races de carn
    ('Limousin',              TRUE),
    ('Charolais',             TRUE),
    ('Blonde d''Aquitaine',   TRUE),
    ('Angus',                 TRUE),
    ('Hereford',              TRUE),
    ('Simmental',             TRUE),
    ('Bruna dels Pirineus',   TRUE),
    ('Pirenaica',             TRUE),
    ('Asturiana de los Valles', TRUE),
    ('Retinta',               TRUE),
    -- Races lleters
    ('Frisona / Holstein',    TRUE),
    ('Bruna Alpina',          TRUE),
    ('Parda de Muntanya',     TRUE),
    ('Jersey',                TRUE),
    ('Montbéliarde',          TRUE),
    -- Races doble aptitud
    ('Fleckvieh',             TRUE),
    ('Normanda',              TRUE)
ON CONFLICT (nom_raca) DO NOTHING;

COMMENT ON TABLE races_cataleg IS
    'Precarregat amb 17 races estàndard (es_global=TRUE). El tenant pot afegir races pròpies (es_global=FALSE).';


-- ================================================================
-- BLOC 7 — ROW LEVEL SECURITY (RLS)
-- Bloqueja tot accés directe via API REST de Supabase (anon /
-- authenticated). El rol de connexió directa del backend (postgres
-- o rol propietari) NO queda afectat per RLS a PostgreSQL.
-- ================================================================

-- Infraestructura física
ALTER TABLE ubicacions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones_infraestructura   ENABLE ROW LEVEL SECURITY;
ALTER TABLE corts                   ENABLE ROW LEVEL SECURITY;

-- Emmagatzematge d'aliments
ALTER TABLE sitges                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE magatzems_farratge      ENABLE ROW LEVEL SECURITY;

-- Animals
ALTER TABLE races_cataleg           ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_estat_salut   ENABLE ROW LEVEL SECURITY;
ALTER TABLE distribucio_animals     ENABLE ROW LEVEL SECURITY;

-- Registres de producció
ALTER TABLE registre_pes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE registre_llet           ENABLE ROW LEVEL SECURITY;

-- Logística d'alimentació
ALTER TABLE consums_pinso_nau       ENABLE ROW LEVEL SECURITY;
ALTER TABLE moviments_farratge      ENABLE ROW LEVEL SECURITY;

-- Mòdul sanitari
ALTER TABLE medicaments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tractaments             ENABLE ROW LEVEL SECURITY;

-- Baixes i configuració
ALTER TABLE baixes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracio_general    ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets_llet_pols       ENABLE ROW LEVEL SECURITY;


-- ================================================================
-- ÚLTIM PAS — Restaurar search_path i registrar el tenant
-- ================================================================

-- Restaura el search_path per defecte
SET search_path TO public;

-- Registra aquest tenant a la taula global (ajusta les dades reals)
-- Descomenta i edita la línia següent:
-- INSERT INTO public.tenants (nom_empresa, tipus_explotacio, schema_name)
-- VALUES ('Nom de la Granja de Prova', 'Engreix', 'tenant_00001');

-- ================================================================
-- FI DEL SCHEMA TENANT
-- ================================================================
