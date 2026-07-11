# 08 — Mòdul de Llistat d'Animals Actius i Altes Massives

> **Versió:** 1.3.0  
> **Última actualització:** Juliol de 2026  
> **Basat en:** Disseny_Webapp_Gestió_Ramadera_Bovina_-_Pantalla_Llistat_Actius_i_Altes_Massives_V1.docx

---

## 0. Estat d'Implementació

### 0.1. Decisió: DIB com a únic identificador (fusió amb "crotal")

El disseny original (V1 del document funcional) tractava `crotal_id` i `dib` com dos camps separats. Aclarit amb l'usuari: **el DIB (Document d'Identificació Bovina) i el crotal físic a l'orella són la mateixa dada** — el crotal és la representació física del mateix número que consta al document DIB oficial. Mantenir-los com a columnes separades era redundant i obria la porta a inconsistències.

**Canvi aplicat:** la taula `animals` té un únic camp `dib VARCHAR(50) NOT NULL UNIQUE`. La columna `crotal_id` ha estat eliminada. Migració disponible a [`database/06_migracio_dib_unic.sql`](../database/06_migracio_dib_unic.sql).

### 0.2. Decisió: Alta individual ampliada a Admin i Veterinari

El disseny original (secció 5) reservava l'alta individual exclusivament a Admin, igual que l'alta massiva. Decisió de l'usuari: **l'alta individual també l'ha de poder fer un Veterinari**, perquè sovint és qui rep i registra un animal nou durant una visita a la granja. L'alta **massiva** es manté exclusiva d'Admin. Aquesta diferència de permisos entre les dues vies d'alta s'ha actualitzat també a [`04_seguretat_i_rols.md`](./04_seguretat_i_rols.md).

| Funcionalitat | Estat | Detall |
|---|---|---|
| Llistat d'animals actius (secció 2.2 vista global) | ✅ Implementat | `GET /api/animals`, taula amb raça/lot/cort/estat de salut/edat |
| Cercador ràpid pel DIB (secció 2.1) | ✅ Implementat | Debounce 250ms, `GET /api/animals?cerca=` |
| Indicador de bloqueig comercial (secció 2.3) | ✅ Implementat | Icona sense xifra de dies (detall exacte pendent de la fitxa individual) |
| Altes massives per CSV (secció 4) | ✅ Implementat | Només CSV en aquesta versió; Excel (.xlsx) pendent |
| Lot opcional per fila al CSV | ✅ Implementat | Ampliació sobre el disseny original — veure secció 4.2 |
| **Alta individual (secció 5)** | ✅ **Implementat** | Modal amb formulari; **Admin i Veterinari** (ampliació — veure 0.2) |
| Selector de vista Per Cort / Per Lot (secció 2.2) | ❌ Pendent | Ara mateix només "Tots els actius" |
| Edició ràpida de mètriques a la graella (secció 2.3-2.4) | ❌ Pendent | Pes/llet amb Intro/Tab, offline |
| Selecció múltiple i accions massives (secció 3) | ❌ Pendent | Canviar lot, dividir lot, assignar cort |
| Filtres en cascada Granja → Zona → Lot | ✅ Implementat | Desplegables independents, filtratge 100% al client sobre dades ja carregades |
| Ordenació de columnes (DIB, raça, lot, estat salut, edat) | ✅ Implementat | Client-side, sense peticions addicionals al servidor |
| Fitxa completa d'un animal (modal) | ✅ Implementat | Dades bàsiques, ubicació, historial de pesos, historial de tractaments |
| Donar de baixa des de la fitxa (venda/mort) | ✅ Implementat | Reutilitza exactament els camps de docs/07_modul_arxiu_historic.md |


---

## 1. Descripció General

Aquest mòdul és la **interfície de treball diari** de la granja. Dissenyat per a una entrada de dades ràpida i àgil des de dispositius mòbils o tauletes a peu de cort, combina tres funcionalitats principals:

- **Llistat d'Animals Actius:** Graella tipus full de càlcul per al registre diari de mètriques.
- **Altes Massives:** Importació d'animals nous mitjançant fitxer CSV.
- **Alta Individual:** Formulari directe per donar d'alta un animal a la vegada.

