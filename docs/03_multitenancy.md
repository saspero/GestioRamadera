# 03 — Estratègia Multitenant

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026

---

## 1. Estratègia Adoptada: Schema per Tenant

S'ha adoptat l'estratègia de **schema per tenant** dins d'una única instància PostgreSQL. Cada client (granja subscrita) té un schema propi i aïllat.

### 1.1. Justificació de l'Elecció

| Criteri | Schema per Tenant ✅ | BD per Tenant | tenant_id a les taules |
|---------|---------------------|--------------|----------------------|
| **Aïllament de dades** | Alt | Màxim | Mitjà (risc de filtre incorrecte) |
| **Compliment RGPD (dret oblit)** | Fàcil (`DROP SCHEMA`) | Molt fàcil | Complex (esborrat fila a fila) |
| **Cost d'infraestructura** | Baix-Mitjà | Alt | Baix |
| **Complexitat operativa** | Moderada | Alta | Baixa |
| **Backup per client** | Senzill | Trivial | Requereix filtrat |
| **Escalabilitat (centenars de tenants)** | Bona | Limitada | Excel·lent |
| **Recomanat per a SaaS agrícola** | ✅ Sí | No | No (risc seguretat) |

---

## 2. Convenció de Nomenclatura

```
Schema públic:  public           → Dades globals (tenants, users)
Schema tenant:  tenant_{ID}      → Ex: tenant_00001, tenant_00042
```

- El `ID` és l'`id` de la taula `public.tenants`, amb zero-padding fins a 5 dígits.
- El nom del schema s'emmagatzema a `public.tenants.schema_name`.
- Longitud màxima 63 caràcters (límit de PostgreSQL).

---

## 3. Cicle de Vida d'un Tenant

### 3.1. Aprovisionament (Alta de client nou)

Quan un client nou es subscriu a la plataforma, s'executa el procés següent en una **transacció única**:

```sql
BEGIN;

-- 1. Crear el registre del tenant al schema públic
INSERT INTO public.tenants (nom_empresa, tipus_explotacio, schema_name)
VALUES ('Mas Vell SL', 'Engreix', 'tenant_00001')
RETURNING id;

-- 2. Crear el schema aïllat
CREATE SCHEMA tenant_00001;

-- 3. Aplicar el DDL complet del tenant (des del fitxer de plantilla)
SET search_path TO tenant_00001;
-- ... (DDL de totes les taules del tenant)

-- 4. Inserir configuració inicial per defecte
INSERT INTO tenant_00001.configuracio_general (id) VALUES (1);

-- 5. Crear l'usuari Admin inicial
INSERT INTO public.users (tenant_id, nom, email, password_hash, rol)
VALUES (1, 'Administrador', 'admin@masvell.com', '<hash>', 'Admin');

COMMIT;
```

> **Important:** Si qualsevol pas falla, el `ROLLBACK` garanteix que no quedi cap schema orfe ni cap registre inconsistent.

### 3.2. Accés en Operació Normal

Per a cada request autenticat de l'API:

```sql
-- L'API estableix el search_path basant-se en el JWT del request
SET search_path TO tenant_00001, public;

-- A partir d'aquí, totes les consultes operen sobre el schema del tenant
SELECT * FROM animals WHERE estat_actiu = TRUE;
-- Equivalent a: SELECT * FROM tenant_00001.animals WHERE estat_actiu = TRUE;
```

### 3.3. Baixa de Client (Dret a l'Oblit — RGPD Art. 17)

Quan un client sol·licita l'eliminació de les seves dades:

```sql
BEGIN;

-- 1. Marcar el tenant com a inactiu (soft delete)
UPDATE public.tenants SET actiu = FALSE WHERE schema_name = 'tenant_00001';

-- 2. Desactivar tots els usuaris del tenant
UPDATE public.users SET actiu = FALSE WHERE tenant_id = 1;

-- 3. [Pas diferit, requereix confirmació] Eliminar tot el schema amb totes les dades
DROP SCHEMA tenant_00001 CASCADE;

-- 4. Eliminar registres de la taula pública
DELETE FROM public.users WHERE tenant_id = 1;
DELETE FROM public.tenants WHERE id = 1;

COMMIT;
```

