# 06 — Mòdul Sanitari

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026  
> **Basat en:** Disseny_Webapp_Gestió_Ramadera_Bovina_-_Mòdul_Sanitari_V2.docx

---

## 0. Estat d'Implementació

| Funcionalitat | Estat | Detall |
|---|---|---|
| Fitxa del medicament / inventari (secció 2) | ✅ Implementat | Alta manual des de formulari |
| Importació CSV de medicaments (secció 3) | ✅ Implementat | Duplicats: actualització automàtica de l'estoc (ampliació — veure 0.1) |
| Aplicació de tractaments individual/per lot (secció 4) | ✅ Implementat | Mateixos camps als dos modes, sense personalització per animal |
| Bloqueig comercial per supressió | ✅ Implementat (des del Dashboard i Arxiu) | Ja funcional des de lliuraments anteriors; el mòdul Sanitari només crea el tractament, el bloqueig ja actuava |
| Impacte econòmic per animal (secció 5) | ❌ Pendent | Càlcul de cost sanitari acumulat, encara no implementat als informes |
| Catàleg de Medicaments separat de l'estoc | ✅ Implementat (juliol 2026) | Mateix patró que "Tipus de Pinso" a Magatzems |

### 0.1. Decisions ampliades sobre el disseny original

- **Permisos:** Treballador ara té accés de només lectura al mòdul (el disseny original, secció 1, l'excloïa completament). Manté el mateix patró ja aplicat a Granja/Corts, Lots i Animals.
- **Duplicats al CSV (secció 3.3):** el disseny original oferia triar entre "Actualitzar l'estoc" o "Crear un registre independent". S'ha optat per **actualitzar sempre automàticament**, sense preguntar-ho a l'usuari — simplifica el flux i evita duplicats accidentals de medicaments amb el mateix nom+lot.
- **Estoc negatiu en aplicar tractament (secció 4.2):** el sistema NO bloqueja l'aplicació d'un tractament si la dosi total supera l'estoc disponible. L'estoc pot quedar negatiu; es gestiona manualment (revisió de l'inventari).
- **Connexió pendent:** el botó "Aplicar tractament" en mode individual des de la fitxa d'un animal (docs/08_modul_llistat_actius.md) encara no està connectat — el component `ModalAplicarTractament` ja suporta aquest mode (`animalIdPreseleccionat`), però la crida des de `FitxaAnimalModal.tsx` queda per a un proper lliurament.

---

## 1. Descripció General

El Mòdul Sanitari gestiona l'inventari de medicaments de la granja i l'aplicació de tractaments veterinaris als animals. Garanteix la traçabilitat clínica i econòmica dels fàrmacs, i implementa el **bloqueig comercial automàtic** dels animals en període de supressió.

**Rols amb accés:**
- **Admin** — Accés total (lectura, escriptura, configuració, càrrega CSV)
- **Veterinari** — Accés total (lectura, escriptura, càrrega CSV)
- **Treballador** — Sense accés

---

## 2. Fitxa del Medicament (Inventari)

### 2.1. Camps de la Fitxa

| Camp | Tipus | Obligatori | Descripció / Regla de Negoci |
|------|-------|-----------|------------------------------|
| `nom_medicament` | VARCHAR(255) | ✅ | Nom comercial del fàrmac (Ex: *Amoxicil·lina 10%*) |
| `principi_actiu` | VARCHAR(255) | ✅ | Substància activa (Ex: *Amoxicil·lina trihidrat*). Vital per a auditories veterinàries |
| `lot` | VARCHAR(100) | ✅ | Codi de fabricació del lot per controlar caducitats i alertes del fabricant |
| `quantitat_estoc` | DECIMAL(12,3) | ✅ | Volum o pes total en estoc (en la unitat indicada a `unitat_estoc`) |
| `unitat_estoc` | VARCHAR(20) | ✅ | Unitat de l'estoc (Ex: `ml`, `g`, `unitats`) |
| `posologia_standard` | TEXT | ❌ | Indicacions de dosificació per defecte (Ex: *1 ml per cada 10 kg de pes viu, cada 24h*) |
| `preu_compra` | DECIMAL(10,2) | ✅ | Cost del pot/caixa en euros. Necessari per calcular el cost sanitari per animal |
| `dies_supressio` | INTEGER | ✅ | Dies d'espera obligatoris abans de permetre la venda de l'animal tractat (**bloqueig comercial automàtic**) |

### 2.2. Regles de Negoci de la Fitxa

- El camp `dies_supressio` no pot ser negatiu.
- El camp `quantitat_estoc` no pot ser negatiu.
- La combinació `nom_medicament + lot` s'utilitza per detectar duplicats en la càrrega CSV (vegeu secció 3.3).
- Quan `quantitat_estoc` arriba a 0, el medicament segueix visible a l'historial però no és seleccionable per aplicar tractaments nous.

---

## 2b. Catàleg de Medicaments [NOU — juliol 2026]

### 2b.1. Motivació

La fitxa del medicament (secció 2) barrejava dades mestres (nom,
principi actiu, posologia, dies de supressió — que no canvien) amb
dades de cada compra/lot (lot, quantitat, preu — que sí canvien).
Es va separar en dues taules: `medicaments_cataleg` (dades mestres)
i `medicaments` (entrades d'estoc, referenciant el catàleg per FK).

### 2b.2. Flux

- **"Nou medicament"** (pestanya Catàleg): crea només l'entrada de
  catàleg — nom, principi actiu, posologia estàndard, dies de
  supressió. No demana lot ni quantitat.
- **"Afegir entrada"** (pestanya Magatzem sanitari): selecciona un
  medicament ja existent al catàleg i en registra una entrada
  d'estoc — lot, **nombre d'ampolles o sobres**, unitat, preu.

### 2b.3. Importació CSV — format sense canvis

El format del fitxer CSV es manté idèntic (secció 3.2, sense
canvis) — cada fila continua incloent totes les dades del
medicament. Internament: si el nom del medicament ja existeix al
catàleg, la fila només afegeix una entrada d'estoc (ignorant
principi actiu/posologia/dies de supressió del CSV, que podrien no
coincidir amb el catàleg ja existent); si és nou, es crea el
catàleg i l'entrada d'estoc alhora, automàticament.

### 2b.4. Migració de dades

Migració `database/10_migracio_cataleg_medicaments.sql` — a
diferència d'altres migracions d'aquest projecte, aquesta **preserva
les dades existents** (trasllada automàticament els medicaments ja
donats d'alta al nou catàleg, deduplicats per nom).
  
---

## 3. Importació Massiva de Medicaments (CSV)

### 3.1. Accés a la Funcionalitat

L'usuari (Admin o Veterinari) accedeix a la secció **Magatzem Sanitari** i prem el botó **"Carregar CSV de Fàrmacs"**.

### 3.2. Format del Fitxer CSV

El fitxer ha de tenir una capçalera estricta. El separador és la **coma** (`,`). Els valors amb comes internes han d'anar entre cometes dobles (`"`).

**Capçalera obligatòria:**
```
nom_medicament,principi_actiu,lot,quantitat,unitat,posologia,preu,dies_supressio
```

**Exemple de fitxer vàlid:**
```csv
nom_medicament,principi_actiu,lot,quantitat,unitat,posologia,preu,dies_supressio
"Amoxicil·lina 10%","Amoxicil·lina trihidrat","LOT-2026-X",500,ml,"1ml/10kg cada 24h","45,50",14
"Oxitetraciclina 20%","Oxitetraciclina","LOT-2026-Y",250,ml,"2ml/10kg","32,00",28
"Vitamina E + Seleni","Tocoferol / Seleni","LOT-2026-Z",100,ml,,"18,75",0
```

**Regles de format:**
- El separador decimal és la **coma** (`,`) i el separador de milers és el punt (`.`) — Ex: `1.234,56`. Nota: el format intern de la BD és amb punt; la conversió la fa la capa d'aplicació en llegir el CSV.
- El camp `posologia` és opcional; pot quedar buit (dues comes consecutives o camp buit entre cometes).
- El camp `dies_supressio` ha de ser un enter >= 0.
- El camp `unitat` ha de ser un valor de text lliure (Ex: `ml`, `g`, `unitats`).

### 3.3. Flux de Treball de la Càrrega

```
Usuari puja fitxer CSV
        │
        ▼
[Validació de format]
  ¿Capçalera correcta?
  ¿Camps obligatoris presents?
  ¿Tipus de dades correctes?
        │
   ┌────┴────┐
  NOK       OK
   │         │
   ▼         ▼
Mostra    [Detecció de duplicats]
errors    Nom_medicament + Lot ja existeix a la BD?
en bloc         │
           ┌────┴────┐
          SÍ        NO
           │         │
           ▼         ▼
   Marcar fila    Fila nova
   (duplicat)     (verd)
   Opcions:
   · Actualitzar estoc (sumar quantitat)
   · Crear registre independent
        │
        ▼
[Pantalla de previsualització]
  Graella amb totes les files
  · Fila vàlida → fons blanc
  · Fila amb camps corregibles → fons taronja (editable en pantalla)
  · Fila duplicada → marcada amb indicador visual
        │
        ▼
Usuari revisa i confirma
        │
        ▼
[Confirmació] → Medicaments incorporats a l'estoc actiu
```

### 3.4. Comportament en Errors de Validació

| Tipus d'Error | Comportament |
|---------------|-------------|
| Capçalera incorrecta o fitxer no parsejable | Error crític: es rebutja el fitxer complet i es mostra missatge |
| Camp obligatori buit (`lot`, `dies_supressio`) | Fila marcada en taronja; editable en pantalla abans de confirmar |
| Valor numèric invàlid (`preu`, `quantitat`) | Fila marcada en taronja; editable en pantalla |
| Duplicat detectat (`nom + lot` ja existeix) | Fila marcada amb indicador de duplicat; l'usuari tria l'acció |

---

## 4. Aplicació de Tractaments Veterinaris

### 4.1. Modes d'Aplicació

| Mode | Descripció |
|------|-----------|
| **Individual** | Es selecciona un animal concret i se li assigna el tractament |
| **Per lot** | S'aplica el tractament a tots els animals actius d'un lot simultàniament |

### 4.2. Flux d'Aplicació d'un Tractament

1. Seleccionar animal(s) o lot.
2. Seleccionar medicament de l'inventari (només els que tenen estoc > 0).
3. Introduir: data d'inici, dosi aplicada, unitat de dosi, data de fi prevista (opcional), notes.
4. El sistema calcula automàticament la **data d'alliberament**: `data_inici + dies_supressio`.
5. En confirmar:
   - Es crea el registre a la taula `tractaments`.
   - Es desconta la dosi del `quantitat_estoc` del medicament.
   - L'animal queda en **bloqueig comercial** fins a la `data_alliberament`.

### 4.3. Bloqueig Comercial per Supressió

- Mentre la `data_alliberament` sigui futura, l'animal **no pot ser registrat com a venda** al mòdul de baixes.
- El sistema mostra un indicador visual a la fitxa de l'animal i al llistat d'actius.
- El Dashboard mostra la llista d'animals en tractament actiu i la seva data d'alliberament.

---

## 5. Impacte Econòmic

El cost sanitari per animal es calcula com:

```
Cost_tractament = (dosi_aplicada / quantitat_total_envàs) * preu_compra_envàs
```

Aquest cost s'acumula a l'historial econòmic de l'animal i es reflecteix als informes de rendiment per animal i per lot.

---

## 6. Taules de Base de Dades Implicades

| Taula | Operació |
|-------|---------|
| `medicaments` | Alta, actualització d'estoc, consulta |
| `tractaments` | Alta per tractament aplicat |
| `animals` | Lectura per seleccionar animals; `estat_salut` s'actualitza |
| `public.audit_log` | Registre de totes les altes i aplicacions de tractaments |

> DDL complet a [`02_model_de_dades.md`](./02_model_de_dades.md), secció 3 (Mòdul Sanitari).

---

### 7. Nous endpoints

| Endpoint | Mètode | Rol | Descripció |
|---|---|---|---|
| `/api/sanitari/medicaments` | GET | Tots | Inventari complet |
| `/api/sanitari/medicaments` | POST | Admin, Veterinari | Alta manual d'un medicament |
| `/api/sanitari/medicaments/comprovar-duplicats` | POST | Admin, Veterinari | Comprova nom+lot existents (previsualització CSV) |
| `/api/sanitari/medicaments/bulk-import` | POST | Admin, Veterinari | Confirma la importació (actualitza duplicats automàticament) |
| `/api/sanitari/tractaments` | GET | Tots | Llistat de tractaments aplicats |
| `/api/sanitari/tractaments` | POST | Admin, Veterinari | Aplica un tractament (individual o `lotId` per expandir-lo) |
| `/api/sanitari/medicaments-cataleg` | GET, POST | Admin, Veterinari (GET: tots 3 rols) | Llistat i creació de medicaments al catàleg |
| `/api/sanitari/medicaments` | POST | Admin, Veterinari | **Canvi de semàntica**: ara afegeix una entrada d'estoc (`medicamentCatalegId`, lot, quantitat, unitat, preu), no crea el catàleg |