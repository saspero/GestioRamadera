# Gestió Ramadera Bovina — Documentació Tècnica

> **Estat:** En desenvolupament actiu  
> **Última actualització:** Juny de 2026  
> **Versió de documentació:** 1.0.0

---

## Descripció del Projecte

Plataforma **SaaS multitenant** per a la gestió integral d'explotacions bovines. Dissenyada com a **Progressive Web App (PWA)** per funcionar en dispositius mòbils i tauletes a peu de granja, amb preparació per a futures integracions IoT (lectors RFID, balances electròniques, GPS).

Suporta els tres models d'explotació principals:
- **Intensiu** — Vedells d'engreix
- **Lleter** — Vaques de producció lletera
- **Extensiu** — Vaques de carn en pastura

---

## Índex de Documents

### Fonaments Tècnics

| Fitxer | Contingut |
|--------|-----------|
| [`01_arquitectura_general.md`](./01_arquitectura_general.md) | Stack tecnològic, visió de sistema, PWA, IoT |
| [`02_model_de_dades.md`](./02_model_de_dades.md) | DDL PostgreSQL complet (schema públic + tenant) |
| [`03_multitenancy.md`](./03_multitenancy.md) | Estratègia schemas, RGPD, migracions |
| [`04_seguretat_i_rols.md`](./04_seguretat_i_rols.md) | Rols, permisos per mòdul, autenticació |
| [`05_backup_i_dr.md`](./05_backup_i_dr.md) | Estratègia de còpies de seguretat i recuperació |

### Mòduls Funcionals

| Fitxer | Contingut |
|--------|-----------|
| [`06_modul_sanitari.md`](./06_modul_sanitari.md) | Fitxa de medicaments, tractaments, importació CSV |
| [`07_modul_arxiu_historic.md`](./07_modul_arxiu_historic.md) | Baixes per venda i per mort, consulta històrica |
| [`08_modul_llistat_actius.md`](./08_modul_llistat_actius.md) | Graella diària, gestió de lots, altes massives |
| [`09_modul_logistica_farratges.md`](./09_modul_logistica_farratges.md) | Consums, alertes d'estoc, estats de magatzem |
| [`10_modul_vedells_mamons.md`](./10_modul_vedells_mamons.md) | Presets de llet en pols, imputació de costos |

---

## Decisions d'Arquitectura Clau

| Decisió | Opció Escollida | Justificació |
|---------|----------------|--------------|
| **Motor de BD** | PostgreSQL 16+ | Suport natiu de schemas, RLS, JSONB, extensibilitat |
| **Estratègia multitenant** | Schema per tenant | Alt aïllament, RGPD simplificat, cost moderat |
| **Frontend** | PWA | Sense instal·lació, offline-ready, compatible mòbil |
| **Hosting BD** | Supabase (PostgreSQL gestionat) | Backups, monitorització i alta disponibilitat sense gestionar infraestructura pròpia |
| **Accés a la BD** | Connexió PostgreSQL directa des del backend (NO via API REST/PostgREST de Supabase) | Imprescindible per a `SET search_path` dinàmic (schemas per tenant) i per mantenir l'autenticació pròpia |
| **Autenticació** | JWT + OAuth2 | Estàndard industrial, compatible amb IoT futur |
| **Rols d'usuari** | Admin / Veterinari / Treballador | Mínim privilegi per rol i mòdul |

---

## Rols d'Usuari (Resum)

| Rol | Àmbit d'Accés |
|-----|--------------|
| **Admin** | Accés total: configuració, tots els mòduls, gestió d'usuaris |
| **Veterinari** | Mòdul sanitari + consulta de fitxes d'animals |
| **Treballador** | Registre diari: pesos, consums, estat de salut bàsic |

> Detall complet de permisos: [`04_seguretat_i_rols.md`](./04_seguretat_i_rols.md)

---

## ⚠️ Decisió Crítica: Supabase com a Hosting de BD

S'utilitza **Supabase únicament com a PostgreSQL gestionat** (hosting, backups, monitorització), **NO com a backend-as-a-service**.

**Per què:**
- L'API automàtica de Supabase (PostgREST) només exposa el schema `public` per defecte. El nostre model de **schema per tenant** (`tenant_00001`, `tenant_00002`...) no és compatible amb aquest flux sense configuració manual i no escalable per cada tenant nou.
- L'autenticació pròpia (`public.users` amb `password_hash` i JWT generat pel nostre backend) requereix lògica de validació que **no pot viure al frontend**.

**Conseqüència pràctica:**
- El **backend és obligatori** (no és opcional ni un "nice to have").
- El backend es connecta a Supabase mitjançant la **connection string PostgreSQL directa** (host, port, usuari, contrasenya — disponible al panell de Supabase), usant un client SQL estàndard (ex: `node-postgres`, `psycopg2`, `Npgsql`...), exactament com es connectaria a qualsevol PostgreSQL autogestionat.
- El frontend **mai** es connecta directament a Supabase ni rep claus públiques de Supabase. Totes les peticions passen pel backend.
- Les claus `anon` / `service_role` de Supabase i l'API REST/PostgREST **no s'utilitzen** en aquest projecte.

---

## Estructura del Repositori

```
/
├── docs/                    ← Aquesta documentació tècnica
├── backend/                 ← API REST (per definir)
├── frontend/                ← PWA (per definir)
├── database/
│   ├── migrations/          ← Scripts SQL per schema públic
│   └── tenant_template/     ← DDL del schema tenant base
└── scripts/
    └── tenant_provisioning/ ← Scripts de creació de nous tenants
```

---

## Convencions de la Documentació

- **Idioma:** Català
- **Format:** Markdown estàndard (compatible GitHub/GitLab)
- **Versionat:** Semver per als documents principals (`V1`, `V2`...)
- **Dates:** Format `AAAA-MM-DD`
- **Moneda:** Euro (€), separador decimal amb coma (`,`) i separador de milers amb punt (`.`) — Ex: `1.234,56 €`

---

*Documentació generada i mantinguda com a part del procés de disseny tècnic previ a la implementació.*
