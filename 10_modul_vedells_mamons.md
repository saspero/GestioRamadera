# 10 — Mòdul d'Alimentació i Costos de Vedells Mamons

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026  
> **Basat en:** Disseny_Webapp_Gestió_Ramadera_Bovina_-_Costos_de_Vedells_Mamons_V1.docx

---

## 1. Descripció General

El Mòdul de Vedells Mamons gestiona l'alimentació i la imputació automatitzada de costos per als animals en fase de lactància artificial (vedells alimentats amb llet en pols). Funciona a través de **presets configurables** que permeten al sistema calcular el consum i el cost diari de forma automàtica sense entrada manual de dades per part de l'operari.

**Rols amb accés:**
- **Admin** — Accés total (configuració de presets + registre de lactància diària)
- **Veterinari** — Sense accés
- **Treballador** — Registre de lactància diària (acció ràpida)

---

## 2. Configuració del Preset de Llet en Pols

### 2.1. Descripció

Un **preset** és una configuració reutilitzable que defineix el preu i la dosi estàndard d'un tipus de llet en pols. Permet que l'operari no hagi d'introduir preus ni calcular quantitats; només ha de confirmar el registre diari.

### 2.2. Camps del Preset

| Camp | Tipus | Obligatori | Descripció / Regla de Negoci |
|------|-------|-----------|------------------------------|
| `nom` | VARCHAR(100) | ✅ | Nom descriptiu del preset (Ex: *"Llet en Pols Primavera 2026"*) |
| `preu_compra_sac_kg` | DECIMAL(10,4) | ✅ | Preu per quilo de llet en pols basat en l'última factura introduïda (€/kg) |
| `dosi_standard_g_dia` | DECIMAL(10,2) | ✅ | Quantitat de pols mitjana que consumeix un vedell al dia, en grams (Ex: `500` g repartits en dues preses) |
| `preu_repercutit_dia` | DECIMAL(10,4) | ✅ Calculat | **Camp calculat automàticament:** `(dosi_standard_g_dia / 1000) × preu_compra_sac_kg`. Determina el cost fix d'alimentació per vedell i dia |
| `actiu` | BOOLEAN | ✅ | Indica si el preset és el vigent. Permet mantenir un historial de presets anteriors |

### 2.3. Exemple de Càlcul del Preset

```
Preu del sac:        2,80 €/kg
Dosi estàndard:    500 g/vedell/dia

Preu repercutit = (500 / 1000) × 2,80 = 1,40 €/vedell/dia
```

### 2.4. Gestió de Canvis de Preu

Quan canvia el preu del sac (nova factura):
- Es crea un **nou preset** amb el preu actualitzat.
- El preset anterior es marca com `actiu = FALSE` (no s'esborra, preserva l'historial).
- Els costos imputats amb el preset antic queden associats al preu vigent en aquell moment.

---

## 3. Registre de Lactància Diària (Acció Ràpida)

### 3.1. Accés

A la pantalla de **Consums Massius** (Mòdul de Logística), hi ha un botó d'acció ràpida destacada: **"Registrar Lactància Diària"**.

### 3.2. Flux de l'Usuari

```
Usuari prem "Registrar Lactància Diària"
        │
        ▼
[Seleccionar Lot de Vedells Mamons]
(o la Nau de Recria corresponent)
        │
        ▼
[El sistema detecta automàticament]
· Nombre d'animals actius al lot avui: N vedells
· Preset de llet en pols actiu: [nom del preset]
· Dosi per vedell: X g/dia
        │
        ▼
[Pantalla de Confirmació — mostra el resum calculat]
┌────────────────────────────────────────────────┐
│ Lot: Recria Vedells Nord                       │
│ Animals actius: 40 vedells                     │
│ Preset actiu: "Llet en Pols Primavera 2026"   │
│ Dosi/vedell: 500 g/dia                         │
│ ─────────────────────────────────────────────  │
│ Total llet en pols:  20,00 kg                  │
│ Cost total del dia:  56,00 €                   │
│ Cost per vedell:      1,40 €                   │
│ Magatzem descompte: Cobert Llet en Pols        │
└────────────────────────────────────────────────┘
        │
        ▼
[Usuari confirma]
        │
        ▼
Accions automàtiques del sistema:
1. Descomptar 20 kg del magatzem de llet en pols
2. Inserir registre de moviment de farratge (origen → lot)
3. Imputar 1,40 € de cost a l'historial de cada vedell
   (equitativament entre els N animals actius)
4. Registrar a audit_log
```

### 3.3. Gestió d'Absències d'Animals

Si en el moment del registre algun vedell del lot no ha consumit llet (ex: baixa per mort o venda el mateix dia), el sistema detecta automàticament el nombre d'animals **actius** en aquell lot en el dia del registre, garantint que el càlcul sigui sempre correcte.

---

## 4. Impacte en el Balanç Econòmic i Informes

### 4.1. Desglossat de Costos d'Alimentació per Animal

En generar un informe de rendiment econòmic, el sistema desglossa els costos d'alimentació en dos components:

| Component | Origen | Càlcul |
|-----------|--------|--------|
| **Cost de Farratges / Sitja** | `moviments_farratge` + `consums_pinso_nau` | Proporcional al nombre d'animals actius a la nau en el moment del moviment |
| **Cost de Lactància** | Registres de lactància diària | Acumulat de kg de llet en pols × preu del preset actiu durant la fase de mamó |

### 4.2. Exemple d'Informe per Animal

```
Animal: ES040123456789 (Vedell mascle, Lot Recria Nord)
Període: 2026-01-15 → 2026-03-15 (60 dies de fase de mamó)

Cost de lactància:
  · Dies registrats: 60
  · Cost diari: 1,40 €/dia
  · Total lactància: 84,00 €

Cost de pinso (fase post-mamó):
  · Proporcional de la Sitja Nord (40 animals)
  · Total pinso: 32,50 €

Pes inicial: 45 kg | Pes final: 112 kg | GMD: 1,12 kg/dia
Cost alimentació total: 116,50 €
Cost per kg de guany: 1,74 €/kg
```

### 4.3. Magatzem de Llet en Pols

La llet en pols es gestiona com qualsevol altre magatzem de farratge:
- Es dona d'alta com a `magatzems_farratge` amb `tipus_farratge = 'Llet en pols'`.
- Té el seu propi `estoc_minim_tones` (o hereta el global).
- Genera alertes al Dashboard quan l'estoc és baix.
- El registre de lactància diària desconta del seu estoc com qualsevol moviment de farratge.

---

## 5. Taules de Base de Dades Implicades

| Taula | Operació |
|-------|---------|
| `presets_llet_pols` | Alta de presets, consulta del preset actiu |
| `magatzems_farratge` | Descompte d'estoc de llet en pols en cada registre |
| `moviments_farratge` | INSERT del moviment de lactància diària |
| `animals` | Consulta del nombre d'actius al lot |
| `distribucio_animals` | Consulta per identificar els animals actius al lot avui |
| `lots` | Selecció del lot de vedells mamons |
| `public.audit_log` | Registre de cada acció de lactància diària |

> DDL complet a [`02_model_de_dades.md`](./02_model_de_dades.md), taula `presets_llet_pols` i `moviments_farratge`.
