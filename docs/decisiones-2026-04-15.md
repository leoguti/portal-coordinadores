# Decisiones de Producto — 2026-04-15

Última actualización: 2026-04-18

## 1. Nueva estructura de datos: Generadores y Fincas ✅ (implementado)

Se aprobó migrar la tabla `ubicaciones` (legacy) a una nueva estructura normalizada:

### Tablas nuevas en Airtable
- **GENERADORES** — identidad legal del productor (NIT, nombre, tipo, sede, contacto)
- **FINCAS** — cada ubicación física (dirección, cultivos, municipio, contacto de finca)
- **CULTIVOS** — catálogo de 66 cultivos limpios (reemplaza texto libre)

### Principios
- Un GENERADOR puede tener múltiples FINCAS
- Cada FINCA puede tener múltiples cultivos (linked record)
- La tabla `ubicaciones` se conserva como histórico — no se elimina
- Campo `finca` en `ubicaciones` enlaza cada registro viejo con su FINCA nueva
- Municipio siempre como linked record a MUNICIPIOS (no texto libre)

### Estado actual (implementado)
- ✅ Migración ubicaciones → GENERADORES + FINCAS + CULTIVOS
- ✅ Dedup de generadores por NIT (1487 fusionados, 0 duplicados restantes)
- ✅ Interfaz jerárquica `/revisiones/fincas` (generador → fincas anidadas)
- ✅ Merge de fincas duplicadas + eliminar con reasignación de ubicaciones
- ✅ Botón "+ Agregar finca" con búsqueda o creación inline de generador
- ✅ Filtros: Pendientes, Incompletos, ≥2 fincas, Duplicados, Todos, Revisadas
- ✅ Campo `coordinador_asignado` en FINCAS (asignación manual, independiente del rollup de certificados)
- ✅ Botón "Esta finca no es mía" → mueve a otro coordinador sin tocar certificados
- ✅ Campo lookup `coordinador_id` en FINCAS para filtrar por ID (workaround al bug de Airtable linked fields en fórmulas)

### Lecciones aprendidas (importantes)
- Airtable resuelve `multipleRecordLinks` en fórmulas al **campo primario** del registro enlazado, NO al ID. `FIND('recXXX', ARRAYJOIN({linkedField}, ','))` nunca matchea.
- Workaround: crear campo formula o lookup que exponga `RECORD_ID()` como texto, filtrar contra ese.
- El Metadata API **no permite crear** campos de tipo `formula`, `multipleLookupValues`, `createdTime`, `multipleCollaborators`. Hay que crearlos manualmente en la UI de Airtable.

---

## 2. Validación de Terceros — Plan por Fases

### Fase 0 ✅ (en producción)
Campos obligatorios para un Tercero válido:
- Nombre / Razón Social
- Cédula o NIT
- Municipio (selector linked, no texto libre)
- Dirección
- Teléfono
- Correo electrónico
- Tipo de persona (Natural / Jurídica)
- Documento de identidad según tipo:
  - Natural → cédula escaneada
  - Jurídica → certificado de cámara de comercio
- **RUT** (DIAN) — obligatorio para todos
- **Certificación bancaria** — obligatoria para pagos

Validación técnica:
- **NIT jurídicas**: dígito verificador DIAN (algoritmo local sin costo, `lib/nit.ts`)
- **Cédulas naturales**: no hay API pública gratuita en Colombia. Opciones de pago disponibles: Verifik, Didit. Por ahora: documento escaneado como respaldo obligatorio

Bloqueo de operaciones:
- **Orden de Servicio**: bloqueo duro (server-side) si el tercero está incompleto
- **Caja Menor**: warning (no bloquea, solo avisa con lista de faltantes y link a completar)

Limpieza: campo `Tipo` (clasificación descriptiva con valores Centro de Acopio / Transportador / Gestor / etc.) eliminado por no tener uso real en el código.

Implementación: `lib/nit.ts`, `lib/terceros.ts`, `/terceros`, `/terceros/[id]`, `components/TerceroCompletitudWarning.tsx`, bloqueo en `createOrdenServicio`.

---

### Fase 1 ✅ (en producción) — Dueño del tercero

Cada tercero tiene un **coordinador_responsable** que lo mantiene al día.

- Campo `coordinador_responsable` en Terceros (multipleRecordLinks → Coordinadores)
- Campo lookup `coordinador_responsable_id` (expone el RECORD_ID para filtrar)
- Script backfill `scripts/asignar-coordinador-tercero.js`: asigna al coordinador con más Órdenes de Servicio con ese tercero. 38/218 asignados inicialmente (el resto sin OS previas, quedan sin asignar)
- **Auto-asignación** al crear OS: si el tercero no tiene `coordinador_responsable`, se asigna automáticamente al coordinador que crea la orden (cierra el gap para los 180 inicialmente sin OS)
- API: filtra `/api/terceros?all=true` por `coordinador_responsable_id` (coordinador ve solo los suyos, admin ve todo)
- UI: botón "Reasignar a otro coordinador" en `/terceros/[id]`
- Sidebar: "Terceros" ahora visible para rol Coordinador (antes solo admin)