> **Nota de procés:** Els passos 3 i 4 han de ser confirmats manualment per un administrador de la plataforma i documentats per compliment RGPD. El pas 1 i 2 s'executen immediatament a la sol·licitud; els passos 3 i 4 s'executen dins del termini legal (màxim 30 dies).

---

## 4. Seguretat en Profunditat: Row Level Security (RLS)

Malgrat que l'aïllament per schema ja garanteix que un tenant no pot accedir a dades d'un altre, s'afegeix **RLS com a capa addicional de defensa** per cobrir errors potencials a nivell d'aplicació.

### 4.1. Configuració RLS al Schema Públic

```sql
-- Activar RLS a la taula users del schema públic
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Política: un usuari autenticat només veu els usuaris del seu tenant
CREATE POLICY users_tenant_isolacio ON public.users
    USING (tenant_id = current_setting('app.current_tenant_id')::INTEGER);
```

### 4.2. Configuració RLS als Schemas Tenant

Per a taules que referencien `public.users` (ex: `registrat_per`), RLS no és necessari perquè el schema ja és aïllat. No obstant, es pot afegir per a taules crítiques:

```sql
-- Exemple per a la taula animals (schema tenant)
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;

-- Política de lectura: tots els rols autenticats del tenant veuen tots els animals
CREATE POLICY animals_lectura ON animals FOR SELECT USING (TRUE);

-- Política d'escriptura: Treballadors i Admin poden inserir; Veterinaris només lectura
CREATE POLICY animals_insercio ON animals FOR INSERT
    WITH CHECK (current_setting('app.current_rol') IN ('Admin', 'Treballador'));
```

### 4.3. Variable de Sessió per a RLS

L'API ha d'establir les variables de sessió en cada connexió:

```sql
-- Establert per l'API en cada request autenticat:
SET app.current_tenant_id = '1';
SET app.current_rol = 'Admin';
SET search_path TO tenant_00001, public;
```

---

## 5. Gestió de Migracions

### 5.1. Dos Tipus de Migracions

| Tipus | Àmbit | Exemple |
|-------|-------|---------|
| **Migració global** | Schema `public` | Afegir un camp a `public.tenants` |
| **Migració tenant** | Tots els schemas tenant | Afegir una nova taula a cada tenant |

### 5.2. Estratègia per a Migracions Tenant

Quan cal modificar l'estructura de tots els tenants:

```sql
-- Exemple: afegir camp observacions a la taula animals per a tots els tenants
DO $$
DECLARE
    tenant_schema TEXT;
BEGIN
    FOR tenant_schema IN
        SELECT schema_name FROM public.tenants WHERE actiu = TRUE
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.animals ADD COLUMN IF NOT EXISTS observacions TEXT',
            tenant_schema
        );
        RAISE NOTICE 'Migrat schema: %', tenant_schema;
    END LOOP;
END;
$$;
```

### 5.3. Control de Versions de Migració

Es recomana mantenir una taula de control de versions al schema públic:

```sql
CREATE TABLE public.schema_migrations (
    versio          VARCHAR(20) PRIMARY KEY,
    descripcio      TEXT,
    aplicat_el      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aplicat_per     VARCHAR(100)
);
```

I per als schemas tenant, una taula equivalent dins de cada schema:

```sql
-- Existent a cada tenant_XXXXX:
CREATE TABLE tenant_migrations (
    versio          VARCHAR(20) PRIMARY KEY,
    descripcio      TEXT,
    aplicat_el      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. Consideracions de Rendiment

- **Connection pooling:** Amb molts tenants, és crític usar un pool de connexions (ex: PgBouncer) en mode **transaction pooling** perquè el `SET search_path` s'estableixi per transacció, no per connexió.
- **Nombre màxim de schemas:** PostgreSQL no té un límit estricte, però es recomana mantenir menys de 1.000 schemas per instància per simplicitat operativa.
- **Monitorització:** Controlar la mida de cada schema amb `pg_schema_size()` per detectar tenants amb creixement anormal de dades.
