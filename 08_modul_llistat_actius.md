# 08 — Mòdul de Llistat d'Animals Actius i Altes Massives

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026  
> **Basat en:** Disseny_Webapp_Gestió_Ramadera_Bovina_-_Pantalla_Llistat_Actius_i_Altes_Massives_V1.docx

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
- Filtra la graella en **temps real** a mesura que l'usuari escriu dígits del crotal.
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

**Formats suportats:** CSV (separador coma) o Excel (`.xlsx`)

**Columnes del fitxer:**

| Columna | Tipus | Obligatori | Descripció |
|---------|-------|-----------|-----------|
| `crotal_id` | VARCHAR(20) | ✅ | Identificador oficial del crotal auricular |
| `dib` | VARCHAR(50) | ❌ | Codi del Document d'Identificació Bovina |
| `data_naixement` | DATE (AAAA-MM-DD) | ❌ | Data de naixement de l'animal |
| `sexe` | VARCHAR(10) | ❌ | `Mascle` o `Femella` |

> **Nota:** La raça, el lot inicial i la cort de destí **no s'especifiquen per fila** al fitxer. S'assignen globalment a tots els animals importats en un pas posterior (vegeu secció 4.3).

**Exemple de fitxer CSV:**
```csv
crotal_id,dib,data_naixement,sexe
ES040123456789,DIB-001-2026,2026-01-15,Mascle
ES040123456790,DIB-002-2026,2026-01-18,Femella
ES040123456791,,2026-01-20,Mascle
```

### 4.3. Flux d'Importació

```
1. Usuari puja el fitxer (CSV o Excel)
        │
        ▼
2. [Validació automàtica]
   · Format de columnes correcte?
   · crotal_id duplicat dins del fitxer?
   · crotal_id ja existent a la BD?
        │
        ▼
3. [Pantalla de Previsualització]
   Llista provisional amb tots els animals detectats:
   · Fila vàlida → fons blanc
   · crotal_id duplicat (intern) → fons vermell, bloquejat
   · crotal_id ja a la BD → fons taronja, advertència
   · Altre error de format → fons taronja, editable
        │
        ▼
4. [Assignació Base Inicial] (en un sol pas per a tot el bloc)
   · Seleccionar Raça (desplegable del catàleg)
   · Seleccionar Lot inicial (existent o crear nou)
   · Seleccionar Cort/Nau de destí
        │
        ▼
5. [Confirmar Alta]
   Per cada animal vàlid del fitxer:
     INSERT INTO animals (crotal_id, dib, raca_id, data_naixement, sexe, estat_actiu=TRUE)
     INSERT INTO distribucio_animals (animal_id, lot_id, cort_id, data_entrada=TODAY)
   INSERT INTO public.audit_log (accio='ALTA_MASSIVA', nº registres, ...)
```

### 4.4. Gestió d'Errors en la Importació

| Tipus d'Error | Comportament |
|---------------|-------------|
| Format de fitxer no reconegut | Error crític: rebutja el fitxer, mostra missatge |
| Capçalera incorrecta | Error crític: rebutja el fitxer |
| `crotal_id` duplicat dins del fitxer | Fila bloquejada (vermell): no es pot importar fins que es corregeixi |
| `crotal_id` ja existent a la BD | Advertència (taronja): l'usuari pot desmarcar la fila per ometre-la |
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