Filtros adicionales en `/terceros`:
- **Uso**: Con OS (default admin) / Con Caja Menor / En uso / Sin uso / Todos
- **Completitud**: Incompletos (default) / Completos / Todos
- Badges en cada fila: `N OS` (azul), `N CM` (morado)

---

### Fase 2 ✅ (en producción) — Planillas de Seguridad Social mensuales

**Aplica solo a Personas Naturales** (independientes). Las Jurídicas no requieren — manejan nómina propia.

Schema:
- Tabla nueva `PlanillasSS`: `tercero` (link), `mes_periodo` (YYYY-MM), `archivo` (attachment PDF), `subido_por` (link Coordinadores), `monto_aportado` (currency opcional), `fecha_subida` (date)

API:
- `GET /api/planillas-ss?terceroId=xxx` — lista ordenada por mes desc
- `POST /api/planillas-ss` — crea registro (archivo se sube después vía `/api/upload`)
- `DELETE /api/planillas-ss/[id]`
- `GET /api/terceros/[id]?mesPlanilla=YYYY-MM` — chequea si hay planilla válida del mes (extensión del endpoint existente)

UI:
- En `/terceros/[id]`, si `tipo_persona === "Natural"`: bloque "Planillas de Seguridad Social" con selector de mes (últimos 12), monto opcional, subida/reemplazo/borrado de PDF por fila
- `TerceroCompletitudWarning` acepta prop `fechaReferencia` y muestra banner si falta planilla del mes
- `PasoBeneficiario` del wizard de OS pasa `fechaPedido` al warning

**Bloqueo (duro)**: `createOrdenServicio` rechaza la OS si el beneficiario es Natural y no tiene planilla con archivo PDF para el mes de la `Fecha de pedido` (proxy del mes del pago).

**Decisión confirmada**: mes de pago = mes de la `Fecha de pedido` de la OS.

---

### Fase 3 ⏳ — Vencimientos de documentos

Los documentos no son eternos. Propuesta aprobada:

- Agregar campo `fecha_emision` al lado de cada documento (RUT, cámara comercio, certificación bancaria)
- Alerta automática si el documento tiene más de X días (configurable por tipo):
  - Cámara de comercio: ~30-90 días
  - Certificación bancaria: ~30 días
  - RUT: cuando cambia algo
- Lista "vencidos / por vencer" en `/terceros`

**Pendiente decidir**: ¿bloqueo OS si doc vencido, solo warning, o solo bloquear después de un umbral alto (ej: >120 días)?

---

### Fase 4 ⏳ — Portal público para terceros

Cuando las Fases 1-3 estén estables:

- Login separado por email del tercero (OTP)
- Acceso solo a su propio registro
- Puede actualizar datos + subir planillas SS mensuales
- Coordinador deja de subir, solo revisa
- Reduce drásticamente carga operativa del coordinador

**Pendientes**:
- ¿Cómo se comunica/transmite la información a los terceros antes del lanzamiento?
- ¿Qué tipo de capacitación/tutorial se necesita?

---

### Fase 5 ⏳ — Dashboards y alertas

- % de terceros completos por coordinador
- Terceros sin responsable asignado
- Planillas SS al día vs atrasadas
- Documentos por vencer
- Actividad reciente (OS por tercero)
- Alertas email/WhatsApp al coordinador responsable cuando algo falta

---

### Orden actual
**Fase 0 ✅ → Fase 1 ✅ → Fase 2 ✅ → Fase 3 ⏳ → Fase 4 ⏳ → Fase 5 ⏳**

---

## 3. Cajas Menores — Ampliación de campos ⏳

- Se acordó ampliar los campos de información registrados
- Campos específicos a definir con el equipo (pendiente)

---

## 4. IA para análisis de facturas ⏳

- Usar Claude API para extraer datos de facturas escaneadas
- Datos a extraer: proveedor, NIT, fecha, monto, concepto
- **Próximos pasos**:
  - Prueba piloto con facturas existentes
  - Evaluar costo de API (~$3/millón tokens, económico)
  - Definir campos específicos a extraer
- **Pregunta pendiente**: ¿qué datos específicos se necesitan de cada factura?

---

## Scripts de mantenimiento creados

En `scripts/`:
- `migrar-fincas.js` — migra ubicaciones → GENERADORES + FINCAS (one-shot, ejecutado)
- `fusionar-generadores-duplicados.js` — dedup por prefijo NIT (ejecutado: 1487 fusionados)
- `asignar-coordinador-finca.js` — backfill coordinador_asignado por finca según certificados (ejecutado: 4269 asignados)
- `asignar-coordinador-tercero.js` — backfill coordinador_responsable por tercero según OS (ejecutado: 38 asignados)

Todos con `--dry` para preview antes de aplicar.
