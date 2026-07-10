# 08 — Mòdul de Llistat d'Animals Actius i Altes Massives

> **Versió:** 1.2.0  
> **Última actualització:** Juliol de 2026  
> **Basat en:** Disseny_Webapp_Gestió_Ramadera_Bovina_-_Pantalla_Llistat_Actius_i_Altes_Massives_V1.docx

---

## 0. Estat d'Implementació

### 0.1. Decisió: DIB com a únic identificador (fusió amb "crotal")

El disseny original (V1 del document funcional) tractava `crotal_id` i `dib` com dos camps separats. Aclarit amb l'usuari: **el DIB (Document d'Identificació Bovina) i el crotal físic a l'orella són la mateixa dada** — el crotal és la representació física del mateix número que consta al document DIB oficial. Mantenir-los com a columnes separades era redundant i obria la porta a inconsistències (què passa si s'omple un i no l'altre, o amb valors diferents).

**Canvi aplicat:** la taula `animals` té ara un únic camp `dib VARCHAR(50) NOT NULL UNIQUE`. La columna `crotal_id` ha estat eliminada. Migració disponible a [`database/06_migracio_dib_unic.sql`](../database/06_migracio_dib_unic.sql) (recreació neta, vàlida només si la taula `animals` encara no tenia dades reals).

| Funcionalitat | Estat | Detall |
|---|---|---|
| Llistat d'animals actius (secció 2.2 vista global) | ✅ Implementat | `GET /api/animals`, taula amb raça/lot/cort/estat de salut/edat |
| Cercador ràpid pel DIB (secció 2.1) | ✅ Implementat | Debounce 250ms, `GET /api/animals?cerca=` |
| Indicador de bloqueig comercial (secció 2.3) | ✅ Implementat | Icona sense xifra de dies (detall exacte pendent de la fitxa individual) |
| Altes massives per CSV (secció 4) | ✅ Implementat | Només CSV en aquesta versió; Excel (.xlsx) pendent |
| Lot opcional per fila al CSV | ✅ Implementat | Ampliació sobre el disseny original — veure secció 4.2 |
| Alta individual (secció 5) | ⚠️ Backend fet, sense UI | `crearAnimalIndividual()` a queries/animals.ts existeix; falta el formulari |
| Selector de vista Per Cort / Per Lot (secció 2.2) | ❌ Pendent | Ara mateix només "Tots els actius" |
| Edició ràpida de mètriques a la graella (secció 2.3-2.4) | ❌ Pendent | Pes/llet amb Intro/Tab, offline |
| Selecció múltiple i accions massives (secció 3) | ❌ Pendent | Canviar lot, dividir lot, assignar cort |

---

## 1. Descripció General

Aquest mòdul és la **interfície de treball diari** de la granja. Dissenyat per a una entrada de dades ràpida i àgil des de dispositius mòbils o tauletes a peu de cort, combina dues funcionalitats principals:

- **Llistat d'Animals Actius:** Graella tipus full de càlcul per al registre diari de mètriques.
- **Altes Massives:** Importació d'animals nous mitjançant fitxer CSV o Excel.

**Rols amb accés:**
- **Admin** — Accés total (llistat, altes individuals, altes massives, gestió de lots)
- **Veterinari** — Només lectura del llistat i fitxes d'animals
- **Treballador** — Registre diari a la graella (pes, llet, estat de salut bàsic)

---

## 2. Pantalla: Llistat d'Animals Actius

### 2.1. Cercador Intel·ligent

- Situat a la part superior central de la pantalla.
- Filtra la graella en **temps real** a mesura que l'usuari escriu dígits del DIB.
- En esborrar el text, la llista torna a mostrar tots els animals de la selecció activa (cort o lot).
- Permet localitzar un animal sense conèixer el lot o cort on es troba.

### 2.2. Selector de Visualització

Abans de la graella, l'usuari pot triar com vol veure els animals:

| Mode de Vista | Descripció |
|--------------|-----------|
| **Per Cort** | Mostra els animals d'una cort específica (seleccionable per desplegable) |
| **Per Lot** | Mostra els animals d'un lot específic |
| **Tots els actius** | Vista global de tots els animals amb `estat_actiu = TRUE` |