**Rols amb accés:**
- **Admin** — Accés total (llistat, altes individuals, altes massives, gestió de lots)
- **Veterinari** — Lectura del llistat i fitxes d'animals + **alta individual**
- **Treballador** — Registre diari a la graella (pes, llet, estat de salut bàsic)

---

## 2. Pantalla: Llistat d'Animals Actius

### 2.1. Cercador Intel·ligent

- Situat a la part superior central de la pantalla.
- Filtra la graella en **temps real** a mesura que l'usuari escriu dígits del DIB.
- En esborrar el text, la llista torna a mostrar tots els animals de la selecció activa (cort o lot).
- Permet localitzar un animal sense conèixer el lot o cort on es troba.

### 2.2. Estructura de la Graella (Vista Actual)

| Columna | Contingut |
|---------|-----------|
| **DIB** | Identificador únic de l'animal |
| **Raça** | Raça assignada (del catàleg) |
| **Lot / Cort** | Ubicació actual de l'animal |
| **Estat de Salut** | `Sa`, `En tractament`, `Observació`, `Crític` |
| **Edat (dies)** | Calculada des de `data_naixement` |
| **Indicador de Supressió** | Icona si l'animal té bloqueig comercial actiu |

> El selector de vista "Per Cort" / "Per Lot" i l'edició ràpida de mètriques (pes/llet amb Intro/Tab) són pendents — veure secció 0.

---

## 3. Gestió de Lots i Accions Massives

**Pendent d'implementar.** Disseny previst al document funcional original: selecció múltiple d'animals amb checkboxes, i accions de canviar de lot, dividir lot, i assignar ubicació/cort en bloc.

---

## 4. Pantalla: Altes Massives d'Animals

### 4.1. Accés

Botó **"Alta massiva"**, visible només per a **Admin**, a la pantalla de llistat d'animals actius.

### 4.2. Format del Fitxer d'Importació

**Formats suportats:** CSV (separador coma). Excel (`.xlsx`) queda fora d'abast d'aquesta versió.

**Columnes del fitxer:**

| Columna | Tipus | Obligatori | Descripció |
|---------|-------|-----------|-----------|
| `dib` | VARCHAR(50) | ✅ | Identificador oficial de l'animal (DIB) |
| `data_naixement` | DATE (AAAA-MM-DD) | ❌ | Data de naixement de l'animal |
| `sexe` | VARCHAR(10) | ❌ | `Mascle` o `Femella` |
| `lot_nom` | VARCHAR(100) | ❌ | Nom del lot per a aquest animal concret, si es vol diferent del lot per defecte del pas 2 |

> La raça i la cort de destí **no s'especifiquen per fila** — s'assignen globalment a tot el bloc al pas 2. El lot **sí es pot personalitzar per fila** mitjançant `lot_nom`.

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
   · Fila vàlida → fons blanc
   · dib duplicat (intern) → fons vermell, bloquejat
   · dib ja a la BD → fons taronja, advertència (es pot ometre)
   · Altre error de format → fons taronja, editable
        │
        ▼
4. [Assignació Base Inicial] (en un sol pas per a tot el bloc)
   · Seleccionar Raça
   · Seleccionar Lot per defecte (existent o crear nou)
     — les files amb lot_nom propi l'ignoren i usen el seu
   · Seleccionar Cort/Nau de destí
        │
        ▼
5. [Confirmar Alta]
   Si alguna fila indica lot_nom, es resol (o es crea) el lot abans
   d'inserir els animals.
   INSERT INTO animals (dib, raca_id, data_naixement, sexe, estat_actiu=TRUE)
   INSERT INTO distribucio_animals (animal_id, lot_id, cort_id, data_entrada=TODAY)
   INSERT INTO public.audit_log (accio='ALTA_MASSIVA', nº registres, ...)
