# 14 — Mòdul Lots

> **Versió:** 1.0.0  
> **Última actualització:** Juliol de 2026  
> **Basat en:** Ampliació sobre `08_modul_llistat_actius.md` (secció "Lots i Corts" del disseny original) i `13_modul_granja_corts.md` (secció 0.1 — separació de seccions)

---

## 0. Descripció General

Aquest mòdul gestiona l'agrupació d'animals per lots: creació de lots nous, consulta dels animals que conté cadascun, i moviment d'animals entre lots (individual o massiu).

**Rols amb accés:**
- **Admin i Veterinari** — Accés complet (crear lots, moure animals)
- **Treballador** — Només consulta (lectura)

---

## 1. Pantalla Principal: Llistat de Lots

Llista de tots els lots amb el **nombre d'animals actius** que contenen. En clicar un lot, s'expandeix i carrega el **detall dels animals** que hi pertanyen (DIB, raça, cort actual, data d'entrada al lot).

Cada càrrega de detall és una crida independent (`GET /api/lots/[id]/animals`), no es precarrega tot d'un cop, per evitar sobrecarregar la pàgina en tenants amb molts lots.

---

## 2. Moviment d'Animals entre Lots

### 2.1. Dues vies d'accés (component compartit)

El moviment d'animals a un altre lot es pot fer des de **dos llocs diferents**, tots dos utilitzant el mateix component `ModalMoureAnimals` i el mateix endpoint:

| Via | Selecció d'animals |
|---|---|
| **Des de Lots** | Un únic animal, des del detall expandit d'un lot (botó "Moure" a la fila de l'animal) |
| **Des d'Animals** | Un o més animals, mitjançant checkboxes a la taula del llistat general (botó "Moure X animals a un lot") |

### 2.2. Cort de destí opcional

En moure animals, la **cort es pot mantenir o canviar**:
- Per defecte, cada animal mogut **manté la seva cort actual**.
- Si es marca "Canviar també la cort de destí", tots els animals seleccionats es mouen a la mateixa cort nova.

### 2.3. Flux tècnic del moviment

Segueix exactament el patró ja documentat a `08_modul_llistat_actius.md`, secció 3.3 (Flux de Canvi de Lot):

```
Per cada animal seleccionat:
  1. UPDATE distribucio_animals
     SET data_sortida = CURRENT_DATE
     WHERE animal_id = X AND data_sortida IS NULL

  2. INSERT distribucio_animals
     (animal_id, lot_id_nou, cort_id, data_entrada = CURRENT_DATE)
     — cort_id: la nova si s'ha especificat, si no la mateixa d'abans
```

Tota l'operació (per a tots els animals seleccionats) s'executa en una **única transacció**: si qualsevol animal fallés, el moviment sencer es desfà — no hi ha estats intermedis amb alguns animals moguts i altres no.

---

## 3. Endpoints API

| Endpoint | Mètode | Rol | Descripció |
|---|---|---|---|
| `/api/lots` | GET | Tots (lectura) | Llistat de lots amb recompte d'animals |
| `/api/lots` | POST | Admin, Veterinari | Crear un lot nou |
| `/api/lots/[id]/animals` | GET | Tots (lectura) | Animals actius d'un lot concret |
| `/api/lots/moure` | POST | Admin, Veterinari | Moure un o més animals a un altre lot (endpoint compartit) |

---

## 4. Fora d'Abast d'Aquesta Versió

| Funcionalitat | Estat |
|---|---|
| Dividir un lot en dos | ❌ Pendent (previst al disseny original, secció 2.1 de `08_modul_llistat_actius.md`) |
| Eliminar un lot | ❌ Pendent |
| Editar el nom d'un lot | ❌ Pendent |
| Selector de vista "Per Lot" a la pantalla d'Animals | ❌ Pendent |

---

## 5. Taules de Base de Dades Implicades

| Taula | Operació |
|-------|---------|
| `lots` | Lectura, INSERT |
| `distribucio_animals` | Lectura, UPDATE (tancament), INSERT (nova distribució) |
| `animals` | Lectura (DIB, estat actiu) |
| `corts` | Lectura (codi de cort actual/destí) |
| `races_cataleg` | Lectura (raça per al detall d'animals del lot) |
| `public.audit_log` | Registre de creació de lots (`CREAR_LOT`) i moviments (`MOURE_ANIMALS_LOT`) |

---

## 6. Fitxers del Projecte

| Fitxer | Responsabilitat |
|---|---|
| `src/types/lots.ts` | Tipus TypeScript: LotResum, AnimalDelLot, MoureAnimalsInput |
| `src/lib/validators/lots.ts` | Schemas Zod: crear lot, moure animals |
| `src/lib/db/queries/lots.ts` | Totes les queries: llistat amb recompte, detall, crear, moure |
| `src/app/api/lots/route.ts` | GET (llistat) i POST (crear lot) |
| `src/app/api/lots/[id]/animals/route.ts` | GET (animals d'un lot) |
| `src/app/api/lots/moure/route.ts` | POST (moviment, endpoint compartit) |
| `src/hooks/useMoureAnimals.ts` | Hook compartit per l'enviament del moviment |
| `src/components/lots/LlistaLots.tsx` | Llista amb detall expandible |
| `src/components/lots/ModalNouLot.tsx` | Modal de creació de lot |
| `src/components/lots/ModalMoureAnimals.tsx` | Modal compartit de moviment (Lots + Animals) |
| `src/app/(app)/lots/page.tsx` | Pàgina principal del mòdul Lots |
| `src/components/animals/TaulaAnimals.tsx` | **Ampliat**: checkboxes + acció "Moure a lot" |
| `src/app/(app)/animals/page.tsx` | **Ampliat**: passa `potMoure`/`onAnimalsMoguts` a TaulaAnimals |
