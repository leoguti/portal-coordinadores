# Depuración tabla `ubicaciones`

## Diagnóstico inicial (2026-03-28)

**Total registros:** 12.253

### Problemas identificados

| Problema | Cantidad |
|----------|----------|
| Sin certificados (nunca usados) | 1.784 |
| Cédulas duplicadas | 1.010 cédulas (3.469 registros) |
| Teléfonos de coordinador usados como tel. generador | 3107623699 (510), 3122500713 (100), 3105304569 (59) |

---

## Limpieza ejecutada (2026-04-10)

**Backup previo:** `docs/backup_ubicaciones_20260410.json` (12.275 registros, excluido de git)

### Fase 1 — Eliminación de registros sin certificado

Análisis de los 1.784 sin certificado, clasificados por:
- Si tenían usuario WhatsApp vinculado
- Si tenían gemelo con certificado (misma cédula o teléfono WP)
- Antigüedad del registro

| Categoría | Cantidad | Acción |
|-----------|----------|--------|
| Duplicados con gemelo que sí certificó | 807 | Borrado |
| Huérfanos viejos sin WP (+3 años) | 906 | Borrado |
| Huérfanos recientes sin WP | 64 | Borrado |
| Con usuario WP pero con gemelo que ya certificó | 455 | WP movido al gemelo → borrado |
| Sin gemelo, nunca certificaron (Grupo B) | ~252 | Borrado por el equipo |
| WP reales sin gemelo | 7 | Borrados junto con grupo B |

**Resultado fase 1:** 12.275 → ~10.500 registros. Todos los registros restantes tienen al menos un certificado.

### Fase 2 — Fusión de registros duplicados (misma finca)

Análisis de los 693 grupos con cédula duplicada entre registros con certificado:

| Categoría | Grupos | Criterio |
|-----------|--------|---------|
| MISMA_FINCA — copias exactas | 509 | Mismo nombre + dirección similar + ≤2 municipios |
| PROBABLE_MISMA — dirección parecida | 178 | Similitud dirección 0.2–0.5 |
| FINCA_DISTINTA — predios reales distintos | 67 | Dirección muy diferente |
| Multi-finca legítima (empresa) | 184 | Distintos nombres/municipios |

**Acción ejecutada sobre los 342 grupos MISMA_FINCA confirmados:**
- Certificados y usuario WP movidos al registro más antiguo (principal)
- Registros vacíos eliminados por el equipo en Airtable

**Archivos de análisis generados:**
- `docs/ubicaciones_sin_cert_analisis.csv` — clasificación de los 1.784 sin cert
- `docs/ubicaciones_gemelos_analisis.csv` — clasificación de los 750 pares duplicados
- `docs/revision_gemelos_probable.csv` — 178 casos PROBABLE_MISMA para revisión manual

### Fase 3 — Pendiente revisión manual

`docs/revision_gemelos_probable.csv` contiene **178 pares** que necesitan revisión humana.

**Instrucciones:**
Rellenar la columna `DECISION` con:
- `FUSIONAR` — misma finca, dirección escrita diferente → consolidar
- `CONSERVAR` — fincas distintas del mismo NIT → mantener ambos

Criterio sugerido:
- Mismo municipio + dirección parecida → FUSIONAR
- Municipios distintos → CONSERVAR
- Nombres de finca claramente distintos → CONSERVAR

Una vez devuelto el CSV con decisiones, se ejecuta la fusión automática.

---

## Estado actual tabla `ubicaciones`

- **~10.000 registros**, todos con al menos un certificado
- Duplicados claros eliminados
- 178 pares pendientes de revisión manual (PROBABLE_MISMA)
- 67 grupos FINCA_DISTINTA conservados (son fincas legítimas)
- Empresas multi-finca intactas (SUNSHINE BOUQUET 53 fincas, EL RETIRO 38 fincas, etc.)
