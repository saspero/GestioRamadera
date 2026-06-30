# 07 — Mòdul d'Arxiu i Històric de Baixes

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026  
> **Basat en:** Disseny_Webapp_Gestió_Ramadera_Bovina_-_Arxiu_i_Històric_V1.docx

---

## 1. Descripció General

El Mòdul d'Arxiu i Històric centralitza la consulta de tots els animals que han causat baixa a la granja, tant per **venda** com per **mort**. És una secció **de consulta i auditoria**, no operativa: els animals donats de baixa desapareixen completament de les llistes de treball diàries i només són accessibles aquí.

**Principi fonamental:** Cap animal s'esborra mai de la base de dades. La baixa es marca amb `estat_actiu = FALSE` i el registre de baixa es guarda a la taula `baixes`. Això garanteix la traçabilitat completa i el compliment legal.

**Rols amb accés:**
- **Admin** — Accés total (consulta i registre de baixes)
- **Veterinari** — Només lectura (consulta de l'històric)
- **Treballador** — Sense accés

---

## 2. Interfície de Consulta

### 2.1. Taula Unificada d'Inactius

La pantalla principal mostra una **única taula** amb tots els animals inactius de la granja, independentment del motiu de la baixa.

**Columnes visibles per defecte:**

| Columna | Tipus | Descripció |
|---------|-------|-----------|
| Crotal ID | Text | Identificador de l'animal |
| Raça | Text | Raça de l'animal |
| Data de Naixement | Data | Per calcular l'edat en el moment de la baixa |
| Data de Baixa | Data | Dia oficial de sortida o defunció |
| Motiu de la Baixa | Etiqueta | `Venda` o `Mort` |
| Lot (últim) | Text | Lot al qual pertanyia l'animal en el moment de la baixa |

### 2.2. Eines de Cerca i Filtratge

- **Cercador Global:** Camp de text superior que filtra per Crotal ID en temps real. Permet trobar un animal concret instantàniament sense conèixer el motiu de la baixa.
- **Filtre Dinàmic de Columna "Motiu de la Baixa":** Desplegable persistent a la capçalera de la columna amb les opcions:
  - `Tots` (per defecte)
  - `Venda`
  - `Mort`
- **Filtre per rang de dates:** Permet acotar la consulta a un periode concret (útil per a balanços anuals o auditorides).

---

## 3. Registre de Baixa per Venda

### 3.1. Camps Requerits

| Camp | Tipus | Obligatori | Descripció / Mètrica |
|------|-------|-----------|----------------------|
| `data_baixa` | DATE | ✅ | Dia oficial de sortida de la granja (format AAAA-MM-DD) |
| `pes_viu_kg` | DECIMAL(8,2) | ✅ | Pes registrat just abans del transport o a la bàscula de sortida |
| `pes_canal_kg` | DECIMAL(8,2) | ❌ | Pes de la canal proporcionat posteriorment per l'escorxador |
| `preu_kg` | DECIMAL(8,2) | ✅ | Preu pactat per quilo (de carn o de pes viu, segons acord comercial) |
| `cost_transport` | DECIMAL(10,2) | ❌ | Cost del transport (o prorratejat si la venda és per lots) |
| `comprador_escorxador` | VARCHAR(255) | ❌ | Nom de l'empresa compradora o escorxador de destí |

### 3.2. Camp Calculat: Rendiment (%)

El rendiment carni es calcula automàticament quan `pes_canal_kg` és informat:

```
Rendiment (%) = (pes_canal_kg / pes_viu_kg) × 100
```

Aquest valor es presenta a la fitxa de l'animal i als informes de rendiment per lot.

### 3.3. Validació Prèvia a la Baixa per Venda

Abans de permetre el registre de la venda, el sistema ha de verificar:

1. **Bloqueig per supressió:** Si l'animal té un tractament actiu amb `data_alliberament > CURRENT_DATE`, el sistema **bloqueja la venda** i mostra el missatge: *"L'animal [crotal] no pot ser venut fins al [data_alliberament] per període de supressió del tractament [medicament]."*
2. **Estat actiu:** L'animal ha d'estar en `estat_actiu = TRUE`.

### 3.4. Accions en Confirmar la Venda

```
1. INSERT a la taula baixes (motiu='Venda', amb tots els camps econòmics)
2. UPDATE animals SET estat_actiu = FALSE, actualitzat_el = NOW()
3. UPDATE distribucio_animals SET data_sortida = data_baixa
   WHERE animal_id = X AND data_sortida IS NULL
4. INSERT a public.audit_log
```

---

## 4. Registre de Baixa per Mort

### 4.1. Camps Requerits

| Camp | Tipus | Obligatori | Descripció |
|------|-------|-----------|-----------|
| `data_baixa` | DATE | ✅ | Dia de la defunció |
| `causa_mort` | VARCHAR(255) | ✅ | Causa de la mort. Valors recomanats (desplegable + text lliure): `Malaltia respiratòria`, `Malaltia digestiva`, `Accident`, `Part complicat`, `Causa desconeguda`, `Altra (especificar)` |
| `codi_recollida_cadavers` | VARCHAR(100) | ✅ | Número de bitllet o justificant de l'empresa concessionària de retirada de cadàvers. **Obligatori per a tràmits d'assegurança i DARP** |

### 4.2. Justificació dels Camps de Mort

- **`causa_mort` amb desplegable categoritzat:** Permet detectar brots o patrons de mortalitat per cort o lot (ex: si 3 animals de la Nau 2 moren per "Malaltia respiratòria" en una setmana, el Dashboard ha d'emetre una alerta).
- **`codi_recollida_cadavers` obligatori:** Sense aquest codi no es pot tramitar l'assegurança de recollida ni els justificants exigits pel DARP (Departament d'Acció Climàtica, Alimentació i Agenda Rural de Catalunya).

### 4.3. Accions en Confirmar la Mort

```
1. INSERT a la taula baixes (motiu='Mort', amb causa i codi recollida)
2. UPDATE animals SET estat_actiu = FALSE, estat_salut = 'Crític', actualitzat_el = NOW()
3. UPDATE distribucio_animals SET data_sortida = data_baixa
   WHERE animal_id = X AND data_sortida IS NULL
4. INSERT a public.audit_log
```

---

## 5. Fitxa Detallada d'un Animal de l'Arxiu

En fer clic sobre qualsevol animal de la taula, s'obre una fitxa de consulta de només lectura amb:

- Dades bàsiques de l'animal (crotal, raça, data de naixement, sexe)
- Historial de lots i corts (de la taula `distribucio_animals`)
- Historial de pesos registrats
- Historial de tractaments veterinaris aplicats
- Dades de la baixa (venda o mort amb tots els camps específics)
- Rendiment calculat (si és venda amb `pes_canal_kg` informat)
- Cost sanitari acumulat

---

## 6. Taules de Base de Dades Implicades

| Taula | Operació |
|-------|---------|
| `animals` | Actualització de `estat_actiu = FALSE` en donar de baixa |
| `baixes` | Alta del registre de baixa (venda o mort) |
| `distribucio_animals` | Tancament de la distribució activa (`data_sortida`) |
| `tractaments` | Consulta per validar bloqueig de supressió |
| `registre_pes` | Consulta per historial de pesos a la fitxa |
| `public.audit_log` | Registre de totes les baixes |

> DDL complet a [`02_model_de_dades.md`](./02_model_de_dades.md), taula `baixes`.
