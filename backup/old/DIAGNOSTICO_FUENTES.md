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

## Resumen de números

| Concepto | Cantidad |
|----------|----------|
| Total certificados únicos (estimado) | ~80,000+ |
| Con datos completos (Airtable) | 33,255 |
| Con datos del CSV | 16,842 |
| Sin datos (solo PDF) | ~30,000 |
| PDFs en Google Drive | 73,454 |
| PDFs en servidor DO | 33,475 |
| Generadores en SQLite | 2,268 |

## Pendiente

- [x] Recopilar hojas de cálculo con datos del sistema viejo
- [x] Explorar `campolimpio.tar.gz` (SQLite encontrada)
- [ ] Cruzar CSV con Google Drive (verificar qué PDFs del CSV tienen match en Drive)
- [ ] Verificar acceso al Google Drive con las credenciales del servidor
- [ ] Decidir qué hacer con Zona A y C (certificados sin datos, solo PDF)
- [ ] Definir esquema unificado en Neon que cubra ambos sistemas
- [ ] Definir estrategia de migración por zonas
