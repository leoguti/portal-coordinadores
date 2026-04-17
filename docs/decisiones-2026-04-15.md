# Decisiones de Producto — 2026-04-15

Última actualización: 2026-04-17

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

### Flujo de revisión
- Script automático migra ubicaciones → GENERADORES + FINCAS
- Cada coordinador revisa y verifica sus propias fincas en el portal
- Por cada FINCA: verificar NIT, municipio, cultivos y datos
- Campo `revisado` + `revisado_por` (linked a Coordinadores)
- Orden de revisión: problemáticos primero, luego el resto
- Jerarquía en UI: cabecera generador → fincas anidadas (acordeón)
- Merge de duplicados por NIT (fincas y generadores)
- Campo `coordinador_asignado` en FINCAS para asignación manual independiente de los certificados (ya en producción)

---

## 2. Validación de Terceros — Plan por Fases

### Fase 0 ✅ (ya en producción)
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
- **NIT jurídicas**: dígito verificador DIAN (algoritmo local sin costo)
- **Cédulas naturales**: no hay API pública gratuita en Colombia. Opciones de pago disponibles: Verifik, Didit. Por ahora: documento escaneado como respaldo obligatorio

Bloqueo de operaciones:
- **Orden de Servicio**: bloqueo duro (server-side) si el tercero está incompleto
- **Caja Menor**: warning (no bloquea, solo avisa con lista de faltantes y link a completar)

Implementación: `lib/nit.ts`, `lib/terceros.ts`, `/terceros`, `/terceros/[id]`, `components/TerceroCompletitudWarning.tsx`, bloqueo en `createOrdenServicio`.

---

### Fase 1 — Dueño del tercero (próximo)
Cada tercero tiene un **coordinador_responsable** que lo mantiene al día.

- Campo nuevo `coordinador_responsable` en Terceros (link a Coordinadores)
- Script backfill: coordinador que más OS ha hecho con ese tercero (patrón aplicado a FINCAS)
- UI en `/terceros`: filtro "mis terceros" vs "todos" (admins ven todo)
- Botón "Reasignar a otro coordinador" como en fincas

Estimado: ~1 día.

---

### Fase 2 — Planillas de seguridad social mensuales

**Aplica solo a Personas Naturales** (independientes). Las Jurídicas no requieren — manejan nómina propia.

- Tabla nueva `PlanillasSS` en Airtable: `tercero` (link), `mes` (YYYY-MM), `archivo` (attachment), `subido_por` (link coordinador), `fecha_subida`, `monto_aportado`
- UI: por cada tercero natural, calendario de planillas subidas vs pendientes
- Validación: **se verifica contra el mes del pago** (no mes de la OS)
- Quién sube: coordinador responsable (Fase 1). En Fase 4 lo hará el propio tercero.

**Pendiente decidir:** ¿bloqueo duro o solo warning al inicio, mientras el equipo se pone al día?

---

### Fase 3 — Vencimientos de documentos (después de Fase 2)

Los documentos no son eternos. Propuesta aprobada:

- Agregar campo `fecha_emision` al lado de cada documento (RUT, cámara comercio, certificación bancaria)
- Alerta automática si el documento tiene más de X días (configurable por tipo):
  - Cámara de comercio: ~30-90 días
  - Certificación bancaria: ~30 días
  - RUT: cuando cambia algo
- Lista "vencidos / por vencer" en `/terceros`

---

### Fase 4 — Portal público para terceros (postergado)

Cuando las Fases 1-3 estén estables y funcionando:

- Login separado por email del tercero (OTP)
- Acceso solo a su propio registro
- Puede actualizar datos + subir planillas SS mensuales
- Coordinador deja de subir, solo revisa
- Reduce drásticamente carga operativa del coordinador

---

### Fase 5 — Dashboards y alertas

- % de terceros completos por coordinador
- Planillas SS al día vs atrasadas
- Documentos por vencer
- Alertas email/WhatsApp al coordinador responsable cuando algo falta

---

### Orden confirmado
**Fase 0 ✅ → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5**

### Preguntas pendientes
- Fase 2: ¿bloqueo o warning si no hay planilla del mes del pago?
- Fase 4: ¿cómo se transmite la info/instrucciones a los terceros antes del lanzamiento?
- Fase 4: ¿qué tipo de capacitación/tutorial se necesita?

---

## 3. Cajas Menores — Ampliación de campos

- Se acordó ampliar los campos de información registrados
- Campos específicos a definir con el equipo (pendiente)

---

## 4. IA para análisis de facturas

- Usar Claude API para extraer datos de facturas escaneadas
- Datos a extraer: proveedor, NIT, fecha, monto, concepto
- **Próximos pasos**:
  - Prueba piloto con facturas existentes
  - Evaluar costo de API (~$3/millón tokens, económico)
  - Definir campos específicos a extraer
- **Pregunta pendiente**: ¿qué datos específicos se necesitan de cada factura?