### 2.3. Estructura de la Graella d'Edició Ràpida

| Columna | Tipus de Camp | Editable | Comportament |
|---------|--------------|---------|-------------|
| **Crotal ID** | Text | ❌ Bloquejat | Identificador únic. No modificable |
| **Raça** | Etiqueta visual | ❌ Bloquejat | Raça assignada (del catàleg) |
| **Lot / Cort** | Text | ❌ Bloquejat | Ubicació actual de l'animal |
| **Mètrica del Dia** | Input numèric | ✅ | Pes (kg) o Litres de llet, segons el tipus d'explotació. Camp actiu per defecte |
| **Estat de Salut** | Desplegable | ✅ (Admin/Vet) | `Sa`, `En tractament`, `Observació`, `Crític` |
| **Indicador Supressió** | Icona visual | ❌ | Mostra si l'animal té bloqueig comercial actiu |

### 2.4. Comportament de la Graella (UX)

- **Flux d'entrada ràpida:** En introduir la mètrica i prémer `Intro` o `Tab`, el sistema **guarda automàticament** el valor i mou el focus a la cel·la del següent animal.
- **Feedback visual immediat:** La cel·la guardada mostra una confirmació visual breu (ex: fons verd) abans de tornar a l'estat normal.
- **Offline:** Si no hi ha connexió, els valors s'emmagatzemen localment i es sincronitzen en reconectar (veure `01_arquitectura_general.md`, secció 3.3).

---

## 3. Gestió de Lots i Accions Massives

### 3.1. Selecció Multiple d'Animals

La graella disposa d'una columna de **caselles de selecció** (checkboxes) a l'esquerra de cada fila. En seleccionar un o més animals:

- Apareix una **barra d'accions** a la part superior o inferior de la pantalla.
- La barra mostra les accions disponibles per al rol actiu.

### 3.2. Accions Massives Disponibles (Admin)

| Acció | Descripció | Impacte a la BD |
|-------|-----------|----------------|
| **Canviar de Lot** | Assigna tots els seleccionats a un lot existent o en crea un de nou | `distribucio_animals`: tanca l'entrada actual i crea nova |
| **Dividir Lot** | Extreu els seleccionats del lot actual per crear-ne una subdivisió | `distribucio_animals`: igual que canviar de lot, però el lot d'origen no es tanca |
| **Assignar Ubicació / Cort** | Mou el grup seleccionat a una altra Nau o Cort física | `distribucio_animals`: actualitza `cort_id` amb nova entrada |

### 3.3. Flux de Canvi de Lot (Detall)

```
Usuari selecciona animals → Prem "Canviar de Lot"
        │
        ▼
Modal: "Selecciona un lot existent o crea'n un de nou"
        │
   ┌────┴────────────┐
  LOT EXISTENT    LOT NOU
   │                  │
   │         Introduir nom del lot
   │                  │
   └────────┬─────────┘
            ▼
   [Confirmar] →
   Per cada animal seleccionat:
     1. UPDATE distribucio_animals
        SET data_sortida = TODAY
        WHERE animal_id = X AND data_sortida IS NULL
     2. INSERT distribucio_animals
        (animal_id, lot_id_nou, cort_id_actual, data_entrada = TODAY)
```

---

## 4. Pantalla: Altes Massives d'Animals

### 4.1. Descripció

Mòdul per introduir animals nous a la plataforma de manera massiva, optimitzat per al moment de compra de nous caps de bestiar (quan arriba una partida de vedells, per exemple).

### 4.2. Format del Fitxer d'Importació

**Formats suportats:** CSV (separador coma). Excel (`.xlsx`) queda fora d'abast d'aquesta primera versió.

**Columnes del fitxer:**

| Columna | Tipus | Obligatori | Descripció |
|---------|-------|-----------|-----------|
| `dib` | VARCHAR(50) | ✅ | Identificador oficial de l'animal (DIB). El crotal físic a l'orella porta el mateix número — no és un camp separat |
| `data_naixement` | DATE (AAAA-MM-DD) | ❌ | Data de naixement de l'animal |
| `sexe` | VARCHAR(10) | ❌ | `Mascle` o `Femella` |
| `lot_nom` | VARCHAR(100) | ❌ | Nom del lot per a **aquest animal concret**, si es vol diferent del lot per defecte assignat al pas 2. Si no s'informa, s'aplica el lot per defecte |

