# 02 — Model de Dades (DDL PostgreSQL)

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026  
> **Motor:** PostgreSQL 16+

---

## 1. Estructura de Schemas

```
postgres (instància)
├── public                  ← Schema global: tenants i usuaris
│   ├── tenants
│   └── users
├── tenant_00001            ← Schema del client 1 (granja "Mas Vell")
│   ├── ubicacions
│   ├── zones_infraestructura
│   ├── corts
│   ├── sitges
│   ├── magatzems_farratge
│   ├── races_cataleg
│   ├── lots
│   ├── animals
│   ├── distribucio_animals
│   ├── registre_pes
│   ├── registre_llet
│   ├── consums_pinso_nau
│   ├── moviments_farratge
│   ├── medicaments
│   ├── tractaments
│   └── baixes
├── tenant_00002            ← Schema del client 2
│   └── (mateixa estructura)
└── ...
```

---

## 2. Schema Públic — Gestió de Tenants i Usuaris

```sql
-- ============================================================
-- SCHEMA PÚBLIC: Dades globals del SaaS
-- ============================================================

-- Tipus enumerats globals
CREATE TYPE tipus_explotacio_enum AS ENUM ('Llet', 'Engreix', 'Extensiu');
CREATE TYPE rol_usuari_enum AS ENUM ('Admin', 'Veterinari', 'Treballador');

-- ------------------------------------------------------------
-- Taula: tenants
-- Registra cada client (granja) subscrit a la plataforma.
-- Cada tenant té un schema propi a PostgreSQL.
-- ------------------------------------------------------------
CREATE TABLE public.tenants (
    id              SERIAL PRIMARY KEY,
    nom_empresa     VARCHAR(255) NOT NULL,
    tipus_explotacio tipus_explotacio_enum NOT NULL,
    schema_name     VARCHAR(63) NOT NULL UNIQUE,   -- nom real del schema PostgreSQL
    actiu           BOOLEAN NOT NULL DEFAULT TRUE,
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.tenants IS
    'Registre de clients (granges) de la plataforma SaaS. Cada fila correspon a un schema PostgreSQL independent.';
COMMENT ON COLUMN public.tenants.schema_name IS
    'Nom del schema PostgreSQL per a aquest tenant. Format: tenant_XXXXX. Màxim 63 caràcters (límit PostgreSQL).';

-- ------------------------------------------------------------
-- Taula: users
-- Usuaris de la plataforma. Vinculats a un tenant específic.
-- L'autenticació es fa contra aquesta taula (schema públic).
-- ------------------------------------------------------------
CREATE TABLE public.users (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    nom             VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,          -- bcrypt, cost factor >= 12
    rol             rol_usuari_enum NOT NULL,
    actiu           BOOLEAN NOT NULL DEFAULT TRUE,
    darrer_acces    TIMESTAMPTZ,
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX idx_users_email ON public.users(email);

COMMENT ON TABLE public.users IS
    'Usuaris de la plataforma. Cada usuari pertany a exactament un tenant.';
COMMENT ON COLUMN public.users.password_hash IS
    'Hash de la contrasenya. Obligatori bcrypt amb cost factor >= 12. Mai emmagatzemar la contrasenya en clar.';
COMMENT ON COLUMN public.users.rol IS
    'Admin: accés total. Veterinari: mòdul sanitari i animals. Treballador: registre diari.';
```

---

## 3. Schema Tenant — Estructura de la Granja

> El DDL següent s'aplica a cada schema `tenant_XXXXX`. El `search_path` s'estableix per sessió a l'API.

