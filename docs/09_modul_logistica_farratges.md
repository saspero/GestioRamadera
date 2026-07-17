# 09 — Mòdul de Magatzems (fins juliol 2026, "Logística, Farratges i Sitges")

> **Versió:** 1.3.0  
> **Última actualització:** Juliol de 2026  
> **Basat en:** Disseny_Webapp_Gestió_Ramadera_Bovina_-_Mòdul_de_Logística_i_Farratges_V1.docx
> **Nota de nomenclatura:** el mòdul es deia "Logística" fins juliol de 2026, quan es va renombrar a "Magatzems" (títol, pestanyes, aquest document). El canvi és NOMÉS visual — la ruta es manté `/logistica` i tots els endpoints `/api/logistica/*` no han canviat.

---

## 0. Estat d'Implementació

| Funcionalitat | Estat | Detall |
|---|---|---|
| Formulari de Consums Massius (secció 2) | ✅ Implementat | Formulari únic intel·ligent — veure 0.1 |
| Lògica de bales (secció 2.2) | ✅ Implementat | Càlcul i mostra del pes equivalent abans de confirmar |
| Control d'estocs i alertes jeràrquiques (secció 3) | ✅ Implementat | Càlcul NORMAL/BAIX/ESGOTAT amb llindar específic o global |
| Gestió d'estats (toggle Actiu/Deshabilitat) (secció 4) | ✅ Implementat | Exclusiu d'Admin |
| Pantalla de Control d'Estoc (secció 5) | ✅ Implementat | Amb barra visual de capacitat |
| Gestió de Sitges i Magatzems de farratge (secció 4b) | ✅ Implementat (juliol 2026) | CRUD complet — abans no existia cap interfície, calia SQL manual |
| Catàleg de Tipus de Pinso amb components (secció 4c) | ✅ Implementat (juliol 2026) | Codi + nom + composició amb percentatge |
| Filtre del Destí per tipus de zona (secció 2.1) | ✅ Corregit (juliol 2026) | Abans mostrava totes les zones sense filtrar, incloent Coberts d'emmagatzematge |
| Vinculació de sitja/magatzem a una nau/pastura (secció 4d) | ✅ Implementat (juliol 2026) | El Destí es precompleta i bloqueja automàticament en registrar un consum |
| Entrada d'estoc repartida entre diversos silos (secció 4e) | ✅ Implementat (juliol 2026) | Repartiment manual (l'usuari indica la quantitat exacta per a cada destinatari) |

### 0.1. Decisions ampliades sobre el disseny original

- **Un únic formulari, dues taules:** el document defineix un sol formulari de "Consums Massius", però la BD té dues taules diferents (`consums_pinso_nau` per a sitges, `moviments_farratge` per a magatzems de farratge). El formulari detecta automàticament el tipus d'origen seleccionat i escriu a la taula corresponent, sense que l'usuari hagi de triar-la explícitament.
- **Sitges: sempre en kg.** `consums_pinso_nau` no té camp d'unitat (a diferència de `moviments_farratge`). El desplegable d'unitat es restringeix automàticament a `kg` quan l'origen és una sitja, amagant `Tones` i `Unitats (bales)`.
- **Rols mantinguts tal com al disseny original:** aquest és l'únic mòdul on Veterinari **no** té cap accés (ni lectura), a diferència de la resta de mòduls on s'ha ampliat a "només lectura". Decisió confirmada explícitament amb l'usuari.
- **Estoc negatiu:** no es bloqueja el registre d'un consum si l'estoc quedaria negatiu (mateix criteri aplicat a Sanitari) — es mostra com a informació, no com a error bloquejant.
- **v_estoc_magatzems no reutilitzada per a aquesta pantalla:** la vista existent (usada al Dashboard) filtra `WHERE estat = 'Actiu'`, pensada per a les alertes. La pantalla de Control d'Estoc necessita veure també els magatzems deshabilitats — s'ha creat una query pròpia amb la mateixa lògica de càlcul d'alerta, sense aquest filtre.
- **Destí filtrat a Nau d'animals i Pastura (juliol 2026):** el desplegable de Destí del formulari de Consums Massius mostrava totes les zones sense filtrar, incloent Coberts d'emmagatzematge — que no consumeixen aliment, només l'emmagatzemen. Corregit perquè només mostri `NAU_ANIMALS` i `PASTURA`.
- **"Origen buit" no era un bug (juliol 2026):** durant una revisió es va detectar que el desplegable d'Origen sortia sempre buit. Diagnosticat: no era un error de codi — mai havia existit cap interfície per crear sitges o magatzems de farratge, així que la BD estava simplement sense dades a `sitges`/`magatzems_farratge`. Es va construir una pantalla de gestió completa (secció 4b) per resoldre-ho de fons.
- **Catàleg de tipus de pinso (juliol 2026):** `sitges.tipus_pinso` era un camp de text lliure sense cap catàleg gestionable. Es va substituir per `sitges.tipus_pinso_id`, una FK cap a la nova taula `tipus_pinso_cataleg` (codi + nom), amb la composició detallada a `component_pinso` (ingredient + percentatge). Vegeu secció 4c i `database/07_migracio_pinsos_magatzems.sql`.