> **Nota:** La raça i la cort de destí **no s'especifiquen per fila** al fitxer — s'assignen globalment a tot el bloc importat en un pas posterior (vegeu secció 4.3). El lot **sí es pot personalitzar per fila** mitjançant `lot_nom` (ampliació sobre el disseny original, per permetre repartir animals en diversos lots dins d'una mateixa importació); si una fila no l'indica, s'aplica el lot per defecte del pas 2.

**Exemple de fitxer CSV:**
```csv
dib,data_naixement,sexe,lot_nom
ES040123456789,2026-01-15,Mascle,
ES040123456790,2026-01-18,Femella,Lot Mares
ES040123456791,2026-01-20,Mascle,
```

### 4.3. Flux d'Importació

```
1. Usuari puja el fitxer (CSV)
        │
        ▼
2. [Validació automàtica]
   · Format de columnes correcte?
   · dib duplicat dins del fitxer?
   · dib ja existent a la BD?
        │
        ▼
3. [Pantalla de Previsualització]
   Llista provisional amb tots els animals detectats:
   · Fila vàlida → fons blanc
   · dib duplicat (intern) → fons vermell, bloquejat
   · dib ja a la BD → fons taronja, advertència
   · Altre error de format → fons taronja, editable
        │
        ▼
4. [Assignació Base Inicial] (en un sol pas per a tot el bloc)
   · Seleccionar Raça (desplegable del catàleg)
   · Seleccionar Lot per defecte (existent o crear nou)
     — les files amb lot_nom propi l'ignoren i usen el seu
   · Seleccionar Cort/Nau de destí
        │
        ▼
5. [Confirmar Alta]
   Si alguna fila indica lot_nom, es resol (o es crea) el lot abans
   d'inserir els animals.
   Per cada animal vàlid del fitxer:
     INSERT INTO animals (dib, raca_id, data_naixement, sexe, estat_actiu=TRUE)
     INSERT INTO distribucio_animals (animal_id, lot_id, cort_id, data_entrada=TODAY)
       — lot_id: el propi de la fila (lot_nom) si en té, si no el per defecte
   INSERT INTO public.audit_log (accio='ALTA_MASSIVA', nº registres, ...)
```

### 4.4. Gestió d'Errors en la Importació

| Tipus d'Error | Comportament |
|---------------|-------------|
| Format de fitxer no reconegut | Error crític: rebutja el fitxer, mostra missatge |
| Capçalera incorrecta | Error crític: rebutja el fitxer |
| `dib` duplicat dins del fitxer | Fila bloquejada (vermell): no es pot importar fins que es corregeixi |
| `dib` ja existent a la BD | Advertència (taronja): l'usuari pot desmarcar la fila per ometre-la |
| `data_naixement` en format incorrecte | Fila editable (taronja): es pot corregir en pantalla |
| `sexe` amb valor no reconegut | Fila editable (taronja): es pot corregir en pantalla |

---

## 5. Alta Individual d'un Animal

A més de la càrrega massiva, l'Admin pot donar d'alta un animal individual des d'un formulari estàndard amb tots els camps de la taula `animals` i l'assignació directa de raça, lot i cort.

---

## 6. Taules de Base de Dades Implicades

| Taula | Operació |
|-------|---------|
| `animals` | Alta (INSERT), actualització d'estat de salut (UPDATE) |
| `distribucio_animals` | Alta de distribució inicial, tancament i reobertura en canvis de lot/cort |
| `registre_pes` | Alta de registres diaris de pes |
| `registre_llet` | Alta de registres diaris de llet |
| `races_cataleg` | Lectura per assignació de raça |
| `lots` | Lectura per assignació; INSERT si es crea lot nou |
| `corts` | Lectura per assignació de cort |
| `public.audit_log` | Registre d'altes individuals i massives |

---

## 7. Detall Tècnic de la Implementació Actual

### 7.1. Endpoints API

| Endpoint | Mètode | Rol | Descripció |
|---|---|---|---|
| `/api/animals` | GET | Tots | Llistat d'actius; `?cerca=` per filtrar pel DIB |
| `/api/animals/catalegs` | GET | Admin | Races, lots i corts per als desplegables |
| `/api/animals/comprovar-duplicats` | POST | Admin | Comprova DIB existents (pas de previsualització) |
| `/api/animals/bulk-import` | POST | Admin | Resol lots per fila, revalida duplicats, confirma la importació |

### 7.2. Format del CSV (implementat)

Capçalera exacta esperada (en minúscules, `transformHeader` normalitza automàticament):
```
dib,data_naixement,sexe,lot_nom
```

Parsejat amb **PapaParse** al client (`src/hooks/useAltaMassiva.ts`). La raça i la cort **no** van al fitxer — s'assignen en un pas posterior comú a tot el bloc. El lot **sí pot anar per fila** (`lot_nom`), sobreescrivint el lot per defecte del pas 2 només per a aquell animal.

### 7.3. Decisió: repartiment de responsabilitats en la detecció de duplicats

- **Duplicats interns** (mateix DIB repetit al fitxer): detectats íntegrament al client, bloquegen la importació (fila vermella).
- **Duplicats contra la BD**: comprovats en dues passades — primer al pas de previsualització (`POST /api/animals/comprovar-duplicats`, informatiu, permet ometre la fila), i **revalidats de nou** a `POST /api/animals/bulk-import` just abans d'inserir, per si dos Admins importessin el mateix DIB simultàniament entre la previsualització i la confirmació (retorna `409` si en troba).

### 7.4. Resolució de lots i transacció d'importació

Abans d'inserir, `POST /api/animals/bulk-import` crida `resoldreLotsPerNom()` per convertir els `lot_nom` de les files (text lliure del CSV) en IDs de lot reals — creant els lots que encara no existeixin. Aquesta resolució és **prèvia** a la transacció d'inserció principal.

`importarAnimalsMassiu()` (`src/lib/db/queries/animals.ts`) resol el lot **per defecte** (existent o el crea) i després insereix, en una única crida a `queryTenant()` (una sola transacció `BEGIN`/`COMMIT`), tots els animals i les seves distribucions inicials — cada fila usa el seu `lotId` propi si en té, o el lot per defecte si no. L'aparellament animal↔lot es fa per `dib`, segur perquè dins d'aquesta transacció cada DIB del bloc és necessàriament únic (ja validat sense duplicats interns ni contra la BD abans d'arribar aquí). Si qualsevol INSERT falla, tot el bloc es desfà.

### 7.5. Propagació del rol a les pàgines client

Per evitar que cada pàgina hagi de fer una petició pròpia només per saber el rol de l'usuari, es va introduir `SessioProvider`/`useSessio()` (`src/lib/session/SessioContext.tsx`), muntat una única vegada a `AppShell` amb el `rol` i `nom` ja resolts pel Server Component `layout.tsx`. Aquest valor és només a efectes d'UI (mostrar/amagar el botó d'alta massiva); la protecció real és sempre a l'endpoint.

### 7.6. Fitxers del Projecte

| Fitxer | Responsabilitat |
|---|---|
| `src/lib/validators/animals.ts` | Schemas Zod: fila de CSV (amb `lot_nom` opcional), assignació base, payload complet |
| `src/lib/db/queries/animals.ts` | Totes les queries: llistat, cerca, catàlegs, resolució de lots per nom, alta individual i massiva |
| `src/app/api/animals/*/route.ts` | Els 4 endpoints (llistat, catàlegs, duplicats, bulk-import) |
| `src/hooks/useAltaMassiva.ts` | Orquestra tot el flux client: parsing, validació, confirmació |
| `src/components/animals/TaulaAnimals.tsx` | Taula del llistat amb cercador |
| `src/components/animals/ModalAltaMassiva.tsx` | Modal dels 3 passos de l'alta massiva |
| `src/lib/session/SessioContext.tsx` | Context per exposar rol/nom a les pàgines filles |
