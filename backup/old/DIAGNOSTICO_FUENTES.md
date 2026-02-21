# Diagnóstico de fuentes de certificados

Fecha: 18-19 feb 2026 (actualizado)

## Fuentes identificadas

| # | Fuente | Registros | Rango consecutivo | Tiene datos | Tiene PDF | Ubicación |
|---|--------|-----------|-------------------|-------------|-----------|-----------|
| 1 | **Airtable** | 33,255 | 58,714 → 92,102 | Sí | Sí | Base `appniHwKiUMS0imXD`, tabla `Certificados` |
| 2 | **Hoja de cálculo (CSV)** | 16,842 | 36,142 → 53,991 | Sí | No | `backup/old/certificados_campolimpio.csv` |
| 3 | **Google Drive** | 73,454 | 10,925 → 58,713 | No | Sí | Cuenta de servicio `subidor-certificados@certificados-campolimpio.iam.gserviceaccount.com` |
| 4 | **Servidor DigitalOcean** | 33,475 | 13,957 → 92,102 | No | Sí | `/var/www/campolimpio.rumbo.digital/public_html/` |
| 5 | **SQLite (sistema viejo)** | 2,268 | - | Datos generadores | No | `campolimpio.tar.gz` → `campolimpio.db` tabla `ubicaciones` |

## Detalle por fuente

### 1. Airtable (sistema actual)

- **33,255 registros** con datos completos + PDF adjunto
- Rango: 58,714 → 92,102
- Campos: consecutivo, generador, coordinador, cantidades (rígidos, flexibles, metálicos, embalaje), fecha, municipio, PDF
- Distribución por año:
  - 2022: 2,871
  - 2023: 10,900
  - 2024: 10,581
  - 2025: 8,365
  - 2026: 525

### 2. Hoja de cálculo (Google Sheets → CSV)

- **16,842 registros** del sistema viejo
- Rango: 36,142 → 53,991
- Archivo: `backup/old/certificados_campolimpio.csv`
- Campos (24 columnas):
  ```
  consecutivo, tipocertificado, nombregenerador, cedulagenerador,
  movilgenerador, direcciongenerador, cultivogenerador, emailgenerador,
  municipiogenerador, rigidos, flexibles, metalicos, embalaje,
  totalentregado, triplelavado, lugardevolucion, municipiodevolucion,
  fechadevolucion, fechageneracion, observaciones, nombrecoordinador,
  movilcoordinador, emailcoordinador, año
  ```
- Distribución por año:
  - 2006: 1
  - 2019: 4
  - 2020: 1,630
  - 2021: 10,878
  - 2022: 4,329
- **Esquema muy similar al de Airtable** — se puede mapear directamente

### 3. Google Drive (PDFs del sistema viejo)

- **73,454 PDFs** organizados por carpetas de año/mes
- Rango: Certificado_10925 → Certificado_58713
- Carpetas por año: 2003, 2018, 2019, 2020, 2021, 2022
- Carpeta especial: `Respaldo Certificados` (owner: certificados@campolimpio.org)
- Cuenta de servicio: `subidor-certificados@certificados-campolimpio.iam.gserviceaccount.com`
- Credenciales: `/home/leonardo/proyectos/backup_campolimpio/clave-campolimpio.json` (servidor DO)
- Listado completo: `/home/leonardo/proyectos/backup_campolimpio/lista_drive.txt` (servidor DO)
- Scripts de acceso: `/home/leonardo/proyectos/backup_campolimpio/` (servidor DO)

### 4. Servidor DigitalOcean (PDFs mixtos)

- **33,475 PDFs** — mezcla de sistema viejo y nuevo
- Rango: 13,957 → 92,102
- Host: `campolimpio.rumbo.digital` (usuario: `leonardo`)
- Ruta: `/var/www/campolimpio.rumbo.digital/public_html/`
- Formato nombres: `Certificado_XXXXX.pdf` y `certificado_XXXXX.pdf`
- Carpeta adicional: `certificados_2023/`
- Tamaño total: **168 MB**

### 5. SQLite del sistema viejo

- Encontrada dentro de `campolimpio.tar.gz` (5.5 MB, marzo 2021)
- Ruta: `/var/www/campolimpio.rumbo.digital/campolimpio.tar.gz`
- Base de datos: `campolimpio.db`
- **Tabla `ubicaciones`**: 2,268 registros de generadores
  ```
  nombregenerador, direcciongenerador, cultivogenerador,
  municipiogenerador, cedulagenerador, movilgenerador,
  emailgenerador, tipo
  ```
- **Tabla `kardex`**: 31 registros (datos de prueba/minimal)
- El sistema viejo era PHP + Google Sheets API + SQLite + Google Drive

## Cruce de datos por consecutivo

### Mapa visual