```

### 4.4. Gestió d'Errors en la Importació

| Tipus d'Error | Comportament |
|---------------|-------------|
| Format de fitxer no reconegut | Error crític: rebutja el fitxer |
| Capçalera incorrecta | Error crític: rebutja el fitxer |
| `dib` duplicat dins del fitxer | Fila bloquejada (vermell) |
| `dib` ja existent a la BD | Advertència (taronja), es pot ometre |
| `data_naixement` en format incorrecte | Fila editable (taronja) |
| `sexe` amb valor no reconegut | Fila editable (taronja) |

---

## 5. Alta Individual d'un Animal

### 5.1. Accés

Botó **"Alta individual"**, visible per a **Admin i Veterinari**, a la pantalla de llistat d'animals actius. Obre un modal amb un formulari directe (sense pas de previsualització, a diferència de l'alta massiva).

### 5.2. Camps del Formulari

| Camp | Obligatori | Descripció |
|------|-----------|-----------|
| DIB | ✅ | Identificador únic de l'animal |
| Raça | ❌ | Desplegable del catàleg |
| Data de naixement | ❌ | Selector de data |
| Sexe | ❌ | `Mascle` / `Femella` |
| Lot | ✅ | Desplegable dels lots existents |
| Cort / Nau | ✅ | Desplegable de les corts existents |

### 5.3. Validacions

- El DIB es valida contra la BD abans de confirmar; si ja existeix, l'endpoint retorna `409` amb missatge clar (`"Aquest DIB ja existeix a la base de dades"`).
- Lot i cort són obligatoris (a diferència de l'alta massiva, on el lot pot resoldre's més tard): en una alta individual no té sentit deixar l'animal sense ubicació.

---

### 5b. Filtres, Ordenació i Fitxa de Detall

**Filtres en cascada:** Tres desplegables independents (Granja, Nau, Lot) sobre la taula d'animals actius. El filtratge es fa íntegrament al client, sobre les dades ja carregades per `GET /api/animals` — no genera peticions addicionals. Els catàlegs per als desplegables provenen de `GET /api/animals/filtres`.

**Ordenació de columnes:** Clicant la capçalera de DIB, Raça, Lot/Cort, Estat de salut o Edat s'ordena la taula (asc → desc → sense ordre). Igual que els filtres, és 100% client-side.

**Fitxa de l'animal:** En clicar una fila de la taula (fora de la casella de selecció) s'obre un modal amb:
- Dades bàsiques (DIB, raça, sexe, data de naixement, edat, estat de salut)
- Ubicació actual (granja, nau, cort, lot)
- Historial complet de pesos registrats
- Historial complet de tractaments (medicació)
- Botó "Donar de baixa" (només si l'animal és actiu i el rol ho permet)

**Permisos del botó de baixa des de la fitxa:** Admin i Veterinari (ampliació sobre docs/07_modul_arxiu_historic.md, secció 1, que reservava el registre de baixes exclusivament a Admin dins del mòdul Arxiu). Treballador veu la fitxa completa però sense el botó.

---

## 6. Taules de Base de Dades Implicades

| Taula | Operació |
|-------|---------|
| `animals` | Alta (INSERT) |
| `distribucio_animals` | Alta de distribució inicial |
| `races_cataleg` | Lectura per assignació de raça |
| `lots` | Lectura per assignació; INSERT si es crea lot nou |
| `corts` | Lectura per assignació de cort |
| `public.audit_log` | Registre d'altes individuals (`ALTA_INDIVIDUAL`) i massives (`ALTA_MASSIVA`) |

---

## 7. Detall Tècnic de la Implementació Actual

**getAnimalsActius() ja no es basa en v_animals_actius.** La vista SQL original només exposava els NOMS de lot/cort/zona, no els seus ids — necessaris per al filtratge en cascada. La query es va reescriure amb un JOIN directe que exposa també `lotId`, `cortId`, `zonaId` i `ubicacioId`, sense necessitat de modificar el DDL de la vista.

### 7.1. Endpoints API

| Endpoint | Mètode | Rol | Descripció |
|---|---|---|---|
| `/api/animals` | GET | Tots | Llistat d'actius; `?cerca=` per filtrar pel DIB |
| `/api/animals` | POST | Admin, Veterinari | Alta individual |
| `/api/animals/catalegs` | GET | Admin, Veterinari | Races, lots i corts per als desplegables |
| `/api/animals/comprovar-duplicats` | POST | Admin | Comprova DIB existents (previsualització alta massiva) |
| `/api/animals/bulk-import` | POST | Admin | Resol lots per fila, revalida duplicats, confirma la importació |
| `/api/animals/filtres` | GET | Tots | Catàlegs de Granja/Zona/Lot per als desplegables |
| `/api/animals/[id]` | GET | Tots | Fitxa completa de l'animal |
| `/api/animals/[id]/baixa` | POST | Admin, Veterinari | Registra la baixa (venda o mort) |

### 7.2. Format del CSV (implementat)

Capçalera exacta esperada:
```
dib,data_naixement,sexe,lot_nom
```

Parsejat amb **PapaParse** al client (`src/hooks/useAltaMassiva.ts`).

### 7.3. Decisió: repartiment de responsabilitats en la detecció de duplicats

- **Duplicats interns** (mateix DIB repetit al fitxer): detectats íntegrament al client, bloquegen la importació.
- **Duplicats contra la BD** (alta massiva): comprovats en dues passades — previsualització (`POST /api/animals/comprovar-duplicats`) i revalidació final a `POST /api/animals/bulk-import` (retorna `409` si en troba).
- **Duplicats contra la BD** (alta individual): `POST /api/animals` intercepta l'error de constraint `UNIQUE` de PostgreSQL (codi `23505`) i el tradueix a un `409` amb missatge clar, en comptes de deixar-lo com a error genèric 500.

### 7.4. Resolució de lots i transacció d'importació massiva

`POST /api/animals/bulk-import` crida `resoldreLotsPerNom()` per convertir els `lot_nom` de les files en IDs reals abans d'inserir. `importarAnimalsMassiu()` (`src/lib/db/queries/animals.ts`) resol el lot **per defecte** i després insereix, en una única transacció, tots els animals i les seves distribucions — cada fila usa el seu `lotId` propi si en té, o el per defecte. Si qualsevol INSERT falla, tot el bloc es desfà.

### 7.5. Alta individual: transacció i traçabilitat

`crearAnimalIndividual()` insereix l'animal i la seva distribució inicial dins la mateixa transacció que aplica `queryTenant()`. L'endpoint registra l'acció a `public.audit_log` amb `accio='ALTA_INDIVIDUAL'` i el `dib` de l'animal creat.

### 7.6. Propagació del rol a les pàgines client

`SessioProvider`/`useSessio()` (`src/lib/session/SessioContext.tsx`), muntat a `AppShell`, exposa `rol` i `nom` (ja resolts pel Server Component `layout.tsx`) a totes les pàgines filles sense peticions addicionals. Aquest valor és només a efectes d'UI; la protecció real és sempre a l'endpoint.

### 7.7. Fitxers del Projecte

| Fitxer | Responsabilitat |
|---|---|
| `src/lib/validators/animals.ts` | Schemas Zod: alta individual, fila de CSV, assignació base, payload complet |
| `src/lib/db/queries/animals.ts` | Totes les queries: llistat, cerca, catàlegs, resolució de lots, alta individual i massiva |
| `src/app/api/animals/route.ts` | GET (llistat) i POST (alta individual) |
| `src/app/api/animals/catalegs/route.ts` | Catàlegs per als desplegables |
| `src/app/api/animals/comprovar-duplicats/route.ts` | Comprovació de duplicats (alta massiva) |
| `src/app/api/animals/bulk-import/route.ts` | Confirmació de l'alta massiva |
| `src/hooks/useAltaMassiva.ts` | Orquestra el flux client de l'alta massiva |
| `src/components/animals/TaulaAnimals.tsx` | Taula del llistat amb cercador |
| `src/components/animals/ModalAltaMassiva.tsx` | Modal dels 3 passos de l'alta massiva |
| `src/components/animals/ModalAltaIndividual.tsx` | Modal del formulari d'alta individual |
| `src/lib/session/SessioContext.tsx` | Context per exposar rol/nom a les pàgines filles |
