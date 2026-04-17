# Decisiones de Producto — 2026-04-15

## 1. Nueva estructura de datos: Generadores y Fincas

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
- Campo `revisado` (checkbox) + `revisado_por` (linked a Coordinadores)
- Orden de revisión: primero los problemáticos (sin municipio, NIT raro), luego el resto
- Al marcar revisado, los nuevos certificados apuntan a FINCAS (no a ubicaciones)

---

## 2. Validación de Terceros

### Campos obligatorios para un Tercero válido
- Nombre / Razón Social
- Cédula o NIT
- Municipio (selector, no texto libre)
- Dirección
- Teléfono
- Correo electrónico
- Tipo de persona (Natural / Jurídica)
- Documento de identidad según tipo:
  - Persona natural → cédula escaneada
  - Persona jurídica → certificado de cámara de comercio
- **RUT** (DIAN) — obligatorio para todos
- **Certificación bancaria** — obligatoria para realizar pagos

### Pendiente — planillas de seguridad social mensuales
- **Aplica solo a Personas Naturales** (independientes). Las Jurídicas no requieren planilla en nuestro sistema — tienen nómina propia.
- Cada mes el natural debe adjuntar su planilla de aportes a SS
- Mecánica distinta (no es un documento único; hay uno por mes)
- Pendiente definir:
  - Diseño: tabla nueva `PlanillasSS` con `tercero`, `mes` (YYYY-MM), `archivo`, `subido_por`, `monto`
  - ¿Se bloquea OS si no hay planilla del mes correspondiente o solo warning al inicio?
  - ¿Se valida el mes anterior al pago, o el mes de la OS?
  - Fase 1: la sube el coordinador responsable. Fase 4: la sube el propio tercero desde su portal.

### Validaciones técnicas
- **NIT empresas**: validar dígito verificador (algoritmo Colombia, sin costo)
- **Cédulas personas naturales**: no hay API pública gratuita en Colombia
  - Opciones de pago: Verifik (~$0.50–$2/consulta), Didit (tier gratuito para pruebas)
  - Por ahora: documento escaneado como respaldo obligatorio
- **RUES/RUIS**: consulta manual para empresas

### Bloqueo de operaciones
- No se puede crear Orden de Servicio ni gasto de Caja Menor si el Tercero no tiene todos los campos obligatorios completos
- Prioridad: "Value Security" — datos correctos antes de procesar pagos

---

## 3. Cajas Menores — Ampliación de campos

- Se acordó ampliar los campos de información registrados en Cajas Menores
- Campos específicos a definir con el equipo (pendiente)

---

## 4. IA para análisis de facturas

- Se propuso usar IA (Claude API) para extraer datos de facturas escaneadas
- Datos a extraer: proveedor, NIT, fecha, monto, concepto
- **Próximos pasos**:
  - Prueba piloto con facturas existentes en el sistema
  - Evaluar costo de API (Claude API: ~$3/millón tokens, económico)
  - Definir campos específicos a extraer
- **Pregunta pendiente**: ¿qué datos específicos se necesitan de cada factura?