```sql
-- ============================================================
-- SCHEMA TENANT: Dades aïllades per granja
-- S'executa amb: SET search_path TO tenant_XXXXX;
-- ============================================================

-- Tipus enumerats per tenant
CREATE TYPE tipus_zona_enum AS ENUM ('NAU_ANIMALS', 'COBERT_EMMAGATZEMATGE', 'PASTURA');
CREATE TYPE estat_salut_enum AS ENUM ('Sa', 'En tractament', 'Observació', 'Crític');
CREATE TYPE sexe_enum AS ENUM ('Mascle', 'Femella');
CREATE TYPE motiu_baixa_enum AS ENUM ('Venda', 'Mort');
CREATE TYPE unitat_mesura_enum AS ENUM ('kg', 'Tones', 'Unitats');
CREATE TYPE estat_magatzem_enum AS ENUM ('Actiu', 'Deshabilitat');

-- ------------------------------------------------------------
-- Infraestructura física de la granja
-- ------------------------------------------------------------

CREATE TABLE ubicacions (
    id                  SERIAL PRIMARY KEY,
    nom                 VARCHAR(255) NOT NULL,
    codi_pastura_extensiu VARCHAR(50),              -- Nul·lable: només explotacions extensives
    creat_el            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE zones_infraestructura (
    id          SERIAL PRIMARY KEY,
    ubicacio_id INTEGER NOT NULL REFERENCES ubicacions(id) ON DELETE RESTRICT,
    nom         VARCHAR(255) NOT NULL,
    tipus_zona  tipus_zona_enum NOT NULL,
    creat_el    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zones_ubicacio ON zones_infraestructura(ubicacio_id);

CREATE TABLE corts (
    id              SERIAL PRIMARY KEY,
    zona_id         INTEGER NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    codi_cort       VARCHAR(50) NOT NULL,
    capacitat_maxima INTEGER,
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Restricció: una cort només pot existir en una zona de tipus NAU_ANIMALS
    CONSTRAINT corts_zona_tipus_check CHECK (
        (SELECT tipus_zona FROM zones_infraestructura WHERE id = zona_id) = 'NAU_ANIMALS'
    )
);

COMMENT ON CONSTRAINT corts_zona_tipus_check ON corts IS
    'Una cort (pen) només pot pertànyer a una zona de tipus NAU_ANIMALS.';

-- ------------------------------------------------------------
-- Emmagatzematge d'aliments
-- ------------------------------------------------------------

CREATE TABLE sitges (
    id                  SERIAL PRIMARY KEY,
    ubicacio_id         INTEGER NOT NULL REFERENCES ubicacions(id) ON DELETE RESTRICT,
    nom                 VARCHAR(255) NOT NULL,
    capacitat_kg        DECIMAL(12,2),
    estoc_actual_kg     DECIMAL(12,2) NOT NULL DEFAULT 0,
    tipus_pinso         VARCHAR(100),
    estoc_minim_kg      DECIMAL(12,2),              -- Nul·lable: hereta valor global si és NULL
    estat               estat_magatzem_enum NOT NULL DEFAULT 'Actiu',
    creat_el            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sitges_estoc_positiu CHECK (estoc_actual_kg >= 0)
);

COMMENT ON COLUMN sitges.estoc_minim_kg IS
    'Llindar d''alerta d''estoc mínim. Si NULL, hereta el valor de la configuració general del tenant.';

CREATE TABLE magatzems_farratge (
    id                      SERIAL PRIMARY KEY,
    zona_id                 INTEGER NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    tipus_farratge          VARCHAR(100) NOT NULL,   -- Ex: 'Palla', 'Alfals', 'Llet en pols'
    estoc_actual_tones      DECIMAL(12,3) NOT NULL DEFAULT 0,
    capacitat_maxima_tones  DECIMAL(12,3),
    pes_mitja_bala_kg       DECIMAL(8,2),            -- Per al càlcul quan la unitat és 'Unitats'
    estoc_minim_tones       DECIMAL(12,3),           -- Nul·lable: hereta valor global si és NULL
    estat                   estat_magatzem_enum NOT NULL DEFAULT 'Actiu',
    creat_el                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Restricció: un magatzem de farratge ha de ser en un cobert d'emmagatzematge
    CONSTRAINT magatzem_zona_tipus_check CHECK (
        (SELECT tipus_zona FROM zones_infraestructura WHERE id = zona_id) = 'COBERT_EMMAGATZEMATGE'
    ),
    CONSTRAINT magatzem_estoc_positiu CHECK (estoc_actual_tones >= 0)
);

COMMENT ON COLUMN magatzems_farratge.pes_mitja_bala_kg IS
    'Pes mitjà en kg per bala d''aquest magatzem. Necessari quan la unitat de consum és "Unitats" (bales).';

-- ------------------------------------------------------------
-- Animals: catàleg de races, lots i fitxa
-- ------------------------------------------------------------

CREATE TABLE races_cataleg (
    id          SERIAL PRIMARY KEY,
    nom_raca    VARCHAR(100) NOT NULL,
    es_global   BOOLEAN NOT NULL DEFAULT FALSE,     -- TRUE = raça estàndard, FALSE = personalitzada pel tenant
    creat_el    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT races_nom_unic UNIQUE (nom_raca)
);

COMMENT ON COLUMN races_cataleg.es_global IS
    'Si TRUE, la raça és estàndard (Frisona, Limousin...). Si FALSE, és una raça personalitzada per aquest tenant.';

CREATE TABLE lots (
    id              SERIAL PRIMARY KEY,
    nom_lot         VARCHAR(100) NOT NULL,
    data_creacio    DATE NOT NULL DEFAULT CURRENT_DATE,
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE animals (
    id              SERIAL PRIMARY KEY,
    crotal_id       VARCHAR(20) NOT NULL UNIQUE,    -- Identificador oficial (crotal auricular)
    dib             VARCHAR(50),                    -- Document d'Identificació Bovina
    raca_id         INTEGER REFERENCES races_cataleg(id) ON DELETE SET NULL,
    data_naixement  DATE,
    estat_salut     estat_salut_enum NOT NULL DEFAULT 'Sa',
    sexe            sexe_enum,
    estat_actiu     BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE = baixa (venda o mort)
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_animals_crotal ON animals(crotal_id);
CREATE INDEX idx_animals_actiu ON animals(estat_actiu);
CREATE INDEX idx_animals_raca ON animals(raca_id);

COMMENT ON COLUMN animals.estat_actiu IS
    'Mai s''esborra un animal. estat_actiu=FALSE indica baixa per venda o mort. Historial sempre preservat.';

CREATE TABLE distribucio_animals (
    id              SERIAL PRIMARY KEY,
    animal_id       INTEGER NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    lot_id          INTEGER REFERENCES lots(id) ON DELETE SET NULL,
    cort_id         INTEGER REFERENCES corts(id) ON DELETE SET NULL,
    data_entrada    DATE NOT NULL DEFAULT CURRENT_DATE,
    data_sortida    DATE,                           -- Nul·lable: NULL = distribució actual
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT distribucio_dates_check CHECK (data_sortida IS NULL OR data_sortida >= data_entrada)
);

CREATE INDEX idx_distribucio_animal ON distribucio_animals(animal_id);
CREATE INDEX idx_distribucio_lot ON distribucio_animals(lot_id);
CREATE INDEX idx_distribucio_activa ON distribucio_animals(animal_id) WHERE data_sortida IS NULL;

-- ------------------------------------------------------------
-- Registres de producció
-- ------------------------------------------------------------

CREATE TABLE registre_pes (
    id          SERIAL PRIMARY KEY,
    animal_id   INTEGER NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    data        DATE NOT NULL,
    pes_kg      DECIMAL(8,2) NOT NULL,
    registrat_per INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pes_positiu CHECK (pes_kg > 0)
);

CREATE INDEX idx_pes_animal_data ON registre_pes(animal_id, data DESC);

CREATE TABLE registre_llet (
    id          SERIAL PRIMARY KEY,
    animal_id   INTEGER NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    data        DATE NOT NULL,
    litres      DECIMAL(8,2) NOT NULL,
    registrat_per INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT litres_positius CHECK (litres >= 0)
);

CREATE INDEX idx_llet_animal_data ON registre_llet(animal_id, data DESC);

-- ------------------------------------------------------------
-- Logística d'alimentació
-- ------------------------------------------------------------

CREATE TABLE consums_pinso_nau (
    id              SERIAL PRIMARY KEY,
    zona_id         INTEGER NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    sitge_id        INTEGER NOT NULL REFERENCES sitges(id) ON DELETE RESTRICT,
    data            DATE NOT NULL,
    kg_consumits    DECIMAL(10,2) NOT NULL,
    registrat_per   INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT kg_positius CHECK (kg_consumits > 0)
);

CREATE INDEX idx_consums_pinso_data ON consums_pinso_nau(data DESC);

CREATE TABLE moviments_farratge (
    id                  SERIAL PRIMARY KEY,
    magatzem_id         INTEGER NOT NULL REFERENCES magatzems_farratge(id) ON DELETE RESTRICT,
    zona_desti_id       INTEGER NOT NULL REFERENCES zones_infraestructura(id) ON DELETE RESTRICT,
    data                DATE NOT NULL,
    quantitat           DECIMAL(12,3) NOT NULL,
    unitat              unitat_mesura_enum NOT NULL,
    quantitat_kg_real   DECIMAL(12,3) NOT NULL,     -- Sempre en kg (calculat si unitat='Unitats')
    registrat_per       INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT quantitat_positiva CHECK (quantitat > 0)
);

CREATE INDEX idx_moviments_farratge_data ON moviments_farratge(data DESC);

COMMENT ON COLUMN moviments_farratge.quantitat_kg_real IS
    'Equivalent en kg calculat en el moment del registre. Si unitat=Unitats, quantitat * pes_mitja_bala_kg del magatzem.';

-- ------------------------------------------------------------
-- Mòdul Sanitari: medicaments i tractaments
-- ------------------------------------------------------------

CREATE TABLE medicaments (
    id                  SERIAL PRIMARY KEY,
    nom_medicament      VARCHAR(255) NOT NULL,
    principi_actiu      VARCHAR(255) NOT NULL,
    lot                 VARCHAR(100) NOT NULL,
    quantitat_estoc     DECIMAL(12,3) NOT NULL DEFAULT 0,
    unitat_estoc        VARCHAR(20) NOT NULL DEFAULT 'ml',  -- ml, g, unitats, etc.
    posologia_standard  TEXT,
    preu_compra         DECIMAL(10,2) NOT NULL,
    dies_supressio      INTEGER NOT NULL,
    creat_el            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT medicament_dies_supressio_positiu CHECK (dies_supressio >= 0),
    CONSTRAINT medicament_estoc_positiu CHECK (quantitat_estoc >= 0),
    CONSTRAINT medicament_preu_positiu CHECK (preu_compra >= 0)
);

CREATE INDEX idx_medicaments_nom_lot ON medicaments(nom_medicament, lot);

COMMENT ON COLUMN medicaments.dies_supressio IS
    'Dies d''espera obligatoris abans de vendre l''animal tractat. El sistema bloqueja comercialment l''animal durant aquest període.';

CREATE TABLE tractaments (
    id                  SERIAL PRIMARY KEY,
    animal_id           INTEGER NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    medicament_id       INTEGER NOT NULL REFERENCES medicaments(id) ON DELETE RESTRICT,
    data_inici          DATE NOT NULL,
    data_fi_prevista    DATE,
    data_fi_real        DATE,
    dosi_aplicada       DECIMAL(10,3),
    unitat_dosi         VARCHAR(20),
    data_alliberament   DATE,                       -- data_inici + dies_supressio del medicament
    notes               TEXT,
    aplicat_per         INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tractament_dates_check CHECK (data_fi_prevista IS NULL OR data_fi_prevista >= data_inici)
);

CREATE INDEX idx_tractaments_animal ON tractaments(animal_id);
CREATE INDEX idx_tractaments_alliberament ON tractaments(data_alliberament) WHERE data_alliberament IS NOT NULL;

COMMENT ON COLUMN tractaments.data_alliberament IS
    'Data a partir de la qual l''animal pot ser comercialitzat. Calculada automàticament: data_inici + dies_supressio.';

-- ------------------------------------------------------------
-- Registre de baixes (vendes i morts)
-- ------------------------------------------------------------

CREATE TABLE baixes (
    id                      SERIAL PRIMARY KEY,
    animal_id               INTEGER NOT NULL REFERENCES animals(id) ON DELETE RESTRICT,
    motiu                   motiu_baixa_enum NOT NULL,
    data_baixa              DATE NOT NULL,
    -- Camps específics de venda
    pes_viu_kg              DECIMAL(8,2),
    pes_canal_kg            DECIMAL(8,2),
    preu_kg                 DECIMAL(8,2),
    cost_transport          DECIMAL(10,2),
    comprador_escorxador    VARCHAR(255),
    -- Camps específics de mort
    causa_mort              VARCHAR(255),
    codi_recollida_cadavers VARCHAR(100),           -- Justificant empresa concessionària (obligatori per assegurança)
    -- Auditoria
    registrat_per           INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    creat_el                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Validació: els camps de venda/mort no es barregen
    CONSTRAINT baixa_venda_check CHECK (
        motiu != 'Venda' OR (pes_viu_kg IS NOT NULL AND preu_kg IS NOT NULL)
    ),
    CONSTRAINT baixa_mort_check CHECK (
        motiu != 'Mort' OR codi_recollida_cadavers IS NOT NULL
    )
);

CREATE INDEX idx_baixes_animal ON baixes(animal_id);
CREATE INDEX idx_baixes_motiu ON baixes(motiu);
CREATE INDEX idx_baixes_data ON baixes(data_baixa DESC);

COMMENT ON COLUMN baixes.codi_recollida_cadavers IS
    'Camp obligatori per a baixes per mort. Número de bitllet o justificant de l''empresa de retirada de cadàvers. Necessari per a tràmits d''assegurança i DARP.';

-- ------------------------------------------------------------
-- Configuració general del tenant (valors per defecte)
-- ------------------------------------------------------------

CREATE TABLE configuracio_general (
    id                          SERIAL PRIMARY KEY,   -- Sempre una sola fila per tenant
    estoc_minim_default_kg      DECIMAL(12,2) DEFAULT 500,  -- Fallback per sitges sense mínim propi
    estoc_minim_default_tones   DECIMAL(12,3) DEFAULT 1,    -- Fallback per magatzems sense mínim propi
    creat_el                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT un_sol_registre CHECK (id = 1)
);

INSERT INTO configuracio_general (id) VALUES (1);

COMMENT ON TABLE configuracio_general IS
    'Configuració global del tenant. Sempre exactament una fila. Els valors actuen de fallback quan un magatzem o sitja no té mínim específic definit.';

-- ------------------------------------------------------------
-- Preset de llet en pols (vedells mamons)
-- ------------------------------------------------------------

CREATE TABLE presets_llet_pols (
    id                      SERIAL PRIMARY KEY,
    nom                     VARCHAR(100) NOT NULL,
    preu_compra_sac_kg      DECIMAL(10,4) NOT NULL,
    dosi_standard_g_dia     DECIMAL(10,2) NOT NULL,
    -- Camp calculat: actualitzat automàticament per trigger o per l'aplicació
    preu_repercutit_dia     DECIMAL(10,4) GENERATED ALWAYS AS
                            ((dosi_standard_g_dia / 1000) * preu_compra_sac_kg) STORED,
    actiu                   BOOLEAN NOT NULL DEFAULT TRUE,
    creat_el                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualitzat_el          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN presets_llet_pols.preu_repercutit_dia IS
    'Camp calculat automàticament: (dosi_standard_g_dia / 1000) * preu_compra_sac_kg. Cost diari per vedell.';
```

