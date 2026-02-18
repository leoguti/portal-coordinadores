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
- **Cuenta**: leogiga@gmail.com (temporal, se puede migrar)
- **Ventajas**:
  - 10 GB gratis (suficiente para PDFs de certificados)
  - Sin costo de descarga (zero egress fees)
  - Compatible con API S3
  - Cada PDF queda con URL directa accesible

## Proceso de migración

```
1. Exportar registros de Certificados (2021-2024) desde Airtable
2. Crear tabla en Neon PostgreSQL con el esquema equivalente
3. Insertar datos en Neon
4. Descargar PDFs adjuntos de Airtable
5. Subir PDFs a Cloudflare R2
6. Guardar URL de R2 en la tabla de Neon (referencia al PDF)
7. Verificar integridad (conteo de registros + muestreo aleatorio)
8. Eliminar registros archivados de Airtable
```

## Consulta de registros archivados

**Opción A (inicial)**: Consulta directa desde el dashboard de Neon.

```sql
-- Ejemplo: buscar certificados de un coordinador en 2023
SELECT * FROM certificados WHERE año = 2023 AND coordinador = 'Nombre';
```

Los resultados incluyen el link al PDF en Cloudflare R2, descargable con un clic.

**Opción B (futura, si se requiere)**: Crear endpoint en el portal que consulte Neon automáticamente para certificados de años archivados.

## Ejecución recurrente

Cada **enero** se ejecuta el mismo proceso:
- Año vigente: N
- Se conserva: N + (N-1)
- Se archiva: todo lo anterior a (N-1)

Ejemplo: en enero 2027 se archiva 2025, quedando solo 2026 + 2027 en Airtable.

## Estado

- [x] Decisión aprobada por cliente
- [ ] Cuenta Neon creada (leogiga@gmail.com)
- [ ] Cuenta Cloudflare R2 creada (leogiga@gmail.com)
- [ ] Script de migración implementado
- [ ] Migración ejecutada
- [ ] Verificación de integridad
- [ ] Eliminación de registros en Airtable
