# 02 — Model de Dades (DDL PostgreSQL)

> **Versió:** 2.0.0  
> **Última actualització:** Juny de 2026  
> **Motor:** PostgreSQL 16+  
> **Hosting:** Supabase (PostgreSQL gestionat)

---

## 0. Ordre d'Execució dels Fitxers SQL

Tots els scripts SQL es troben a la carpeta `database/` del repositori.

| Ordre | Fitxer | Quan executar |
|-------|--------|--------------|
| 1 | [`database/01_schema_public.sql`](../database/01_schema_public.sql) | Una sola vegada en crear la plataforma |
| 2 | [`database/03_rls_public.sql`](../database/03_rls_public.sql) | Una sola vegada, just després del punt 1 |
| 3 | [`database/04_schema_login_attempts.sql`](../database/04_schema_login_attempts.sql) | Una sola vegada — taula de rate limiting del login |
| 4 | [`database/02_schema_tenant_template.sql`](../database/02_schema_tenant_template.sql) | Una vegada per cada client nou (ja inclou RLS de les 19 taules) |

**Fitxers d'utilitat** (no formen part del desplegament normal):

| Fitxer | Ús |
|--------|-----|
| [`database/00_neteja_reintent.sql`](../database/00_neteja_reintent.sql) | Esborra un tenant per reintentar l'execució des de zero |
| [`database/verificar_extensio.sql`](../database/verificar_extensio.sql) | Comprova a quin schema està instal·lada l'extensió `pg_trgm` |

> **Fitxers eliminats:** `database_schema.sql` i `03_rls_tenant.sql` eren versions intermèdies del disseny, substituïdes pels fitxers anteriors. No han d'existir al repositori.

---

## 0b. ⚠️ Nota Crítica sobre l'Accés a la Base de Dades

Aquest projecte usa **Supabase únicament com a infraestructura de PostgreSQL** (hosting, backups automàtics, monitorització), **NO com a backend-as-a-service amb PostgREST**.

**Motiu:** El model de schema per tenant (secció 1) requereix executar `SET search_path TO tenant_XXXXX` de forma dinàmica per cada petició, segons l'usuari autenticat. L'API automàtica de Supabase (PostgREST) només exposa el schema `public` per defecte i no està pensada per a aquest patró amb schemas dinàmics il·limitats.

**Implicacions per a la implementació:**

| Element | Decisió |
|---------|---------|
| Connexió a la BD | El **backend propi** es connecta amb la connection string PostgreSQL directa de Supabase (host, port, usuari, contrasenya), usant un client SQL estàndard |
| API REST de Supabase (PostgREST) | **No s'utilitza** |
| Claus `anon` / `service_role` de Supabase | **No s'utilitzen** al frontend |
| Frontend | Mai es connecta directament a Supabase; totes les peticions passen pel backend propi |
| Row Level Security (RLS) | Es manté com a **capa addicional de defensa** (secció 4 de `03_multitenancy.md`), però **no és l'única barrera** perquè el backend ja filtra per `search_path` abans d'executar cap query |

> Vegeu també la nota equivalent a [`README.md`](../README.md).

---

## 1. Estructura de Schemas

```
postgres (instància)
├── public                  ← Schema global: tenants i usuaris
│   ├── tenants
│   ├── users
│   └── audit_log
├── tenant_00001            ← Schema del client 1 (granja "Mas Vell")
│   ├── configuracio_general
│   ├── ubicacions
│   ├── zones_infraestructura
│   ├── corts
│   ├── sitges
│   ├── magatzems_farratge
│   ├── races_cataleg
│   ├── lots
│   ├── animals
│   ├── historial_estat_salut   ← NOU
│   ├── distribucio_animals
│   ├── registre_pes
│   ├── registre_llet
│   ├── consums_pinso_nau
│   ├── moviments_farratge
│   ├── medicaments
│   ├── tractaments
│   ├── baixes
│   └── presets_llet_pols
├── tenant_00002
│   └── (mateixa estructura)
└── ...
```