---

## 4. Regles de Negoci Implementades a la BD

| Regla | Implementació |
|-------|--------------|
| Un animal mai s'esborra | `estat_actiu = FALSE` en comptes de `DELETE` |
| Cort només en zona NAU_ANIMALS | `CHECK` constraint a la taula `corts` |
| Magatzem farratge només en COBERT | `CHECK` constraint a `magatzems_farratge` |
| Venda requereix pes_viu i preu | `CHECK` constraint a `baixes` |
| Mort requereix codi recollida cadàvers | `CHECK` constraint a `baixes` |
| Estocs no negatius | `CHECK` constraint a `sitges` i `magatzems_farratge` |
| Cost diari llet en pols calculat | `GENERATED ALWAYS AS ... STORED` |
| Dies supressió >= 0 | `CHECK` constraint a `medicaments` |
| Un sol registre de configuració | `CHECK (id = 1)` a `configuracio_general` |

---

## 5. Vistes Recomanades

```sql
-- Vista: animals actius amb la seva distribució actual
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
    z.nom AS nom_zona,
    da.data_entrada
FROM animals a
LEFT JOIN distribucio_animals da ON da.animal_id = a.id AND da.data_sortida IS NULL
LEFT JOIN lots l ON l.id = da.lot_id
LEFT JOIN corts c ON c.id = da.cort_id
LEFT JOIN zones_infraestructura z ON z.id = c.zona_id
LEFT JOIN races_cataleg r ON r.id = a.raca_id
WHERE a.estat_actiu = TRUE;

-- Vista: animals en període de supressió (bloqueig comercial)
CREATE VIEW v_animals_en_supressio AS
SELECT
    a.crotal_id,
    a.estat_salut,
    t.data_alliberament,
    m.nom_medicament,
    m.dies_supressio
FROM tractaments t
JOIN animals a ON a.id = t.animal_id
JOIN medicaments m ON m.id = t.medicament_id
WHERE t.data_alliberament > CURRENT_DATE
  AND a.estat_actiu = TRUE;
```
