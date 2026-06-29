# 01 — Arquitectura General del Sistema

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026

---

## 1. Visió General

El sistema és una plataforma SaaS multitenant per a la gestió d'explotacions bovines. L'arquitectura segueix un model de **tres capes** clàssic amb adaptacions específiques per al context agrícola (connectivitat limitada a peu de granja, necessitat d'ús mòbil intensiu, futura integració IoT).

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS (Frontend)                    │
│         PWA  ·  Navegador Web  ·  App Mòbil             │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS / REST
┌───────────────────────▼─────────────────────────────────┐
│                   API REST (Backend)                     │
│         Autenticació · Lògica de Negoci · Validació      │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│              PostgreSQL 16+ (Base de Dades)              │
│   Schema públic (tenants/users) · Schemas per tenant     │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnològic

### 2.1. Base de Dades

| Component | Tecnologia | Versió mínima | Justificació |
|-----------|-----------|--------------|-------------|
| Motor relacional | PostgreSQL | 16+ | Schemas natius, RLS, JSONB, maduresa |
| Estratègia multitenant | Schema per tenant | — | Aïllament alt, RGPD simplificat |
| Seguretat addicional | Row Level Security (RLS) | — | Capa de defensa en profunditat |

### 2.2. Backend (API)

> **Nota:** El framework de backend és per decidir. Els requisits arquitectònics que ha de complir qualsevol opció escollida són:

- Suport per a **JWT** com a mecanisme d'autenticació stateless
- Capacitat de gestionar **connexions per schema** de PostgreSQL dinàmicament (canvi de `search_path` per request)
- Suport per a **OAuth2** per a la futura integració IoT
- API **REST** amb versionat (`/api/v1/...`)

### 2.3. Frontend

| Component | Tecnologia | Justificació |
|-----------|-----------|-------------|
| Tipus d'aplicació | PWA (Progressive Web App) | Sense instal·lació, funciona offline, compatible tots els dispositius |
| Ús principal | Tauleta / mòbil a peu de granja | Disseny optimitzat per a pantalles tàctils i entrada ràpida de dades |
| Connectivitat | Offline-first amb sincronització | La connectivitat a granges pot ser limitada o intermitent |

---

## 3. Progressive Web App (PWA)

### 3.1. Justificació

L'ús a peu de granja implica:
- Mans brutes, ús amb guants → **botons grans, formularis simples**
- Connectivitat WiFi o dades mòbils variable → **capacitat offline**
- Dispositius variats (tauletes Android, iPhones, portàtils) → **sense app nativa per plataforma**

### 3.2. Capacitats Offline Requerides

Les següents operacions han de funcionar sense connexió i sincronitzar en reconectar:

| Operació | Prioritat Offline |
|----------|-----------------|
| Registre de pesos diaris | Alta — operació principal diària |
| Registre de consums de farratge | Alta |
| Consulta de fitxes d'animals actius | Mitjana |
| Aplicació de tractaments veterinaris | Mitjana |
| Importació de fitxers CSV | Baixa — requereix connexió per validar |
| Configuració i gestió d'usuaris | Nul·la — requereix connexió |

### 3.3. Estratègia de Sincronització

- **Cua local:** Les accions realitzades offline s'emmagatzemen en una cua local (IndexedDB).
- **Reconciliació optimista:** La UI mostra el canvi immediatament; la sincronització és en segon pla.
- **Gestió de conflictes:** En cas de conflicte (ex: mateix animal modificat per dos usuaris offline), es conserva el registre més recent per timestamp i s'alerta l'Admin.

---

## 4. Seguretat a Nivell d'Arquitectura

### 4.1. Principis Base

- **Mínim privilegi:** Cada rol d'usuari accedeix únicament als recursos i operacions que necessita.
- **Aïllament de tenants:** Cap consulta no pot retornar dades d'un tenant diferent, ni per error de codi ni per injecció SQL.
- **Defensa en profunditat:** L'aïllament s'implementa a tres nivells (schema, RLS, capa d'aplicació).
- **Autenticació robusta:** JWT amb caducitat curta + refresh tokens.

### 4.2. Flux d'Autenticació

```
1. Usuari envia credencials (email + password)
2. Backend valida contra schema públic (taula users)
3. Backend recupera tenant_id i rol de l'usuari
4. Backend genera JWT amb payload: { user_id, tenant_id, rol, exp }
5. Backend estableix search_path = tenant_schema per a la sessió
6. Cada request subsegüent inclou el JWT a la capçalera Authorization
7. Backend valida JWT i restaura el search_path correcte
```

### 4.3. Comunicació

- Tot el tràfic sota **HTTPS/TLS 1.3** obligatori
- Cap dada sensible a paràmetres d'URL (sempre body o capçaleres)
- Capçaleres de seguretat HTTP: `HSTS`, `X-Content-Type-Options`, `X-Frame-Options`, `CSP`

---

## 5. Integració IoT (Planificació Futura)

El sistema ha de ser **IoT-ready** des del disseny, sense requerir refactoritzacions majors en el futur.

### 5.1. Dispositius Contemplats

| Dispositiu | Cas d'Ús | Integració |
|-----------|---------|-----------|
| Lectors RFID de crotals | Identificació automàtica d'animals al pesatge | API Key per dispositiu |
| Balances electròniques | Registre de pes automàtic sense entrada manual | Webhook o polling |
| Collars GPS | Geolocalització en extensiu, detecció de cel·les de pastura | Stream de dades |

### 5.2. Requisits d'Integració IoT

- **Autenticació per dispositiu:** Cada dispositiu IoT tindrà una **API Key** pròpia, associada a un tenant i amb permisos limitats (només escriptura de les seves dades específiques).
- **Endpoint dedicat:** `/api/v1/iot/` amb rate limiting estricte i validació de payload.
- **Identificació de tenant:** L'API Key portarà embegut el `tenant_id` per evitar que un dispositiu mal configurat pugui escriure en un altre tenant.
- **Idempotència:** Les lectures de dispositius han de ser idempotents per gestionar reintents sense duplicats.

---

## 6. Escalabilitat i Operació

### 6.1. Creixement de Tenants

L'arquitectura de schema per tenant permet créixer sense canvis estructurals fins a centenars de tenants. Quan el nombre creixi, les opcions d'escalat són:

1. **Vertical:** Augmentar recursos del servidor PostgreSQL
2. **Sharding manual:** Moure tenants grans a instàncies dedicades (els schemas s'exportarien)
3. **Read replicas:** PostgreSQL streaming replication per a consultes de reports

### 6.2. Monitorització

Els següents aspectes han de ser monitoritzats en producció:

- Connexions actives per schema (evitar pool exhaustion)
- Mida de cada schema per tenant (alertes de creixement anormal)
- Temps de resposta de l'API per endpoint
- Errors d'autenticació (detecció d'atacs de força bruta)
