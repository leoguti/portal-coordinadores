# Diagnóstico de fuentes de certificados

Fecha: 18 feb 2026

## Fuentes identificadas

| # | Fuente | Certificados | Rango consecutivo | Ubicación |
|---|--------|-------------|-------------------|-----------|
| 1 | **Servidor DigitalOcean** (PDFs) | 33,475 | 13,957 → 92,102 | `/var/www/campolimpio.rumbo.digital/public_html/` |
| 2 | **Airtable** (datos + PDFs) | 33,255 | 58,714 → 92,102 | Base `appniHwKiUMS0imXD`, tabla `Certificados` |
| 3 | **Google Drive** (PDFs) | 73,454 | 10,925 → 58,713 | Cuenta de servicio `subidor-certificados@certificados-campolimpio.iam.gserviceaccount.com` |
| 4 | **Hojas de cálculo** | Por determinar | Por determinar | Pendiente de recopilar |

## Google Drive — Sistema viejo (NUEVA FUENTE)

- **73,454 PDFs** organizados por carpetas de año/mes (2018 → 2022)
- Rango: Certificado_10925 → Certificado_58713
- Carpetas por año: 2003, 2018, 2019, 2020, 2021, 2022 (con subcarpetas de mes)
- Carpeta especial: `Respaldo Certificados` (owner: certificados@campolimpio.org)
- Listado completo en: `/home/leonardo/proyectos/backup_campolimpio/lista_drive.txt` (servidor DO)
- Scripts de acceso al Drive en: `/home/leonardo/proyectos/backup_campolimpio/`
- Credenciales: `/home/leonardo/proyectos/backup_campolimpio/clave-campolimpio.json`

## Cruce de datos (por número de consecutivo)

### Servidor DigitalOcean vs Airtable

| Categoría | Cantidad | Rango | Descripción |
|-----------|----------|-------|-------------|
| **En AMBOS** | 33,190 | 58,714 → 92,102 | Datos en Airtable + PDF en servidor |
| **Solo en servidor** | 285 | 13,957 → 91,724 | PDFs del sistema viejo sin datos en Airtable |
| **Solo en Airtable** | 65 | 66,414 → 91,721 | Registros sin PDF en servidor |

### Distribución por rangos de consecutivo

| Rango | Servidor DO | Airtable | Google Drive | Observación |
|-------|-------------|----------|--------------|-------------|
| 0 - 20,000 | 49 | 0 | ~9,000+ | Sistema viejo, solo Drive tiene PDFs |
| 20,001 - 40,000 | 139 | 0 | ~20,000+ | Sistema viejo |
| 40,001 - 60,000 | 1,287 | 1,267 | ~44,000+ | Zona de transición |
| 60,001 - 80,000 | 19,985 | 19,934 | 0 | Sistema nuevo (Airtable) |
| 80,001 - 100,000 | 12,015 | 12,054 | 0 | Sistema nuevo (Airtable) |

## Mapa visual de fuentes

```
Consecutivo:  10,925 .............. 58,713 .. 58,714 .............. 92,102
              |                          |    |                          |
Google Drive: |████████████████████████████|    |                          |
              | 73,454 PDFs (sistema viejo)|    |                          |
              |                          |    |                          |
Servidor DO:  |      |██████████████████████████████████████████████████████|
              |      13,957              |    |                    33,475 PDFs
              |                          |    |                          |
Airtable:     |                          |    |██████████████████████████|
              |                          |    | 33,255 registros + PDFs  |
              |                          |    |                          |
Hojas cálculo:|  ¿¿¿¿¿ POR DETERMINAR ¿¿¿¿¿ |                          |
```

## Otros hallazgos en el servidor

- **`/opt/reporte_campolimpio/`**: Proyecto de reportes con queries a Airtable (Python/FastAPI)
- **`/var/www/campolimpio.rumbo.digital/campolimpio.tar.gz`**: Sistema viejo comprimido (5.5 MB, marzo 2021)
- **`/home/leonardo/proyectos/backup_campolimpio/`**: Scripts de Google Drive + listado + credenciales

## Conclusiones

1. **Google Drive es la fuente más grande**: 73,454 PDFs del sistema anterior (2018-2022), consecutivos 10,925 → 58,713.

2. **El servidor DO tiene una copia parcial**: 33,475 PDFs (13,957 → 92,102), mezcla de sistema viejo y nuevo.

3. **Airtable tiene los datos estructurados**: Solo del sistema nuevo (58,714 → 92,102), 33,255 registros con campos completos.

4. **Los datos del sistema viejo (campos/datos)** no están en Airtable — probablemente están en las hojas de cálculo pendientes de recopilar o en el tar.gz del sistema viejo.

5. **Total estimado de certificados únicos**: ~80,000+ (10,925 → 92,102)

## Pendiente

- [ ] Recopilar hojas de cálculo con datos del sistema viejo
- [ ] Explorar `campolimpio.tar.gz` (posible DB del sistema anterior)
- [ ] Verificar acceso al Google Drive con las credenciales del servidor
- [ ] Definir qué datos se migran a Neon (solo Airtable, o también sistema viejo)
- [ ] Revisar posible diferencia de esquema entre sistema viejo y nuevo
- [ ] Definir estrategia para unificar todo en una sola DB (Neon)
