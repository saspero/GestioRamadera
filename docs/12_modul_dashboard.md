# 12 — Mòdul Dashboard

> **Versió:** 1.0.0  
> **Última actualització:** Juliol de 2026  
> **Basat en:** Requisits directes de l'usuari + alertes ja previstes a `docs/README.md` (Estructura de Navegació)

---

## 1. Descripció General

El Dashboard és la pàgina d'inici de l'aplicació. Mostra un resum operatiu consolidat en una única crida (`GET /api/dashboard`), amb el contingut **filtrat pel backend segons el rol** de l'usuari autenticat — el frontend no fa cap comprovació de permisos pròpia, confia completament en els blocs que rep.

**Rols amb accés:** Admin, Veterinari, Treballador (contingut diferent per a cadascun).

---

## 2. Blocs del Dashboard i Permisos per Rol

| Bloc | Admin | Veterinari | Treballador | Contingut |
|------|:-----:|:----------:|:-----------:|-----------|
| **Total d'animals actius** | ✅ | ✅ | ✅ | Recompte simple d'animals amb `estat_actiu = TRUE` |
| **Lots actius** | ✅ | ✅ | ✅ | Nom, nombre d'animals, dies des de creació, consum mitjà de pinso |
| **Estoc de magatzems** | ✅ | ❌ | ✅ | Totes les sitges/magatzems amb el seu estat d'alerta |
| **Alertes d'estoc** | ✅ | ❌ | ✅ | Subconjunt crític (només `BAIX`/`ESGOTAT`), destacat a dalt de tot |
| **Animals en supressió** | ✅ | ✅ | ❌ | Animals amb bloqueig comercial actiu (període de retirada) |
| **Últimes baixes** | ✅ | ✅ | ❌ | Últimes vendes/morts registrades |
| **Distribució per estat de salut** | ✅ | ✅ | ❌ | Recompte d'animals per `Sa`/`En tractament`/`Observació`/`Crític` |

**Criteri de filtratge:** Admin veu tots els blocs (unió de Veterinari + Treballador). Veterinari veu dades clíniques/sanitàries. Treballador veu dades operatives (animals, logística) sense res sanitari ni de baixes.

---

## 3. Lògica de Càlcul: Consum Mitjà de Pinso per Lot

### 3.1. El problema

La taula `consums_pinso_nau` registra kg consumits **per zona/nau**, no per lot. Un lot pot estar repartit entre diverses corts d'una mateixa zona, o coexistir amb altres lots a la mateixa zona. No hi ha una relació directa lot↔consum a la base de dades.

### 3.2. La solució: repartiment proporcional

El consum es reparteix entre els lots d'una zona proporcionalment al nombre d'animals actius de cada lot:

```
consum_mitjà_lot (kg/dia) =
    (Σ kg consumits per la zona, tot l'històric)
    ÷ (dies transcorreguts des de lots.data_creacio)
    × (animals del lot a la zona ÷ animals totals actius a la zona)
```

### 3.3. Definició de "dies del lot"

**Dies des de `lots.data_creacio`** fins avui — no la data d'entrada dels animals a `distribucio_animals` (que pot variar per animal). Decisió conscient de simplicitat: un lot pot rebre animals en moments diferents, però es fa servir una única data de referència.

### 3.4. Casos especials

| Situació | Resultat |
|---------|---------|
| Lot sense cap consum registrat a la seva zona | `consumMitjaKgDia: null` (mai `0` — distingeix "sense dades" de "consum real zero") |
| Lot repartit entre diverses corts de zones diferents | El repartiment es calcula zona per zona i se suma (implícit al `GROUP BY` de la query) |
| Lot creat avui mateix (`data_creacio = CURRENT_DATE`) | Divisor mínim d'1 dia (`GREATEST(..., 1)`), evita divisió per zero |

---

## 4. Endpoint API

### `GET /api/dashboard`

**Autenticació:** requereix JWT vàlid (gestionat pel middleware).

**Resposta:** `DashboardResponse` (veure `src/types/dashboard.ts`), amb els blocs presents segons el rol:

```typescript
type DashboardResponse = {
  totalAnimals?: TotalAnimalsBlock
  lotsActius?: LotActiuBlock[]
  estocMagatzems?: EstocMagatzemBlock[]
  animalsEnSupressio?: AnimalEnSupressioBlock[]
  alertesEstoc?: AlertaEstocBlock[]
  ultimesBaixes?: BaixaRecentBlock[]
  distribucioSalut?: DistribucioSalutBlock[]
}
```

Un bloc **absent** (no `undefined` explícit, sinó no present a l'objecte) significa que el rol de l'usuari no hi té accés — no s'ha de confondre amb un array buit (`[]`), que significa "hi té accés però no hi ha dades".

---

## 5. Taules i Vistes de Base de Dades Implicades

| Taula / Vista | Ús |
|---|---|
| `animals` | Total d'animals actius, distribució per estat de salut |
| `lots` | Llistat de lots i `data_creacio` |
| `distribucio_animals` | Relació animal↔lot↔cort actual (`data_sortida IS NULL`) |
| `corts` | Relació cort↔zona per al repartiment de consum |
| `consums_pinso_nau` | Kg consumits per zona (base del repartiment proporcional) |
| `v_estoc_magatzems` | Vista ja existent; estoc + estat d'alerta de sitges i magatzems |
| `v_animals_en_supressio` | Vista ja existent; animals amb bloqueig comercial actiu |
| `baixes` | Últimes vendes/morts |

> DDL complet d'aquestes taules i vistes: [`02_model_de_dades.md`](./02_model_de_dades.md) i `database/02_schema_tenant_template.sql`.

---

## 6. Fitxers del Projecte

| Fitxer | Responsabilitat |
|--------|-----------------|
| `src/types/dashboard.ts` | Tipus TypeScript de tots els blocs i de la resposta consolidada |
| `src/lib/db/queries/dashboard.ts` | Funcions SQL, una per bloc |
| `src/app/api/dashboard/route.ts` | Endpoint que orquestra les queries i filtra per rol |
| `src/app/(app)/dashboard/page.tsx` | Pàgina: crida l'endpoint i renderitza els blocs presents |
| `src/components/dashboard/*.tsx` | Un component de presentació per bloc |
| `src/lib/format.ts` | Utilitats `formatNumber()` (coma decimal, punt de milers) i `formatDate()` |