---

## 1. Descripció General

El Mòdul de Logística gestiona el flux d'aliments dins de la granja: des dels magatzems i sitges fins a les naus o zones de pastura on es consumeix. Inclou el registre de consums massius, el control d'estocs amb alertes jeràrquiques, i la gestió de l'estat operatiu dels espais d'emmagatzematge.

**Rols amb accés:**
- **Admin** — Accés total (consums, estoc, configuració d'alertes, estats de magatzem)
- **Veterinari** — Sense accés
- **Treballador** — Registre de consums massius + consulta d'estoc (lectura)

---

## 2. Pantalla: Consums Massius (Formulari Simple)

Dissenyat per ser un formulari **net, directe i optimitzat** per a ús ràpid diari des de la cabina del tractor o a peu de magatzem.

### 2.1. Camps del Formulari

| Camp | Tipus | Obligatori | Descripció |
|------|-------|-----------|-----------|
| **Origen** | Desplegable | ✅ | Magatzem o sitja d'on s'extreu l'aliment. **Només es mostren els magatzems en estat `Actiu`** |
| **Destí** | Desplegable | ✅ | Nau d'animals o Zona de pastura on es diposita l'aliment. **Filtrat a `NAU_ANIMALS` i `PASTURA`** — un Cobert d'emmagatzematge no hi surt mai (corregit juliol 2026). **Es precompleta i bloqueja automàticament** si l'origen seleccionat té una nau vinculada (secció 4d, juliol 2026) |
| **Quantitat** | Input numèric | ✅ | Xifra extreta del magatzem origen |
| **Unitat de Mesura** | Desplegable | ✅ | `kg`, `Tones`, o `Unitats (Bales)` |
| **Data** | Data | ✅ | Data del moviment (per defecte: avui) |

### 2.2. Lògica Especial per a la Unitat "Unitats (Bales)"

Quan l'usuari selecciona **Unitats** com a unitat de mesura:

1. El sistema llegeix el `pes_mitja_bala_kg` configurat a la fitxa del magatzem origen.
2. Calcula automàticament: `quantitat_kg_real = quantitat_bales × pes_mitja_bala_kg`.
3. Mostra el pes equivalent calculat a l'usuari **abans de confirmar** (ex: *"2 bales = 700 kg"*).
4. Desa `quantitat_kg_real` a la BD per a la deducció correcta de l'estoc.

> **Prerequisit:** Si el `pes_mitja_bala_kg` del magatzem no està configurat, la unitat "Bales" queda deshabilitada per a aquell magatzem i el sistema mostra un avís per configurar-lo.

### 2.3. Accions en Confirmar el Consum

```
1. Validar que quantitat_kg_real <= estoc_actual del magatzem origen
        │
   ┌────┴────┐
  NOK       OK
   │         │
   ▼         ▼
Error:    INSERT INTO moviments_farratge
"Estoc      (magatzem_id, zona_desti_id, data,
insuficient" quantitat, unitat, quantitat_kg_real,
             registrat_per)

          UPDATE sitges/magatzems_farratge
          SET estoc_actual = estoc_actual - quantitat_kg_real

          [Verificar si l'estoc resultant < estoc_minim]
          Si SÍ → Generar alerta al Dashboard
```

---

## 3. Control d'Estocs i Sistema d'Alertes Jeràrquic

### 3.1. Model de Configuració en Cascada

El sistema utilitza un model jeràrquic per determinar el llindar d'alerta de cada magatzem:

| Nivell | Prioritat | Configuració | Cas d'Ús |
|--------|----------|-------------|---------|
| **1. Específica per Magatzem** | Màxima | Camp `estoc_minim` a la fitxa de cada magatzem/sitja | La *Sitja Nord* (petita) alerta a 1 tona; el *Cobert Gran* alerta a 5 tones |
| **2. Configuració General** | Fallback | Panell de Configuració General del tenant | Garanteix que cap magatzem nou quedi sense alerta per descuit |

**Lògica de resolució del llindar:**
```
SI magatzem.estoc_minim_kg IS NOT NULL:
    llindar = magatzem.estoc_minim_kg
SINÓ:
    llindar = configuracio_general.estoc_minim_default_kg
```

### 3.2. Tipus d'Alertes d'Estoc

| Estat | Condició | Indicador Visual | Acció al Dashboard |
|-------|---------|-----------------|-------------------|
| **Normal** | `estoc_actual > llindar` | — | Cap |
| **Alerta (Estoc Baix)** | `estoc_actual <= llindar` | 🟡 Groc | Notificació al tauler d'alertes |
| **Estoc Esgotat** | `estoc_actual = 0` | 🔴 Vermell | Alerta crítica + bloqueig de selecció com a origen |

### 3.3. Silenciament d'Alertes per Magatzems Deshabilitats

Els magatzems en estat `Deshabilitat` no generen alertes al Dashboard (vegeu secció 4). Evita la saturació del tauler amb avisos d'espais que s'han deixat buits intencionadament.

---

## 4. Gestió d'Estats de Magatzems i Sitges

### 4.1. Estats Disponibles

| Estat | Descripció |
|-------|-----------|
| **Actiu** | El magatzem opera normalment. Apareix com a opció seleccionable als formularis de consum |
| **Deshabilitat** | El magatzem no és seleccionable als formularis de consum. Les seves alertes queden silenciades |

### 4.2. Toggle d'Estat (Actiu / Deshabilitat)

A la llista de magatzems, cada element disposa d'un **interruptor visual** per canviar-ne l'estat. L'acció és immediata i reversible.

**Efectes del canvi a `Deshabilitat`:**

| Àmbit | Efecte |
|-------|--------|
| Formulari de Consums Massius | El magatzem **desapareix** del desplegable d'Origen |
| Dashboard — Alertes d'Estoc | Les alertes d'estoc mínim d'aquest magatzem **queden silenciades** |
| Historial de moviments | Les dades passades **no s'esborren** mai. Traçabilitat garantida |
| Informes de costos anuals | El magatzem segueix apareixent als informes historics |

### 4.3. Casos d'Ús del Mode Deshabilitat

- Magatzem buit temporalment (neteja, desinfecció).
- Sitja fora de servei per manteniment.
- Cobert tancat per temporada.

---

## 4b. Pantalla: Gestió de Sitges i Magatzems de Farratge [NOU — juliol 2026]

Fins juliol de 2026 no existia cap interfície per crear o editar sitges ni magatzems de farratge — només es podien donar d'alta manualment per SQL, cosa que en la pràctica significava que la majoria de tenants no en tenien cap, i el desplegable d'Origen del formulari de Consums Massius quedava buit.

### 4b.1. Pestanya "Magatzems"

Dues taules independents, cadascuna amb el seu botó de creació:

**Sitges** (formulari): Nom, Granja (ubicació — no editable un cop creada), Tipus de pinso (desplegable del catàleg, opcional), Estoc actual (kg), Capacitat (kg, opcional), Estoc mínim (kg, opcional — si no s'informa, s'aplica el llindar global).

**Magatzems de farratge** (formulari): Cobert d'emmagatzematge (zona de tipus `COBERT_EMMAGATZEMATGE` — no editable un cop creat), Tipus de farratge (text lliure, Ex: *Palla*, *Alfals*), Estoc actual (tones), Capacitat (tones, opcional), Estoc mínim (tones, opcional), Pes mitjà per bala (kg, opcional — necessari per a consums en unitats/bales).

### 4b.2. Validació de zona

Un magatzem de farratge només es pot crear dins d'una zona de tipus `COBERT_EMMAGATZEMATGE` — restricció ja existent a nivell de base de dades (trigger `trg_magatzem_zona_tipus`, docs/02_model_de_dades.md). El formulari filtra el desplegable de zones per mostrar només les vàlides; si igualment s'hi arribés amb una zona incorrecta (per exemple, via crida directa a l'API), el sistema ho rebutja amb un error clar.

### 4b.3. Rols amb accés

Admin i Treballador (els mateixos que ja tenen accés al mòdul Logística).

---

## 4c. Catàleg de Tipus de Pinso [NOU — juliol 2026]

### 4c.1. Motivació

El camp `tipus_pinso` d'una sitja era text lliure, sense cap catàleg gestionable ni informació sobre la composició del pinso. Es va substituir per un catàleg estructurat.

### 4c.2. Camps del Tipus de Pinso

| Camp | Tipus | Obligatori | Descripció |
|------|-------|-----------|-----------|
| **Codi** | Text curt | ✅ | Identificador curt, únic al tenant (Ex: *PI-ENGREIX-18*) |
| **Nom** | Text | ✅ | Nom descriptiu |
| **Components** | Llista dinàmica | ✅ (mínim 1) | Cada component té un nom (Ex: *Blat de moro*) i un percentatge (0-100) |

### 4c.3. Validació de la composició

La suma dels percentatges de tots els components es mostra en temps real a la interfície com a ajuda visual, però **no bloqueja el desat** si no arriba exactament a 100 — permet desar una composició encara incompleta mentre es va completant la fitxa.

### 4c.4. Ús a les sitges

Cada sitja pot (opcionalment) tenir assignat un tipus de pinso del catàleg. Aquest tipus apareix com a "Tipus" a la pantalla de Control d'Estoc (secció 5).

### 4c.5. Rols amb accés

Admin i Treballador.

---

## 4d. Vinculació de Sitja/Magatzem a una Nau o Pastura [NOU — juliol 2026]

### 4d.1. Motivació

En registrar un consum, l'usuari havia de triar manualment el Destí (nau/pastura) cada vegada, tot i que en la pràctica un silo concret sol alimentar sempre la mateixa nau. Es permet vincular-los opcionalment perquè el sistema ho recordi.

### 4d.2. Comportament

Cada sitja i cada magatzem de farratge pot tenir (opcionalment) una "Nau vinculada", triable entre les zones de tipus `NAU_ANIMALS` i `PASTURA`. Quan un origen amb vinculació se selecciona al formulari de Consums Massius, el camp **Destí es precompleta i bloqueja automàticament** amb la zona vinculada.

### 4d.3. Abast — registre manual, no automàtic

**El registre del consum en si segueix sent una acció manual** (l'usuari continua indicant quantitat i data cada vegada). La vinculació NOMÉS estalvia haver de triar el Destí i evita seleccionar-ne un d'incorrecte — no hi ha cap procés de descompte automàtic ni programat.

### 4d.4. Validació

La zona vinculada ha de ser `NAU_ANIMALS` o `PASTURA` (mai un Cobert d'emmagatzematge) — validat per un trigger de BD (`trg_sitges_zona_vinculada`/`trg_magatzem_zona_vinculada`, `database/09_migracio_vinculacio_zona.sql`), amb el desplegable del formulari ja filtrat per evitar l'error la majoria de vegades.

### 4d.5. Rols amb accés

Admin i Treballador.

---

## 4e. Entrada d'Estoc Repartida [NOU — juliol 2026]

### 4e.1. Motivació

Fins ara, l'única manera d'augmentar l'estoc d'una sitja o magatzem ja creats era editar-ne manualment el valor total (calculant "a mà" estoc actual + quantitat rebuda). No hi havia cap manera de repartir una única entrada (per exemple, un camió de 16 tones) entre diversos silos d'un sol cop.

### 4e.2. Flux

1. L'usuari selecciona el tipus (Sitges o Magatzems).
2. Afegeix una fila per cada destinatari: selecciona el silo/magatzem i indica la quantitat exacta que hi va.
3. Es mostra el total repartit en temps real.
4. En confirmar, s'incrementa l'estoc de cada destinatari seleccionat en una única operació.

### 4e.3. Repartiment manual (no automàtic ni equitatiu)

**Decisió confirmada amb l'usuari:** el repartiment és sempre manual — l'usuari indica la quantitat exacta per a cada silo/magatzem. No hi ha cap opció de repartiment automàtic equitatiu.

### 4e.4. Diferència amb un Consum

Una entrada d'estoc **només incrementa** l'estoc — mai el descompta, i no implica cap animal ni cap nau (l'aliment encara no s'ha consumit, només ha arribat a la granja). No genera cap fila a `moviments_farratge` ni `consums_pinso_nau`; la traçabilitat de l'entrada queda registrada a `public.audit_log`.

### 4e.5. Rols amb accés

Admin i Treballador.

---

## 5. Pantalla: Control d'Estoc de Magatzems

Vista de consulta que mostra l'estat actual de tots els espais d'emmagatzematge:

| Columna | Descripció |
|---------|-----------|
| Nom del Magatzem / Sitja | Identificador |
| Tipus | Farratge (text lliure) per a magatzems; nom del tipus de pinso del catàleg per a sitges (o "—" si no s'ha assignat) |
| Estoc Actual | En kg o tones, amb barra visual de capacitat |
| Capacitat Màxima | Valor configurat a la fitxa |
| % Ocupació | `(estoc_actual / capacitat_maxima) × 100` |
| Estoc Mínim | Llindar d'alerta configurat (o valor global si no n'hi ha) |
| Estat | `Actiu` / `Deshabilitat` |
| Alerta | Indicador visual si l'estoc és baix o esgotat |

---

## 6. Taules de Base de Dades Implicades

| Taula | Operació |
|-------|---------|
| `sitges` | Lectura d'estoc actual; UPDATE en cada consum |
| `magatzems_farratge` | Lectura d'estoc actual; UPDATE en cada consum |
| `moviments_farratge` | INSERT per cada consum registrat |
| `consums_pinso_nau` | INSERT per consums de pinso de sitja |
| `zones_infraestructura` | Lectura per desplegable de destí |
| `configuracio_general` | Lectura del llindar d'estoc mínim global (fallback) |
| `tipus_pinso_cataleg` | Lectura per al desplegable de tipus de pinso; alta/edició des de la pantalla de catàleg |
| `component_pinso` | Alta/edició en crear o editar un tipus de pinso |
| `ubicacions` | Lectura per al desplegable de granja en crear una sitja |
| `public.audit_log` | Registre de moviments |

> DDL complet a [`02_model_de_dades.md`](./02_model_de_dades.md), secció 3 (Logística).

---

## 7. Endpoints

| Endpoint | Mètode | Rol | Descripció |
|---|---|---|---|
| `/api/logistica/estoc` | GET | Admin, Treballador | Estoc complet (actius i deshabilitats) |
| `/api/logistica/catalegs` | GET | Admin, Treballador | Orígens (actius) i destins per al formulari (destins filtrats a NAU_ANIMALS/PASTURA) |
| `/api/logistica/consum` | POST | Admin, Treballador | Registra un consum (dual-write segons origen) |
| `/api/logistica/estoc/[tipus]/[id]` | PATCH | Admin | Canvia l'estat Actiu/Deshabilitat |
| `/api/logistica/sitges` | GET, POST | Admin, Treballador | Llistat i creació de sitges |
| `/api/logistica/sitges/[id]` | PATCH | Admin, Treballador | Edició d'una sitja |
| `/api/logistica/magatzems` | GET, POST | Admin, Treballador | Llistat i creació de magatzems de farratge |
| `/api/logistica/magatzems/[id]` | PATCH | Admin, Treballador | Edició d'un magatzem |
| `/api/logistica/tipus-pinso` | GET, POST | Admin, Treballador | Llistat i creació de tipus de pinso |
| `/api/logistica/tipus-pinso/[id]` | PATCH | Admin, Treballador | Edició d'un tipus de pinso |
| `/api/logistica/entrada-estoc` | POST | Admin, Treballador | Registra una entrada d'estoc repartida manualment entre sitges o magatzems |