# Gestió Ramadera Bovina — Documentació Tècnica

> **Estat:** En desenvolupament actiu  
> **Última actualització:** Juny de 2026  
> **Versió de documentació:** 1.1.0

---

## Descripció del Projecte

Plataforma **SaaS multitenant** per a la gestió integral d'explotacions bovines. Dissenyada com a **Progressive Web App (PWA)** per funcionar en dispositius mòbils i tauletes a peu de granja, amb preparació per a futures integracions IoT (lectors RFID, balances electròniques, GPS).

Suporta els tres models d'explotació principals:
- **Intensiu** — Vedells d'engreix
- **Lleter** — Vaques de producció lletera
- **Extensiu** — Vaques de carn en pastura

---

## Estructura del Repositori

```
/
├── README.md                        ← Aquest fitxer
├── docs/                            ← Documentació tècnica
│   ├── 01_arquitectura_general.md
│   ├── 02_model_de_dades.md
│   ├── 03_multitenancy.md
│   ├── 04_seguretat_i_rols.md
│   ├── 05_backup_i_dr.md
│   ├── 06_modul_sanitari.md
│   ├── 07_modul_arxiu_historic.md
│   ├── 08_modul_llistat_actius.md
│   ├── 09_modul_logistica_farratges.md
│   └── 10_modul_vedells_mamons.md
├── database/                        ← Scripts SQL de la base de dades
│   ├── 01_schema_public.sql         ← Executar UN COP en crear la plataforma
│   ├── 02_schema_tenant_template.sql← Executar per CADA CLIENT NOU (inclou RLS)
│   ├── 03_rls_public.sql            ← Executar UN COP just després del punt 1
│   ├── 00_neteja_reintent.sql       ← Utilitat: neteja un tenant per reintentar
│   └── verificar_extensio.sql       ← Utilitat: comprova la ubicació de pg_trgm
├── backend/                         ← API REST (per desenvolupar)
└── frontend/                        ← PWA (per desenvolupar)
```

---

## Índex de Documents

### Fonaments Tècnics

| Fitxer | Contingut |
|--------|-----------|
| [`docs/01_arquitectura_general.md`](./docs/01_arquitectura_general.md) | Stack tecnològic, visió de sistema, PWA, IoT |
| [`docs/02_model_de_dades.md`](./docs/02_model_de_dades.md) | DDL PostgreSQL, ordre d'execució SQL, model de dades |
| [`docs/03_multitenancy.md`](./docs/03_multitenancy.md) | Estratègia schemas per tenant, RGPD, migracions |
| [`docs/04_seguretat_i_rols.md`](./docs/04_seguretat_i_rols.md) | Rols, permisos per mòdul, autenticació JWT |
| [`docs/05_backup_i_dr.md`](./docs/05_backup_i_dr.md) | Estratègia de còpies de seguretat i recuperació |

### Mòduls Funcionals

| Fitxer | Contingut |
|--------|-----------|
| [`docs/06_modul_sanitari.md`](./docs/06_modul_sanitari.md) | Fitxa de medicaments, tractaments, importació CSV |
| [`docs/07_modul_arxiu_historic.md`](./docs/07_modul_arxiu_historic.md) | Baixes per venda i per mort, consulta històrica |
| [`docs/08_modul_llistat_actius.md`](./docs/08_modul_llistat_actius.md) | Graella diària, gestió de lots, altes massives |
| [`docs/09_modul_logistica_farratges.md`](./docs/09_modul_logistica_farratges.md) | Consums, alertes d'estoc, estats de magatzem |
| [`docs/10_modul_vedells_mamons.md`](./docs/10_modul_vedells_mamons.md) | Presets de llet en pols, imputació de costos |

### Scripts de Base de Dades

| Fitxer | Quan executar |
|--------|--------------|
| [`database/01_schema_public.sql`](./database/01_schema_public.sql) | ✅ Un sol cop en crear la plataforma |
| [`database/03_rls_public.sql`](./database/03_rls_public.sql) | ✅ Un sol cop, just després de l'anterior |
| [`database/02_schema_tenant_template.sql`](./database/02_schema_tenant_template.sql) | 🔁 Un cop per cada client nou (inclou RLS del tenant) |
| [`database/00_neteja_reintent.sql`](./database/00_neteja_reintent.sql) | 🛠️ Utilitat: neteja un tenant per reintentar l'execució |
| [`database/verificar_extensio.sql`](./database/verificar_extensio.sql) | 🛠️ Utilitat: comprova on és instal·lada `pg_trgm` |

---

## Decisions d'Arquitectura Clau

| Decisió | Opció Escollida | Justificació |
|---------|----------------|--------------|
| **Motor de BD** | PostgreSQL 16+ | Suport natiu de schemas, RLS, JSONB, extensibilitat |
| **Hosting BD** | Supabase (PostgreSQL gestionat) | Backups automàtics, monitorització i alta disponibilitat |
| **Accés a la BD** | Connexió PostgreSQL directa des del backend | Imprescindible per a `SET search_path` dinàmic per tenant |
| **Estratègia multitenant** | Schema per tenant | Alt aïllament, RGPD simplificat, cost moderat |
| **Seguretat BD** | RLS sense polítiques (bloqueig total accés directe) | Cap accés possible via API Supabase; només el backend connecta |
| **Frontend** | PWA | Sense instal·lació, offline-ready, compatible mòbil/tauleta |
| **Autenticació** | Backend propi: JWT + bcrypt | Validació de credencials mai exposada al navegador |
| **Rols d'usuari** | Admin / Veterinari / Treballador | Mínim privilegi per rol i mòdul |

---

## ⚠️ Decisió Crítica: Supabase com a Hosting de BD

S'utilitza **Supabase únicament com a PostgreSQL gestionat** (hosting, backups, monitorització), **NO com a backend-as-a-service**.

**Conseqüències pràctiques:**
- El **backend és obligatori**: el frontend mai es connecta directament a Supabase.
- El backend usa la **connection string PostgreSQL directa** de Supabase (no l'API REST/PostgREST).
- Les claus `anon` / `service_role` de Supabase i l'API REST/PostgREST **no s'utilitzen** en aquest projecte.
- El RLS activat a totes les taules (sense polítiques) garanteix que, fins i tot si les claus de Supabase quedessin exposades per error, cap dada seria accessible.

> Detall complet: [`docs/02_model_de_dades.md`](./docs/02_model_de_dades.md)

---

## Rols d'Usuari (Resum)

| Rol | Àmbit d'Accés |
|-----|--------------|
| **Admin** | Accés total: configuració, tots els mòduls, gestió d'usuaris |
| **Veterinari** | Mòdul sanitari + consulta de fitxes d'animals |
| **Treballador** | Registre diari: pesos, consums, estat de salut bàsic |

> Matriu de permisos completa per mòdul: [`docs/04_seguretat_i_rols.md`](./docs/04_seguretat_i_rols.md)

---

## Convencions de la Documentació

- **Idioma:** Català
- **Format:** Markdown estàndard (compatible GitHub/GitLab)
- **Versionat:** Semver per als documents principals (`V1`, `V2`...)
- **Dates:** Format `AAAA-MM-DD`
- **Números:** Separador decimal amb coma (`,`) i separador de milers amb punt (`.`) — Ex: `1.234,56 €`

---

*Documentació generada i mantinguda com a part del procés de disseny tècnic previ a la implementació.*
