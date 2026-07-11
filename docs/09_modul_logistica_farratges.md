# 09 — Mòdul de Logística, Farratges i Sitges

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026  
> **Basat en:** Disseny_Webapp_Gestió_Ramadera_Bovina_-_Mòdul_de_Logística_i_Farratges_V1.docx

---

## 0. Estat d'Implementació

| Funcionalitat | Estat | Detall |
|---|---|---|
| Formulari de Consums Massius (secció 2) | ✅ Implementat | Formulari únic intel·ligent — veure 0.1 |
| Lògica de bales (secció 2.2) | ✅ Implementat | Càlcul i mostra del pes equivalent abans de confirmar |
| Control d'estocs i alertes jeràrquiques (secció 3) | ✅ Implementat | Càlcul NORMAL/BAIX/ESGOTAT amb llindar específic o global |
| Gestió d'estats (toggle Actiu/Deshabilitat) (secció 4) | ✅ Implementat | Exclusiu d'Admin |
| Pantalla de Control d'Estoc (secció 5) | ✅ Implementat | Amb barra visual de capacitat |

### 0.1. Decisions ampliades sobre el disseny original

- **Un únic formulari, dues taules:** el document defineix un sol formulari de "Consums Massius", però la BD té dues taules diferents (`consums_pinso_nau` per a sitges, `moviments_farratge` per a magatzems de farratge). El formulari detecta automàticament el tipus d'origen seleccionat i escriu a la taula corresponent, sense que l'usuari hagi de triar-la explícitament.
- **Sitges: sempre en kg.** `consums_pinso_nau` no té camp d'unitat (a diferència de `moviments_farratge`). El desplegable d'unitat es restringeix automàticament a `kg` quan l'origen és una sitja, amagant `Tones` i `Unitats (bales)`.
- **Rols mantinguts tal com al disseny original:** aquest és l'únic mòdul on Veterinari **no** té cap accés (ni lectura), a diferència de la resta de mòduls on s'ha ampliat a "només lectura". Decisió confirmada explícitament amb l'usuari.
- **Estoc negatiu:** no es bloqueja el registre d'un consum si l'estoc quedaria negatiu (mateix criteri aplicat a Sanitari) — es mostra com a informació, no com a error bloquejant.
- **v_estoc_magatzems no reutilitzada per a aquesta pantalla:** la vista existent (usada al Dashboard) filtra `WHERE estat = 'Actiu'`, pensada per a les alertes. La pantalla de Control d'Estoc necessita veure també els magatzems deshabilitats — s'ha creat una query pròpia amb la mateixa lògica de càlcul d'alerta, sense aquest filtre.

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
| **Destí** | Desplegable | ✅ | Nau, Cort o Zona de pastura on es diposita l'aliment |
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

## 5. Pantalla: Control d'Estoc de Magatzems

Vista de consulta que mostra l'estat actual de tots els espais d'emmagatzematge:

| Columna | Descripció |
|---------|-----------|
| Nom del Magatzem / Sitja | Identificador |
| Tipus | Farratge, Pinso, Llet en pols, etc. |
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
| `public.audit_log` | Registre de moviments |

> DDL complet a [`02_model_de_dades.md`](./02_model_de_dades.md), secció 3 (Logística).

---

### 7. Nous endpoints:

| Endpoint | Mètode | Rol | Descripció |
|---|---|---|---|
| `/api/logistica/estoc` | GET | Admin, Treballador | Estoc complet (actius i deshabilitats) |
| `/api/logistica/catalegs` | GET | Admin, Treballador | Orígens (actius) i destins per al formulari |
| `/api/logistica/consum` | POST | Admin, Treballador | Registra un consum (dual-write segons origen) |
| `/api/logistica/estoc/[tipus]/[id]` | PATCH | Admin | Canvia l'estat Actiu/Deshabilitat |