```
Consecutivo:  10,925 .... 36,142 .... 53,991 .. 58,713 .. 58,714 .............. 92,102
              |           |                |     |         |                          |
Google Drive: |████████████████████████████████████|         |                          |
              | 73,454 PDFs                       |         |                          |
              |           |                |     |         |                          |
CSV (datos):  |           |████████████████|     |         |                          |
              |           | 16,842 registros|     |         |                          |
              |           |                |     |         |                          |
Servidor DO:  |      |████████████████████████████████████████████████████████████████|
              |      13,957                      |         |                  33,475  |
              |           |                |     |         |                          |
Airtable:     |           |                |     |         |██████████████████████████|
              |           |                |     |         | 33,255 datos + PDFs      |
```

### Zonas identificadas

| Zona | Rango | Datos | PDFs | Notas |
|------|-------|-------|------|-------|
| **A** | 10,925 → 36,141 | Sin datos | Google Drive + algunos en DO | Solo PDFs, sin datos estructurados |
| **B** | 36,142 → 53,991 | CSV (16,842) | Google Drive + algunos en DO | Datos + PDFs disponibles |
| **C** | 53,992 → 58,713 | Sin datos | Google Drive + algunos en DO | Solo PDFs, sin datos estructurados |
| **D** | 58,714 → 92,102 | Airtable (33,255) | Airtable + DO | Todo completo |

### Servidor DO vs Airtable (cruce)

| Categoría | Cantidad | Rango |
|-----------|----------|-------|
| En AMBOS | 33,190 | 58,714 → 92,102 |
| Solo en servidor | 285 | 13,957 → 91,724 |
| Solo en Airtable | 65 | 66,414 → 91,721 |

## Arquitectura del sistema viejo

```
Google Sheets (datos de certificados)
    ↓ API
PHP App (campolimpio.tar.gz)
    ↓ genera
PDFs (certificado_XXXXX.pdf)
    ↓ sube a
Google Drive (cuenta de servicio)
    ↓ copia a
Servidor DO (/var/www/.../public_html/)

SQLite (campolimpio.db)
    → ubicaciones de generadores (tabla auxiliar)
```

## Resumen de números (actualizado 20 feb 2026)

| Concepto | Cantidad |
|----------|----------|
| Total certificados únicos | 80,127 |
| Con datos de Airtable | 33,280 |
| Con datos del CSV | 16,842 |
| Con datos de TextIt | 30,005 |
| Sin cédula | 52 |
| Sin municipio devolución | 82 |
| Sin fecha devolución | 0 |
| PDFs en R2 | 69,834 |
| Registros con URL de PDF | 80,048 |
| Registros sin PDF (perdidos de Drive) | 79 |

## Accesos verificados (19 feb 2026)

| Recurso | Acceso | Cómo |
|---------|--------|------|
| Servidor DO (SSH) | OK | `ssh leonardo@campolimpio.rumbo.digital` |
| PDFs en DO | OK | `/var/www/campolimpio.rumbo.digital/public_html/` (33,475 PDFs confirmados) |
| campolimpio.tar.gz | OK | `/var/www/campolimpio.rumbo.digital/campolimpio.tar.gz` (SQLite dentro) |
| Scripts Google Drive | OK | `/home/leonardo/proyectos/backup_campolimpio/` (clave-campolimpio.json, scripts Python, lista_drive.txt) |
| Google Drive (API) | OK | Verificado 19 feb — cuenta de servicio funciona |
| Airtable | OK | API key en 1Password (item "Portal CampoLimpio", vault Private) |
| Neon PostgreSQL | OK | Connection string en 1Password |
| Cloudflare R2 | OK | Tokens en 1Password. URL pública: `https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev` |
| CSV sistema viejo | OK | `backup/old/certificados_campolimpio.csv` (16,842 registros, local) |

## Credenciales en 1Password

Todas las credenciales del proyecto se guardaron en 1Password el 19 feb 2026:
- **Item**: "Portal CampoLimpio" en vault "Private"
- **Incluye**: AIRTABLE_API_KEY, NEON_DATABASE_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, VERCEL_TOKEN, etc.
- **Archivo de referencia**: `.env.1password` (usa `op://` URIs, no contiene secretos)
- **Regenerar .env.local**: `op inject -i .env.1password -o .env.local`

Credenciales NO incluidas en 1Password (pendiente):
- Clave de cuenta de servicio Google Drive (`clave-campolimpio.json` en servidor DO)
- SSH key del servidor DO

## Migración completada (19-20 feb 2026)

### Scripts de migración

| Script | Fuente | Registros | Estado |
|--------|--------|-----------|--------|
| `backup/migrate-certificados.ts` | Airtable → Neon | 33,280 | Completado (0 errores) |
| `backup/migrate-csv.ts` | CSV → Neon | 16,842 | Completado (0 errores) |
| `backup/migrate-certificados-recientes.ts` | Airtable 2025-2026 → Neon | incluidos en Airtable | Completado (backup seguridad) |
| `drive_to_r2.py` (en DO server) | Google Drive → R2 | 36,326 ok / 10,364 err | Completado |
| `backup/fill-from-textit.ts` | TextIt archives → Neon | 30,005 | Completado (0 errores) |

