# Plan de Backup y Migración — Tabla Certificados

## Contexto

La base de Airtable tiene **55,545 registros** sobre un límite de 50,000. La tabla **Certificados** es la más grande con **33,247 registros** (60% del total). Se requiere archivar registros antiguos para volver dentro del límite y tener margen de crecimiento.

## Regla de Negocio

> Conservar en Airtable únicamente los certificados del **año vigente** y del **año inmediatamente anterior**. El resto se archiva.

Aplicando para 2026:
- **Quedan en Airtable**: 2025 + 2026
- **Se archivan**: 2024 y anteriores

Esta regla se ejecuta anualmente (cada enero se archiva el año que queda fuera del rango).

## Distribución actual (feb 2026)

| Año | Registros | Acción |
|-----|-----------|--------|
| 2021 | 1 | Archivar |
| 2022 | 2,871 | Archivar |
| 2023 | 10,900 | Archivar |
| 2024 | 10,581 | Archivar |
| **2025** | **8,365** | **Conservar** |
| **2026** | **525** | **Conservar** |

- **Total a archivar**: 24,353 registros
- **Quedan en Airtable**: 8,890 certificados
- **Total base después**: ~31,192 registros (margen de 18,808)

## Destino del archivo

### Datos (campos de texto/números) → Neon PostgreSQL

- **Servicio**: [Neon](https://neon.com) — PostgreSQL serverless
- **Plan**: Free (0.5 GB almacenamiento, sin expiración, sin tarjeta de crédito)
- **Cuenta**: leogiga@gmail.com (temporal, se puede migrar a cuenta institucional)
- **Ventajas**:
  - Dashboard web con SQL Editor integrado
  - IA para generar consultas en lenguaje natural
  - Exportar resultados a CSV, JSON o Excel
  - No se pausa por inactividad
  - Compatible con cualquier cliente PostgreSQL (pgAdmin, DBeaver, etc.)

### Archivos PDF → Cloudflare R2

- **Servicio**: [Cloudflare R2](https://www.cloudflare.com/developer-platform/products/r2/)
- **Plan**: Free (10 GB almacenamiento, zero egress)
- **Cuenta**: info@rumbo.digital
- **Ventajas**:
  - 10 GB gratis (suficiente para PDFs de certificados)
  - Sin costo de descarga (zero egress fees)
  - Compatible con API S3
  - Cada PDF queda con URL directa accesible

## Infraestructura configurada

### Neon PostgreSQL
- **Proyecto**: campolimpio-certificados
- **Región**: AWS US East 1 (N. Virginia)
- **Postgres**: v17
- **Variable**: `NEON_DATABASE_URL` en `.env.local`

### Cloudflare R2
- **Bucket**: `campolimpio-certificados`
- **URL pública**: `https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev`
- **Tokens creados**:
  - Solo lectura (para consultas)
  - Lectura/escritura `campolimpio-rw` (para migración)
- **Variables en `.env.local`**: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`

## Script de migración

**Ubicación**: `backup/migrate-certificados.ts`

```bash
# Prueba (10 registros)
npx tsx backup/migrate-certificados.ts --test

# Migración completa (24,353 registros)
npx tsx backup/migrate-certificados.ts --full
```

El script:
1. Lee certificados de Airtable (filtro: `YEAR(fechadevolucion) <= 2024`)
2. Crea tabla `certificados` en Neon con esquema completo (31 campos + índices)
3. Descarga cada PDF de Airtable y lo sube a R2 (organizado por carpeta de año)
4. Inserta el registro en Neon con URL pública al PDF en R2
5. Usa `ON CONFLICT` para evitar duplicados si se re-ejecuta

## Prueba realizada (18 feb 2026)

- **10 registros más antiguos** migrados exitosamente
- **10 PDFs** subidos a R2 y accesibles por URL pública
- **Datos verificados** en Neon SQL Editor
- **PDFs verificados** abriendo URL directa en navegador
- **0 errores**

Ejemplo de URL pública de PDF:
```
https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev/2021/certificado_89915.pdf
```

## Proceso de migración completa

```
1. Ejecutar: npx tsx backup/migrate-certificados.ts --full
2. Verificar conteo en Neon: SELECT COUNT(*) FROM certificados → debe ser 24,353
3. Verificar muestreo aleatorio de PDFs en R2
4. Eliminar registros 2021-2024 de Airtable
5. Verificar que Airtable quede en ~31,192 registros (bajo el límite de 50,000)
```

## Consulta de registros archivados

**Opción A (inicial)**: Consulta directa desde el dashboard de Neon SQL Editor.

```sql
-- Buscar certificados de un coordinador en 2023
SELECT * FROM certificados WHERE ano = 2023 AND nombrecoordinador ILIKE '%nombre%';

-- Buscar por generador
SELECT consecutivo, nombregenerador, fechadevolucion, total, certificadopdf_r2_url
FROM certificados WHERE nombregenerador ILIKE '%empresa%';

-- Resumen por año
SELECT ano, COUNT(*), SUM(total) FROM certificados GROUP BY ano ORDER BY ano;
```

Los resultados incluyen el campo `certificadopdf_r2_url` — clic en la URL abre el PDF directo.

**Opción B (futura, si se requiere)**: Crear endpoint en el portal que consulte Neon automáticamente para certificados de años archivados.

## Ejecución recurrente

Cada **enero** se ejecuta el mismo proceso:
- Año vigente: N
- Se conserva: N + (N-1)
- Se archiva: todo lo anterior a (N-1)

Ejemplo: en enero 2027 se archiva 2025, quedando solo 2026 + 2027 en Airtable.

## Seguridad — Credenciales en 1Password

**PENDIENTE**: Todas las credenciales de los nuevos servicios deben guardarse en **1Password**:

| Credencial | Servicio | Estado |
|------------|----------|--------|
| Connection string (NEON_DATABASE_URL) | Neon PostgreSQL | Pendiente guardar en 1Password |
| Access Key ID (solo lectura) | Cloudflare R2 | Pendiente guardar en 1Password |
| Secret Access Key (solo lectura) | Cloudflare R2 | Pendiente guardar en 1Password |
| Access Key ID (lectura/escritura - `campolimpio-rw`) | Cloudflare R2 | Pendiente guardar en 1Password |
| Secret Access Key (lectura/escritura - `campolimpio-rw`) | Cloudflare R2 | Pendiente guardar en 1Password |
| Login Neon (leogiga@gmail.com) | Neon | Pendiente guardar en 1Password |
| Login Cloudflare (info@rumbo.digital) | Cloudflare | Pendiente guardar en 1Password |

> Nota: Actualmente hay un problema de acceso a 1Password. Resolver antes de la migración a producción.

## Estado

- [x] Decisión aprobada por cliente
- [x] Cuenta Neon creada (leogiga@gmail.com)
- [x] Cuenta Cloudflare R2 creada (info@rumbo.digital)
- [x] Bucket `campolimpio-certificados` creado
- [x] Token R2 solo lectura creado
- [x] Token R2 lectura/escritura creado (`campolimpio-rw`)
- [ ] Credenciales guardadas en 1Password
- [x] Script de migración implementado (`backup/migrate-certificados.ts`)
- [x] Prueba con 10 registros exitosa (0 errores, 10 PDFs accesibles)
- [x] URL pública de R2 habilitada y verificada
- [ ] **SIGUIENTE**: Ejecutar migración completa (`--full`, ~24,353 registros)
- [ ] Verificación de integridad (conteo + muestreo)
- [ ] Eliminación de registros 2021-2024 en Airtable
