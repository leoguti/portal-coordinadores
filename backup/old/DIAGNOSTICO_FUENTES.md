# Diagnóstico de fuentes de certificados

Fecha: 18 feb 2026

## Fuentes identificadas

| Fuente | Certificados | Rango consecutivo | Ubicación |
|--------|-------------|-------------------|-----------|
| **Servidor DigitalOcean** (solo PDFs) | 33,475 | 13,957 → 92,102 | `/var/www/campolimpio.rumbo.digital/public_html/` |
| **Airtable** (datos + PDFs) | 33,255 | 58,714 → 92,102 | Base `appniHwKiUMS0imXD`, tabla `Certificados` |
| **Hojas de cálculo** | Por determinar | Por determinar | Pendiente de recopilar |

## Cruce de datos (por número de consecutivo)

| Categoría | Cantidad | Rango | Descripción |
|-----------|----------|-------|-------------|
| **En AMBOS** | 33,190 | 58,714 → 92,102 | Datos en Airtable + PDF en servidor. Airtable también tiene su propio PDF. |
| **Solo en servidor** | 285 | 13,957 → 91,724 | PDFs del sistema viejo, sin datos en Airtable. |
| **Solo en Airtable** | 65 | 66,414 → 91,721 | Registros en Airtable sin PDF en el servidor (generados directo en Airtable). |

## Distribución por rangos de consecutivo

| Rango | Servidor | Airtable | Observación |
|-------|----------|----------|-------------|
| 0 - 20,000 | 49 | 0 | 100% sistema viejo |
| 20,001 - 40,000 | 139 | 0 | 100% sistema viejo |
| 40,001 - 60,000 | 1,287 | 1,267 | Zona de transición |
| 60,001 - 80,000 | 19,985 | 19,934 | Casi totalmente solapados |
| 80,001 - 100,000 | 12,015 | 12,054 | Casi totalmente solapados |

## Servidor DigitalOcean

- **Host**: campolimpio.rumbo.digital
- **Usuario**: leonardo
- **Ruta PDFs**: `/var/www/campolimpio.rumbo.digital/public_html/`
- **Tamaño total PDFs**: 168 MB
- **Formato nombres**: `Certificado_XXXXX.pdf` y `certificado_XXXXX.pdf`
- **Carpetas adicionales**: `certificados_2023/`, `campolimpio/`, `dompdf/`, `vendor/`

## Conclusiones

1. **Certificados 13,957 - ~58,713**: Solo existen como PDF en DigitalOcean (sistema anterior). Los datos (campos) podrían estar en hojas de cálculo o en una base de datos en el servidor.

2. **Certificados 58,714 - 92,102**: Están en Airtable con datos completos + PDF. También tienen PDF en el servidor (duplicado).

3. **285 certificados** solo existen en el servidor — necesitan los datos de las hojas de cálculo para completar la migración a Neon.

4. **65 certificados** solo están en Airtable — probablemente generados después de la migración al sistema nuevo.

## Pendiente

- [ ] Recopilar hojas de cálculo con datos del sistema viejo
- [ ] Verificar si hay base de datos (MySQL/PostgreSQL) en el servidor DigitalOcean
- [ ] Revisar posible diferencia de esquema entre sistema viejo y nuevo
- [ ] Definir estrategia para unificar todo en una sola DB (Neon)
