# 05 — Estratègia de Còpies de Seguretat i Recuperació (Backup / DR)

> **Versió:** 1.0.0  
> **Última actualització:** Juny de 2026

---

## 1. Objectius de Recuperació

Abans de definir l'estratègia, cal establir els objectius mínims acceptables:

| Paràmetre | Definició | Objectiu |
|-----------|----------|---------|
| **RPO** (Recovery Point Objective) | Màxima pèrdua de dades acceptable | **≤ 24 hores** |
| **RTO** (Recovery Time Objective) | Temps màxim de recuperació acceptable | **≤ 4 hores** |

> **Justificació:** Les granges operen de dilluns a diumenge però els registres crítics (tractaments, baixes) no solen superar un dia de desfasament acceptable. Un temps de recuperació de 4 hores permet restaurar el servei abans de la jornada laboral del dia següent.

---

## 2. Estratègia de Còpies (Regla 3-2-1)

S'aplica la regla estàndard **3-2-1**:
- **3** còpies de les dades
- En **2** suports o ubicacions diferents
- Amb **1** còpia fora de les instal·lacions principals (offsite)

| Còpia | Tipus | Freqüència | Ubicació | Retenció |
|-------|-------|-----------|---------|---------|
| **Còpia 1** | Backup complet PostgreSQL (`pg_dump`) | Diari (nocturn, 02:00h) | Servidor de BD (local) | 7 dies |
| **Còpia 2** | Backup complet + incrementals | Diaria + contínua (WAL) | Objecte Storage (ex: S3, Wasabi) | 30 dies |
| **Còpia 3** | Còpia mensual consolidada | Mensual (primer dia del mes) | Ubicació geogràfica diferent | 12 mesos |

### 2.1. Backups per Tenant (Granularitat Fina)

Gràcies a l'estratègia de schema per tenant, es pot fer backup d'un client individual sense restaurar tota la instància:

```bash
# Backup d'un tenant específic
pg_dump \
  --schema=tenant_00001 \
  --format=custom \
  --file=/backups/tenant_00001_$(date +%Y%m%d).dump \
  nom_base_dades

# Backup del schema públic (tenants + users)
pg_dump \
  --schema=public \
  --format=custom \
  --file=/backups/public_$(date +%Y%m%d).dump \
  nom_base_dades
```

### 2.2. WAL Archiving (Recuperació Puntual — PITR)

S'ha de configurar **Point-in-Time Recovery (PITR)** per poder recuperar la BD a qualsevol moment del dia, no només al punt del backup nocturn.

```ini
# postgresql.conf — configuració mínima per a WAL archiving
wal_level = replica
archive_mode = on
archive_command = 'cp %p /ruta/wal_archive/%f'
archive_timeout = 300   # Màxim 5 minuts sense archivar WAL
```

---

## 3. Procediment de Restauració

### 3.1. Escenaris de Restauració

| Escenari | Procediment | Temps Estimat |
|---------|-------------|--------------|
| Corrupció de dades d'un tenant | Restaurar schema individual del backup | ~30 min |
| Error humà (esborrat accidental) | PITR al moment anterior a l'error | ~1 hora |
| Fallada total del servidor | Restaurar instància completa + WAL | ~3-4 hores |
| Restaurar dades antigues (auditoria) | Restaurar en entorn temporal i exportar | ~2 hores |

### 3.2. Restauració d'un Tenant Individual

```bash
# 1. Crear un schema temporal per a la restauració
psql -c "CREATE SCHEMA tenant_00001_restore;"

# 2. Restaurar el backup al schema temporal
pg_restore \
  --schema=tenant_00001 \
  --target-schema=tenant_00001_restore \
  --dbname=nom_base_dades \
  /backups/tenant_00001_20260628.dump

# 3. Verificar les dades restaurades
psql -c "SELECT COUNT(*) FROM tenant_00001_restore.animals;"

# 4. Si la verificació és correcta, fer el canvi:
#    Opció A: Renombrar schemas (manteniment breu)
#    Opció B: Copiar les files afectades selectivament (sense tall de servei)
```