### PDFs en R2

| Origen | PDFs | Método |
|--------|------|--------|
| Servidor DO → R2 | 33,507 | rclone copy directo (12 min) |
| Google Drive → R2 | 36,326 | Script Python + rclone en DO server |
| **Total en R2** | **69,834** | Bucket: `campolimpio-certificados/pdfs/` |

- **10,364 PDFs perdidos**: archivos listados en Google Drive pero devuelven 404 (borrados permanentemente)
- Nombres: lowercase `certificado_XXXXX.pdf` (normalizado) + 139 uppercase originales del DO
- URL pública: `https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev/pdfs/certificado_XXXXX.pdf`

### Base de datos Neon (estado final — 20 feb 2026)

| Fuente | Registros | Rango | Datos | PDF en R2 |
|--------|-----------|-------|-------|-----------|
| `airtable` | 33,280 | 58,714 → 92,102 | Completos | Sí |
| `csv` | 16,842 | 36,142 → 53,991 | Completos | Parcial (via Drive/DO) |
| `textit` | 30,005 | 10,925 → 58,713 | Rellenados desde TextIt | ~36,326 (10,364 perdidos) |
| **Total** | **80,127** | 10,925 → 92,131 | **Todos con datos** | 80,048 con PDF |

- Se deduplicaron 16,819 registros (csv + drive-solo-pdf con mismo consecutivo)
- Se rellenaron 30,005 registros desde TextIt archives API (100% match)
- Solo 52 sin cédula, 82 sin municipio, 79 sin PDF en R2

### Relleno desde TextIt (20 feb 2026)

- **API**: `https://textit.com/api/v2/archives.json?archive_type=run`
- **Token**: almacenado en el script `backup/fill-from-textit.ts`
- **Archivos descargados**: 112 (95 mensuales + 17 diarios), rango dic 2017 → nov 2025
- **Total runs**: 405,154 (100,707 de certificados → 79,559 consecutivos únicos)
- **Flujo principal**: "08-Copy of certificado" (sistema viejo, llamaba a `campolimpio.rumbo.digital/newrow.php`)
- **Campos extraídos**: cedulagenerador, rigidos, flexibles, metalicos, embalaje, triplelavado, fechadevolucion, lugardevolucion, municipiodevolucion, tipocertificado, observaciones
- **Campos NO disponibles en TextIt** (venían de child flows/contact): nombregenerador, movilgenerador, direcciongenerador, cultivogenerador, emailgenerador, municipiogenerador, nombrecoordinador, movilcoordinador, emailcoordinador

### Herramientas instaladas en servidor DO

- **rclone**: `~/rclone` — para copiar archivos a R2
- **drive_to_r2.py**: `~/proyectos/backup_campolimpio/drive_to_r2.py`
- **Temp files**: `/tmp/drive_pdfs/`, `/tmp/do_ids.txt`, `/tmp/drive_ids.txt`, `/tmp/missing_ids.txt`

## Pendiente

- [x] Recopilar hojas de cálculo con datos del sistema viejo
- [x] Explorar `campolimpio.tar.gz` (SQLite encontrada)
- [x] Credenciales guardadas en 1Password (19 feb 2026)
- [x] Verificar acceso SSH al servidor DO (19 feb 2026)
- [x] Verificar acceso al Google Drive con las credenciales del servidor
- [x] Ejecutar migración Airtable → Neon (33,280 registros, 0 errores)
- [x] Ejecutar migración CSV → Neon (16,842 registros, 0 errores)
- [x] Backup certificados recientes 2025-2026 → Neon (seguridad)
- [x] PDFs DO → R2 via rclone (33,507 PDFs)
- [x] PDFs Google Drive → R2 (36,326 ok, 10,364 perdidos)
- [x] Registros minimales drive-solo-pdf en Neon (46,824)
- [x] Deduplicar registros (16,819 csv+drive-solo-pdf duplicados eliminados → 80,127 únicos)
- [x] Rellenar datos desde TextIt archives (30,005 registros, 100% match, 0 errores)
- [ ] Limpiar archivos temporales en servidor DO (`~/rclone`, `/tmp/drive_pdfs/`, etc.)
- [ ] Guardar credenciales faltantes en 1Password (clave Google Drive, SSH key, TextIt token)
- [ ] **Verificar URLs de PDFs**: cruzar registros Neon con archivos reales en R2
- [ ] **Completar campos faltantes**: nombregenerador, movilgenerador, etc. (no disponibles en TextIt, posible extracción desde PDFs)
- [ ] **Borrar certificados viejos de Airtable**: una vez verificado el backup completo