---

## 2. Canvis respecte a la versió 1.0.0

| # | Problema / Millora | Solució aplicada |
|---|-------------------|-----------------|
| 1 | `CHECK` amb subquery no suportat per PostgreSQL | Substituït per triggers `BEFORE INSERT OR UPDATE` |
| 2 | `data_alliberament` es calculava manualment | Trigger `BEFORE INSERT` calcula `data_inici + dies_supressio` |
| 3 | `estat_salut` es sobreescrivia sense historial | Nova taula `historial_estat_salut` + trigger |
| 4 | `races_cataleg` buida en arrrancar | `INSERT` de races globals estàndard precargades |
| 5 | Cerca de crotal sense índex optimitzat | Índex `GIN` + `pg_trgm` per a cerca parcial en temps real |
| 6 | `actualitzat_el` s'actualitzava manualment | Funció `set_updated_at()` + triggers en totes les taules |
| 7 | `actualitzat_el` innecessari a `presets_llet_pols` | Eliminat (els presets no es modifiquen, se'n creen de nous) |

---

## 3. Schema Públic

```sql
-- ============================================================
-- EXTENSIONS (executar una sola vegada per instància)
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- Cerca de text parcial (trigrams)

-- ============================================================
-- SCHEMA PÚBLIC: Dades globals del SaaS
-- ============================================================

CREATE TYPE tipus_explotacio_enum AS ENUM ('Llet', 'Engreix', 'Extensiu');
CREATE TYPE rol_usuari_enum       AS ENUM ('Admin', 'Veterinari', 'Treballador');

-- ------------------------------------------------------------
-- Funció genèrica per actualitzar updated_at automàticament
-- S'associa com a trigger a totes les taules que el necessiten
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualitzat_el = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Taula: tenants
-- ------------------------------------------------------------
CREATE TABLE public.tenants (
    id               SERIAL PRIMARY KEY,
    nom_empresa      VARCHAR(255) NOT NULL,
    tipus_explotacio tipus_explotacio_enum NOT NULL,
    schema_name      VARCHAR(63)  NOT NULL UNIQUE,
    actiu            BOOLEAN      NOT NULL DEFAULT TRUE,
    creat_el         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualitzat_el   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.tenants IS
    'Registre de clients (granges) de la plataforma SaaS. Cada fila correspon a un schema PostgreSQL independent.';
COMMENT ON COLUMN public.tenants.schema_name IS
    'Nom del schema PostgreSQL per a aquest tenant. Format: tenant_XXXXX. Màxim 63 caràcters (límit PostgreSQL).';

-- ------------------------------------------------------------
-- Taula: users
-- ------------------------------------------------------------
CREATE TABLE public.users (
    id             SERIAL PRIMARY KEY,
    tenant_id      INTEGER      NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    nom            VARCHAR(255) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    rol            rol_usuari_enum NOT NULL,
    actiu          BOOLEAN      NOT NULL DEFAULT TRUE,
    darrer_acces   TIMESTAMPTZ,
    creat_el       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    actualitzat_el TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_users_email     ON public.users(email);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.users.password_hash IS
    'Hash de la contrasenya. Obligatori bcrypt amb cost factor >= 12. Mai emmagatzemar la contrasenya en clar.';
COMMENT ON COLUMN public.users.rol IS
    'Admin: accés total. Veterinari: mòdul sanitari i animals. Treballador: registre diari.';

-- ------------------------------------------------------------
-- Taula: audit_log
-- ------------------------------------------------------------
CREATE TABLE public.audit_log (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      INTEGER REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id        INTEGER REFERENCES public.users(id)   ON DELETE SET NULL,
    accio          VARCHAR(100) NOT NULL,
    taula_afectada VARCHAR(100),
    registre_id    INTEGER,
    dades_json     JSONB,
    ip_origen      INET,
    creat_el       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON public.audit_log(tenant_id, creat_el DESC);
CREATE INDEX idx_audit_user   ON public.audit_log(user_id,   creat_el DESC);

COMMENT ON TABLE public.audit_log IS
    'Registre immutable d''accions crítiques. Retenció mínima: 5 anys. No es permet UPDATE ni DELETE sobre aquesta taula.';
```

---

## 4. Schema Tenant (plantilla aplicada a cada `tenant_XXXXX`)

```sql
-- ============================================================
-- SCHEMA TENANT — executar amb: SET search_path TO tenant_XXXXX;
-- ============================================================

-- ------------------------------------------------------------
-- Tipus enumerats
-- ------------------------------------------------------------
CREATE TYPE tipus_zona_enum     AS ENUM ('NAU_ANIMALS', 'COBERT_EMMAGATZEMATGE', 'PASTURA');
CREATE TYPE estat_salut_enum    AS ENUM ('Sa', 'En tractament', 'Observació', 'Crític');
CREATE TYPE sexe_enum           AS ENUM ('Mascle', 'Femella');
CREATE TYPE motiu_baixa_enum    AS ENUM ('Venda', 'Mort');
CREATE TYPE unitat_mesura_enum  AS ENUM ('kg', 'Tones', 'Unitats');
CREATE TYPE estat_magatzem_enum AS ENUM ('Actiu', 'Deshabilitat');

-- ------------------------------------------------------------
-- Funció updated_at per al schema tenant
-- (còpia local: cada schema té els seus propis triggers)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualitzat_el = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- INFRAESTRUCTURA FÍSICA
-- ============================================================

CREATE TABLE ubicacions (
    id                    SERIAL PRIMARY KEY,
    nom                   VARCHAR(255) NOT NULL,
    codi_pastura_extensiu VARCHAR(50),
    creat_el              TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE zones_infraestructura (
    id          SERIAL PRIMARY KEY,
    ubicacio_id INTEGER      NOT NULL REFERENCES ubicacions(id) ON DELETE RESTRICT,
    nom         VARCHAR(255) NOT NULL,
    tipus_zona  tipus_zona_enum NOT NULL,
    creat_el    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zones_ubicacio ON zones_infraestructura(ubicacio_id);

-- ------------------------------------------------------------
-- Taula: corts
-- Restricció de zona: trigger substitueix el CHECK amb subquery
-- ------------------------------------------------------------
CREATE TABLE corts (
    id               SERIAL PRIMARY KEY,
    zona_id          INTEGER     NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    codi_cort        VARCHAR(50) NOT NULL,
    capacitat_maxima INTEGER,
    creat_el         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION trg_fn_corts_zona_tipus()
RETURNS TRIGGER AS $$
DECLARE
    v_tipus tipus_zona_enum;
BEGIN
    SELECT tipus_zona INTO v_tipus
    FROM zones_infraestructura
    WHERE id = NEW.zona_id;

    IF v_tipus IS DISTINCT FROM 'NAU_ANIMALS' THEN
        RAISE EXCEPTION
            'La zona % no és de tipus NAU_ANIMALS (és %). Una cort només pot pertànyer a una nau d''animals.',
            NEW.zona_id, v_tipus;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_corts_zona_tipus
    BEFORE INSERT OR UPDATE OF zona_id ON corts
    FOR EACH ROW EXECUTE FUNCTION trg_fn_corts_zona_tipus();

-- ============================================================
-- EMMAGATZEMATGE D'ALIMENTS
-- ============================================================

CREATE TABLE sitges (
    id              SERIAL PRIMARY KEY,
    ubicacio_id     INTEGER        NOT NULL REFERENCES ubicacions(id) ON DELETE RESTRICT,
    nom             VARCHAR(255)   NOT NULL,
    capacitat_kg    DECIMAL(12,2),
    estoc_actual_kg DECIMAL(12,2)  NOT NULL DEFAULT 0,
    tipus_pinso     VARCHAR(100),
    estoc_minim_kg  DECIMAL(12,2),
    estat           estat_magatzem_enum NOT NULL DEFAULT 'Actiu',
    creat_el        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    actualitzat_el  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT sitges_estoc_positiu CHECK (estoc_actual_kg >= 0)
);

CREATE TRIGGER trg_sitges_updated_at
    BEFORE UPDATE ON sitges
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN sitges.estoc_minim_kg IS
    'Llindar d''alerta d''estoc mínim. Si NULL, hereta el valor de configuracio_general.estoc_minim_default_kg.';

-- ------------------------------------------------------------
-- Taula: magatzems_farratge
-- Restricció de zona: trigger substitueix el CHECK amb subquery
-- ------------------------------------------------------------
CREATE TABLE magatzems_farratge (
    id                     SERIAL PRIMARY KEY,
    zona_id                INTEGER        NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    tipus_farratge         VARCHAR(100)   NOT NULL,
    estoc_actual_tones     DECIMAL(12,3)  NOT NULL DEFAULT 0,
    capacitat_maxima_tones DECIMAL(12,3),
    pes_mitja_bala_kg      DECIMAL(8,2),
    estoc_minim_tones      DECIMAL(12,3),
    estat                  estat_magatzem_enum NOT NULL DEFAULT 'Actiu',
    creat_el               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    actualitzat_el         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    CONSTRAINT magatzem_estoc_positiu CHECK (estoc_actual_tones >= 0)
);

CREATE TRIGGER trg_magatzems_updated_at
    BEFORE UPDATE ON magatzems_farratge
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN magatzems_farratge.pes_mitja_bala_kg IS
    'Pes mitjà en kg per bala. Necessari quan la unitat de consum és "Unitats" (bales).';
COMMENT ON COLUMN magatzems_farratge.estoc_minim_tones IS
    'Llindar d''alerta. Si NULL, hereta configuracio_general.estoc_minim_default_tones.';

CREATE OR REPLACE FUNCTION trg_fn_magatzem_zona_tipus()
RETURNS TRIGGER AS $$
DECLARE
    v_tipus tipus_zona_enum;
BEGIN
    SELECT tipus_zona INTO v_tipus
    FROM zones_infraestructura
    WHERE id = NEW.zona_id;

    IF v_tipus IS DISTINCT FROM 'COBERT_EMMAGATZEMATGE' THEN
        RAISE EXCEPTION
            'La zona % no és de tipus COBERT_EMMAGATZEMATGE (és %). Un magatzem de farratge només pot estar en un cobert d''emmagatzematge.',
            NEW.zona_id, v_tipus;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_magatzem_zona_tipus
    BEFORE INSERT OR UPDATE OF zona_id ON magatzems_farratge
    FOR EACH ROW EXECUTE FUNCTION trg_fn_magatzem_zona_tipus();

-- ============================================================
-- ANIMALS: CATÀLEG DE RACES, LOTS, FITXA
-- ============================================================

-- ------------------------------------------------------------
-- Taula: races_cataleg (amb races globals precargades)
-- ------------------------------------------------------------
CREATE TABLE races_cataleg (
    id        SERIAL PRIMARY KEY,
    nom_raca  VARCHAR(100) NOT NULL,
    es_global BOOLEAN      NOT NULL DEFAULT FALSE,
    creat_el  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT races_nom_unic UNIQUE (nom_raca)
);

COMMENT ON COLUMN races_cataleg.es_global IS
    'TRUE = raça estàndard precargada (no eliminable). FALSE = raça personalitzada per aquest tenant.';

-- Races globals precargades
INSERT INTO races_cataleg (nom_raca, es_global) VALUES
    ('Frisona',          TRUE),
    ('Bruna dels Pirineus', TRUE),
    ('Bruna Alpina',     TRUE),
    ('Limousin',         TRUE),
    ('Charolais',        TRUE),
    ('Blonde d''Aquitaine', TRUE),
    ('Simmental',        TRUE),
    ('Aubrac',           TRUE),
    ('Angus',            TRUE),
    ('Hereford',         TRUE),
    ('Pirenaica',        TRUE),
    ('Asturiana de los Valles', TRUE),
    ('Morucha',          TRUE),
    ('Retinta',          TRUE),
    ('Tudanca',          TRUE);

CREATE TABLE lots (
    id           SERIAL PRIMARY KEY,
    nom_lot      VARCHAR(100) NOT NULL,
    data_creacio DATE         NOT NULL DEFAULT CURRENT_DATE,
    creat_el     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Taula: animals
-- ------------------------------------------------------------
CREATE TABLE animals (
    id             SERIAL PRIMARY KEY,
    dib            VARCHAR(50) NOT NULL UNIQUE,
    raca_id        INTEGER REFERENCES races_cataleg(id) ON DELETE SET NULL,
    data_naixement DATE,
    estat_salut    estat_salut_enum NOT NULL DEFAULT 'Sa',
    sexe           sexe_enum,
    estat_actiu    BOOLEAN     NOT NULL DEFAULT TRUE,
    creat_el       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índex estàndard
CREATE INDEX idx_animals_actiu ON animals(estat_actiu);
CREATE INDEX idx_animals_raca  ON animals(raca_id);

-- Índex GIN per a cerca parcial pel DIB en temps real (pg_trgm)
CREATE INDEX idx_animals_dib_trgm ON animals USING GIN (dib gin_trgm_ops);

CREATE TRIGGER trg_animals_updated_at
    BEFORE UPDATE ON animals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN animals.dib IS
    'Identificador oficial únic de l''animal (Document d''Identificació Bovina). El crotal físic a l''orella porta el mateix número — no és un camp separat.';
COMMENT ON COLUMN animals.estat_actiu IS
    'Mai s''esborra un animal. estat_actiu=FALSE indica baixa per venda o mort. Historial sempre preservat.';
COMMENT ON INDEX idx_animals_dib_trgm IS
    'Índex GIN per a cerca parcial (LIKE %text%) en temps real sobre dib. Requereix extensió pg_trgm.';

-- ------------------------------------------------------------
-- Taula: historial_estat_salut  [NOU]
-- Registra cada canvi d'estat de salut per garantir traçabilitat
-- ------------------------------------------------------------
CREATE TABLE historial_estat_salut (
    id              SERIAL PRIMARY KEY,
    animal_id       INTEGER          NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    estat_anterior  estat_salut_enum,
    estat_nou       estat_salut_enum NOT NULL,
    canviat_per     INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el        TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_historial_salut_animal ON historial_estat_salut(animal_id, creat_el DESC);

COMMENT ON TABLE historial_estat_salut IS
    'Registre immutable de tots els canvis d''estat de salut d''un animal. S''omple automàticament via trigger.';

-- Trigger: captura automàticament cada canvi d'estat_salut a animals
CREATE OR REPLACE FUNCTION trg_fn_historial_estat_salut()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estat_salut IS DISTINCT FROM OLD.estat_salut THEN
        INSERT INTO historial_estat_salut (animal_id, estat_anterior, estat_nou)
        VALUES (NEW.id, OLD.estat_salut, NEW.estat_salut);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_animals_historial_salut
    AFTER UPDATE OF estat_salut ON animals
    FOR EACH ROW EXECUTE FUNCTION trg_fn_historial_estat_salut();

-- ------------------------------------------------------------
-- Taula: distribucio_animals
-- ------------------------------------------------------------
CREATE TABLE distribucio_animals (
    id           SERIAL PRIMARY KEY,
    animal_id    INTEGER     NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    lot_id       INTEGER     REFERENCES lots(id)  ON DELETE SET NULL,
    cort_id      INTEGER     REFERENCES corts(id) ON DELETE SET NULL,
    data_entrada DATE        NOT NULL DEFAULT CURRENT_DATE,
    data_sortida DATE,
    creat_el     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT distribucio_dates_check CHECK (data_sortida IS NULL OR data_sortida >= data_entrada)
);

CREATE INDEX idx_distribucio_animal ON distribucio_animals(animal_id);
CREATE INDEX idx_distribucio_lot    ON distribucio_animals(lot_id);
CREATE INDEX idx_distribucio_activa ON distribucio_animals(animal_id) WHERE data_sortida IS NULL;

-- ============================================================
-- REGISTRES DE PRODUCCIÓ
-- ============================================================

CREATE TABLE registre_pes (
    id            SERIAL PRIMARY KEY,
    animal_id     INTEGER       NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    data          DATE          NOT NULL,
    pes_kg        DECIMAL(8,2)  NOT NULL,
    registrat_per INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT pes_positiu CHECK (pes_kg > 0)
);

CREATE INDEX idx_pes_animal_data ON registre_pes(animal_id, data DESC);

CREATE TABLE registre_llet (
    id            SERIAL PRIMARY KEY,
    animal_id     INTEGER      NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    data          DATE         NOT NULL,
    litres        DECIMAL(8,2) NOT NULL,
    registrat_per INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT litres_positius CHECK (litres >= 0)
);

CREATE INDEX idx_llet_animal_data ON registre_llet(animal_id, data DESC);

-- ============================================================
-- LOGÍSTICA D'ALIMENTACIÓ
-- ============================================================

CREATE TABLE consums_pinso_nau (
    id            SERIAL PRIMARY KEY,
    zona_id       INTEGER       NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    sitge_id      INTEGER       NOT NULL REFERENCES sitges(id) ON DELETE RESTRICT,
    data          DATE          NOT NULL,
    kg_consumits  DECIMAL(10,2) NOT NULL,
    registrat_per INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT kg_positius CHECK (kg_consumits > 0)
);

CREATE INDEX idx_consums_pinso_data ON consums_pinso_nau(data DESC);

CREATE TABLE moviments_farratge (
    id                SERIAL PRIMARY KEY,
    magatzem_id       INTEGER       NOT NULL REFERENCES magatzems_farratge(id) ON DELETE RESTRICT,
    zona_desti_id     INTEGER       NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    data              DATE          NOT NULL,
    quantitat         DECIMAL(12,3) NOT NULL,
    unitat            unitat_mesura_enum NOT NULL,
    quantitat_kg_real DECIMAL(12,3) NOT NULL,
    registrat_per     INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT quantitat_positiva CHECK (quantitat > 0)
);

CREATE INDEX idx_moviments_farratge_data ON moviments_farratge(data DESC);

COMMENT ON COLUMN moviments_farratge.quantitat_kg_real IS
    'Equivalent en kg calculat en el moment del registre. Si unitat=Unitats: quantitat × pes_mitja_bala_kg del magatzem.';

-- ============================================================
-- MÒDUL SANITARI
-- ============================================================

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

CREATE TRIGGER trg_medicaments_updated_at
    BEFORE UPDATE ON medicaments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN medicaments.dies_supressio IS
    'Dies d''espera obligatoris abans de vendre l''animal tractat. El sistema bloqueja comercialment l''animal durant aquest període.';

-- ------------------------------------------------------------
-- Taula: tractaments
-- data_alliberament es calcula automàticament via trigger
-- ------------------------------------------------------------
CREATE TABLE tractaments (
    id                SERIAL PRIMARY KEY,
    animal_id         INTEGER      NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    medicament_id     INTEGER      NOT NULL REFERENCES medicaments(id) ON DELETE RESTRICT,
    data_inici        DATE         NOT NULL,
    data_fi_prevista  DATE,
    data_fi_real      DATE,
    dosi_aplicada     DECIMAL(10,3),
    unitat_dosi       VARCHAR(20),
    data_alliberament DATE,        -- calculat automàticament pel trigger
    notes             TEXT,
    aplicat_per       INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT tractament_dates_check CHECK (data_fi_prevista IS NULL OR data_fi_prevista >= data_inici)
);

CREATE INDEX idx_tractaments_animal       ON tractaments(animal_id);
CREATE INDEX idx_tractaments_alliberament ON tractaments(data_alliberament)
    WHERE data_alliberament IS NOT NULL;

COMMENT ON COLUMN tractaments.data_alliberament IS
    'Data a partir de la qual l''animal pot ser comercialitzat. Calculada automàticament: data_inici + dies_supressio del medicament.';

-- Trigger: calcula data_alliberament en inserir un tractament
CREATE OR REPLACE FUNCTION trg_fn_tractament_alliberament()
RETURNS TRIGGER AS $$
DECLARE
    v_dies INTEGER;
BEGIN
    SELECT dies_supressio INTO v_dies
    FROM medicaments
    WHERE id = NEW.medicament_id;

    NEW.data_alliberament := NEW.data_inici + v_dies;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tractament_alliberament
    BEFORE INSERT ON tractaments
    FOR EACH ROW EXECUTE FUNCTION trg_fn_tractament_alliberament();

-- ============================================================
-- BAIXES (VENDES I MORTS)
-- ============================================================

CREATE TABLE baixes (
    id                      SERIAL PRIMARY KEY,
    animal_id               INTEGER      NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    motiu                   motiu_baixa_enum NOT NULL,
    data_baixa              DATE         NOT NULL,
    -- Camps específics de venda
    pes_viu_kg              DECIMAL(8,2),
    pes_canal_kg            DECIMAL(8,2),
    preu_kg                 DECIMAL(8,2),
    cost_transport          DECIMAL(10,2),
    comprador_escorxador    VARCHAR(255),
    -- Camps específics de mort
    causa_mort              VARCHAR(255),
    codi_recollida_cadavers VARCHAR(100),
    -- Auditoria
    registrat_per           INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT baixa_venda_check CHECK (
        motiu != 'Venda' OR (pes_viu_kg IS NOT NULL AND preu_kg IS NOT NULL)
    ),
    CONSTRAINT baixa_mort_check CHECK (
        motiu != 'Mort' OR codi_recollida_cadavers IS NOT NULL
    )
);

CREATE INDEX idx_baixes_animal ON baixes(animal_id);
CREATE INDEX idx_baixes_motiu  ON baixes(motiu);
CREATE INDEX idx_baixes_data   ON baixes(data_baixa DESC);

COMMENT ON COLUMN baixes.codi_recollida_cadavers IS
    'Obligatori per a baixes per mort. Número de bitllet de l''empresa de retirada de cadàvers. Necessari per a DARP i assegurança.';

-- ============================================================
-- CONFIGURACIÓ GENERAL DEL TENANT
-- ============================================================

CREATE TABLE configuracio_general (
    id                        SERIAL PRIMARY KEY,
    estoc_minim_default_kg    DECIMAL(12,2) DEFAULT 500,
    estoc_minim_default_tones DECIMAL(12,3) DEFAULT 1,
    creat_el                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    actualitzat_el            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT un_sol_registre CHECK (id = 1)
);

CREATE TRIGGER trg_configuracio_updated_at
    BEFORE UPDATE ON configuracio_general
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO configuracio_general (id) VALUES (1);

COMMENT ON TABLE configuracio_general IS
    'Configuració global del tenant. Sempre exactament una fila. Valors de fallback per a magatzems sense mínim específic.';

-- ============================================================
-- PRESETS DE LLET EN POLS (VEDELLS MAMONS)
-- ============================================================

CREATE TABLE presets_llet_pols (
    id                  SERIAL PRIMARY KEY,
    nom                 VARCHAR(100)  NOT NULL,
    preu_compra_sac_kg  DECIMAL(10,4) NOT NULL,
    dosi_standard_g_dia DECIMAL(10,2) NOT NULL,
    preu_repercutit_dia DECIMAL(10,4) GENERATED ALWAYS AS
                        ((dosi_standard_g_dia / 1000) * preu_compra_sac_kg) STORED,
    actiu               BOOLEAN       NOT NULL DEFAULT TRUE,
    creat_el            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CONSTRAINT preset_preu_positiu CHECK (preu_compra_sac_kg > 0),
    CONSTRAINT preset_dosi_positiva CHECK (dosi_standard_g_dia > 0)
);

COMMENT ON COLUMN presets_llet_pols.preu_repercutit_dia IS
    'Camp calculat: (dosi_standard_g_dia / 1000) × preu_compra_sac_kg. Cost diari per vedell.';
COMMENT ON COLUMN presets_llet_pols.actiu IS
    'Els presets no es modifiquen. Quan canvia el preu, es crea un preset nou i aquest es marca actiu=FALSE.';

-- ============================================================
-- VISTES
-- ============================================================

-- Animals actius amb la seva distribució actual
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
    da.data_entrada
FROM animals a
LEFT JOIN distribucio_animals    da ON da.animal_id = a.id AND da.data_sortida IS NULL
LEFT JOIN lots                   l  ON l.id  = da.lot_id
LEFT JOIN corts                  c  ON c.id  = da.cort_id
LEFT JOIN zones_infraestructura  z  ON z.id  = c.zona_id
LEFT JOIN races_cataleg          r  ON r.id  = a.raca_id
WHERE a.estat_actiu = TRUE;

-- Animals en període de supressió (bloqueig comercial actiu)
CREATE VIEW v_animals_en_supressio AS
SELECT
    a.dib,
    a.estat_salut,
    t.data_alliberament,
    t.data_alliberament - CURRENT_DATE AS dies_restants,
    m.nom_medicament,
    m.dies_supressio
FROM tractaments t
JOIN animals     a ON a.id = t.animal_id
JOIN medicaments m ON m.id = t.medicament_id
WHERE t.data_alliberament > CURRENT_DATE
  AND a.estat_actiu = TRUE;

-- Estoc actual de tots els magatzems amb llindar resolt (jerarquia global/específic)
CREATE VIEW v_estoc_magatzems AS
SELECT
    'sitja'              AS tipus,
    s.id,
    s.nom,
    s.tipus_pinso        AS tipus_producte,
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
```

---

## 5. Resum de Regles de Negoci Implementades

| Regla | Implementació |
|-------|--------------|
| Un animal mai s'esborra | `estat_actiu = FALSE` en comptes de `DELETE` |
| Cort només en zona NAU_ANIMALS | Trigger `trg_corts_zona_tipus` |
| Magatzem farratge només en COBERT | Trigger `trg_magatzem_zona_tipus` |
| `updated_at` sempre actualitzat | Trigger `set_updated_at()` en totes les taules |
| Historial d'estat de salut | Trigger `trg_animals_historial_salut` → `historial_estat_salut` |
| `data_alliberament` calculada | Trigger `trg_tractament_alliberament` al INSERT |
| Venda requereix pes_viu i preu | `CHECK` constraint a `baixes` |
| Mort requereix codi recollida cadàvers | `CHECK` constraint a `baixes` |
| Estocs no negatius | `CHECK` constraint a `sitges` i `magatzems_farratge` |
| Cost diari llet en pols calculat | `GENERATED ALWAYS AS ... STORED` |
| Dies supressió >= 0 | `CHECK` constraint a `medicaments` |
| Un sol registre de configuració | `CHECK (id = 1)` a `configuracio_general` |
| Presets immutables (nou preu = nou preset) | `actiu = FALSE` sense modificar l'existent |
| Cerca parcial de crotal optimitzada | Índex `GIN` amb `pg_trgm` |
| Races globals protegides | Camp `es_global = TRUE` (lògica de protecció a l'aplicació) |
