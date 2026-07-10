# 13 — Mòdul Granja / Corts

> **Versió:** 1.0.0  
> **Última actualització:** Juliol de 2026  
> **Basat en:** Ampliació sobre `08_modul_llistat_actius.md` (secció "Lots i Corts" del disseny original)

---

## 0. Origen i Decisió de Disseny

### 0.1. Per què és una secció separada

El document funcional original (`Estructura_de_Navegació_V1.docx`) definia **"Lots i Corts"** com una única subsecció dins de "🐄 Gestió del Bestiar", juntament amb "Llistat d'Animals Actius". Un cop implementat el mòdul d'Animals com a pantalla operativa densa (llistat, cercador, altes), es va decidir **separar-ho en dues seccions independents del Sidebar**:

- **Granja/Corts** — gestió de la infraestructura física (granges, zones, corts)
- **Lots** — gestió de l'agrupació d'animals (pendent d'implementar, veure secció 5)

Motiu: són conceptualment diferents. Granja/Corts gestiona **espais físics**; Lots gestiona **grups d'animals**. Barrejar-los en una sola pantalla no reflectia bé aquesta distinció.

### 0.2. Multi-granja: ja suportat per la BD des del principi

La base de dades **ja preveia múltiples granges per tenant** des del disseny original (`02_model_de_dades.md`), simplement mai s'havia exposat a la interfície:

```
ubicacions (1 fila = 1 granja/finca física)
  └── zones_infraestructura (naus, coberts, pastures d'aquella ubicació)
        └── corts (dins de zones de tipus NAU_ANIMALS)
```

No calia cap canvi d'esquema de BD per a aquest mòdul — només construir la interfície sobre l'estructura ja existent.

---

## 1. Descripció General

Aquest mòdul gestiona la jerarquia completa d'infraestructura física de l'explotació: **Granja → Zona → Cort**, amb creació i edició a cada nivell.

**Rols amb accés:**
- **Admin i Veterinari** — Accés complet (consulta + crear/editar granges, zones i corts)
- **Treballador** — Només consulta (lectura)

---

## 2. Jerarquia de Dades

| Nivell | Taula BD | Descripció |
|--------|----------|-----------|
| **Granja** | `ubicacions` | Finca física. Camp opcional `codi_pastura_extensiu` per a explotacions extensives |
| **Zona** | `zones_infraestructura` | Nau d'animals, cobert d'emmagatzematge o pastura, dins d'una granja |
| **Cort** | `corts` | Espai físic per allotjar animals, dins d'una zona de tipus `NAU_ANIMALS` |

### 2.1. Restricció de tipus de zona per a corts

Una **cort només pot existir dins d'una zona de tipus `NAU_ANIMALS`** — restricció aplicada per un trigger de BD (`trg_corts_zona_tipus`, ja existent des del disseny original). El formulari de creació de corts filtra el desplegable de zones per mostrar només les `NAU_ANIMALS`, però la BD és la barrera real: si s'hi arribés amb una zona incorrecta (per exemple, per una crida directa a l'API), l'endpoint intercepta l'error del trigger i retorna un `422` amb missatge clar en comptes d'un `500` genèric.

### 2.2. El tipus de zona no es pot canviar un cop creada

Si una zona ja té corts o magatzems associats, canviar-ne el tipus trencaria la relació validada pels triggers de BD. Per això el formulari d'edició de zona bloqueja el camp "Tipus de zona" — per canviar-lo cal eliminar la zona i crear-ne una de nova (l'eliminació no està implementada en aquesta primera versió, veure secció 5).

---

## 3. Interfície: Arbre Jeràrquic

La pantalla principal mostra un **arbre expansible** de tres nivells:

```
📦 Granja la Ranella                    [✏️] [+ Zona]
  └─ 🗂️ Nau Nord (Nau d'animals)         [✏️] [+ Cort]
       └─ ▦ Cort A1                      [✏️]
       └─ ▦ Cort A2                      [✏️]
  └─ 🗂️ Cobert Est (Cobert emmagatzematge) [✏️]
  └─ 🗂️ Pastura Sud (Pastura)             [✏️]
```

- Cada nivell es pot expandir/col·lapsar independentment.
- Les corts només es poden crear des d'una zona `NAU_ANIMALS` — el botó "+ Cort" no apareix a la resta de tipus de zona.
- Els botons d'edició i creació (llapis, "+") **no es mostren per al rol Treballador** — només visualitza l'arbre.

---

## 4. Endpoints API

| Endpoint | Mètode | Rol | Descripció |
|---|---|---|---|
| `/api/infraestructura` | GET | Tots (lectura) | Jerarquia completa Granja → Zona → Cort |
| `/api/infraestructura` | POST | Admin, Veterinari | Crear una granja nova |
| `/api/infraestructura/[id]` | PATCH | Admin, Veterinari | Actualitzar una granja |
| `/api/infraestructura/zones` | POST | Admin, Veterinari | Crear una zona nova |
| `/api/infraestructura/zones/[id]` | PATCH | Admin, Veterinari | Actualitzar el nom d'una zona |
| `/api/infraestructura/corts` | POST | Admin, Veterinari | Crear una cort nova (validada contra NAU_ANIMALS) |
| `/api/infraestructura/corts/[id]` | PATCH | Admin, Veterinari | Actualitzar una cort |

> **Nota de permisos:** el `GET` és obert als 3 rols; tots els `POST`/`PATCH` (escriptura) estan restringits a Admin i Veterinari. El Treballador veu l'arbre complet però sense cap botó d'acció.

---

## 5. Fora d'Abast d'Aquesta Versió

| Funcionalitat | Estat |
|---|---|
| Eliminar granges, zones o corts | ❌ Pendent |
| Canviar el tipus d'una zona existent | ❌ Bloquejat per disseny (veure secció 2.2) — cal eliminar i recrear |
| Mòdul **Lots** (crear lots, moure animals entre lots) | ❌ Pendent — segon lliurament acordat, separat d'aquest |

---

## 6. Taules de Base de Dades Implicades

| Taula | Operació |
|-------|---------|
| `ubicacions` | Lectura, INSERT, UPDATE |
| `zones_infraestructura` | Lectura, INSERT, UPDATE (nom) |
| `corts` | Lectura, INSERT, UPDATE |

> DDL complet: [`02_model_de_dades.md`](./02_model_de_dades.md), secció "Infraestructura Física".

---

## 7. Fitxers del Projecte

| Fitxer | Responsabilitat |
|---|---|
| `src/types/infraestructura.ts` | Tipus TypeScript: Ubicacio, ZonaInfraestructura, Cort i la jerarquia niada |
| `src/lib/validators/infraestructura.ts` | Schemas Zod per als 3 nivells |
| `src/lib/db/queries/infraestructura.ts` | Totes les queries: jerarquia completa, CRUD dels 3 nivells |
| `src/app/api/infraestructura/route.ts` | GET (jerarquia) i POST (crear granja) |
| `src/app/api/infraestructura/[id]/route.ts` | PATCH (actualitzar granja) |
| `src/app/api/infraestructura/zones/route.ts` | POST (crear zona) |
| `src/app/api/infraestructura/zones/[id]/route.ts` | PATCH (actualitzar zona) |
| `src/app/api/infraestructura/corts/route.ts` | POST (crear cort), amb captura de l'error de trigger NAU_ANIMALS |
| `src/app/api/infraestructura/corts/[id]/route.ts` | PATCH (actualitzar cort) |
| `src/hooks/useInfraestructura.ts` | Orquestra la càrrega i totes les mutacions client |
| `src/components/infraestructura/ArbreInfraestructura.tsx` | Arbre expansible amb accions condicionades per rol |
| `src/components/infraestructura/ModalGranja.tsx` | Modal de creació/edició de granja |
| `src/components/infraestructura/ModalZona.tsx` | Modal de creació/edició de zona (tipus bloquejat en edició) |
| `src/components/infraestructura/ModalCort.tsx` | Modal de creació/edició de cort |
| `src/app/(app)/granja-corts/page.tsx` | Pàgina principal, orquestra l'arbre i els 6 possibles modals |