### 3.3. Restauració Completa (Disaster Recovery)

```bash
# 1. Aturar el servidor de BD
systemctl stop postgresql

# 2. Restaurar des del backup complet més recent
pg_restore --format=custom --dbname=nom_base_dades /backups/full_backup.dump

# 3. Aplicar WAL archivats fins al punt desitjat
# (configurar recovery.conf o postgresql.conf amb recovery_target_time)

# 4. Verificar integritat
psql -c "SELECT COUNT(*) FROM public.tenants WHERE actiu = TRUE;"

# 5. Reiniciar el servei i fer proves de connectivitat
systemctl start postgresql
```

---

## 4. Verificació i Proves de Backup

> Un backup que no s'ha provat no és un backup.

### 4.1. Verificació Automàtica Diària

Cada dia, després de generar el backup, s'ha d'executar automàticament:

```bash
#!/bin/bash
# Script de verificació de backup

BACKUP_FILE="/backups/backup_$(date +%Y%m%d).dump"
TEST_DB="backup_test_$(date +%Y%m%d)"

# 1. Restaurar en BD temporal
createdb $TEST_DB
pg_restore --dbname=$TEST_DB $BACKUP_FILE

# 2. Verificar taules crítiques
TENANT_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM public.tenants WHERE actiu = TRUE;")
ANIMALS_COUNT=$(psql -d $TEST_DB -t -c "SELECT COUNT(*) FROM tenant_00001.animals;")

# 3. Emetre alerta si el recompte és 0 o difereix molt de l'esperat
if [ "$TENANT_COUNT" -eq 0 ]; then
  echo "ALERTA: Backup sense tenants actius!" | mail -s "ERROR Backup" admin@plataforma.com
fi

# 4. Eliminar BD temporal
dropdb $TEST_DB

echo "Verificació completada: $TENANT_COUNT tenants, $ANIMALS_COUNT animals en tenant_00001"
```

### 4.2. Simulacre de DR (Trimestral)

Cada trimestre s'ha de realitzar un simulacre complet de recuperació en un entorn de test:

| Activitat | Freqüència | Responsable |
|-----------|-----------|------------|
| Verificació automàtica de backup | Diària (automatitzada) | Sistema |
| Restauració de schema individual en test | Setmanal | Tècnic |
| Simulacre de DR complet (fallada servidor) | Trimestral | Equip tècnic |
| Revisió i actualització del pla DR | Anual | Responsable tècnic |

---

## 5. Seguretat dels Backups

| Requisit | Implementació |
|---------|--------------|
| **Xifrat en trànsit** | TLS per a la transferència al storage offsite |
| **Xifrat en repòs** | Backups xifrats amb AES-256 (clau gestionada separadament) |
| **Control d'accés** | Accés als backups restringit a rols d'administració del sistema |
| **Integritat** | Hash SHA-256 de cada fitxer de backup, verificat en restauració |
| **Immutabilitat** | Emmagatzematge amb Object Lock (WORM) al storage offsite: no es poden esborrar ni modificar |

---

## 6. Pla de Comunicació en Cas d'Incident

| Temps des de l'incident | Acció |
|------------------------|-------|
| **0-15 min** | Detecció i avaluació inicial. Activació del pla DR si escau |
| **15-30 min** | Notificació interna a l'equip tècnic i responsable |
| **30-60 min** | Notificació als tenants afectats per correu electrònic |
| **Cada hora** | Actualització d'estat als tenants fins a la resolució |
| **Post-incident** | Informe post-mortem en 48h: causa, impacte, mesures correctives |

> **Obligació RGPD:** Si la fallada implica exposició de dades personals, cal notificar a l'**Agència Espanyola de Protecció de Dades (AEPD)** en un termini màxim de **72 hores** des de la detecció (Art. 33 RGPD).
