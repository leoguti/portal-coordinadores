# Certificados vía WhatsApp (Agricultor)

## Objetivo

Permitir que el agricultor cree su propio certificado de devolución de envases desde WhatsApp, haciendo el trabajo pesado de ingreso de datos. El coordinador solo revisa, ajusta cantidades si es necesario, y aprueba. La aprobación dispara la generación del PDF.

---

## Flujo completo

```
Agricultor (WhatsApp) → TextIt → Airtable (estado: Pendiente)
  → Coordinador (portal) → revisa / ajusta cantidades → aprueba
  → PDF generado → Email enviado
```

---

## Paso a paso en WhatsApp (TextIt)

### 1. Identificación del agricultor
- TextIt detecta el número de WhatsApp del agricultor
- Busca en tabla `ubicaciones` por campo `telefonousuario` (formato `573XXXXXXXXX`)
- **Conocido** → continúa al paso 2
- **Nuevo** → flujo de registro (crear registro en `ubicaciones` con: nombre, cédula, dirección, cultivo, municipio, teléfono, email, tipo) → luego continúa al paso 2

### 2. Selección de finca
- Busca todas las ubicaciones con ese `telefonousuario`
- **Una sola finca** → la selecciona automáticamente
- **Varias fincas** → muestra lista paginada (dirección + municipio) para que el agricultor elija
- Un mismo NIT puede tener múltiples fincas → siempre se debe seleccionar explícitamente
- **Opción "Agregar nueva finca"** → flujo de registro de nueva ubicación (nombre, cédula, dirección, cultivo, municipio, teléfono, email, tipo) → se crea en `ubicaciones` → continúa con esa finca

### 3. Ingreso de materiales (kg)
- Rígidos
- Flexibles
- Metálicos
- Embalaje
- (validación numérica en cada campo)

### 4. Datos de devolución
- Triple lavado: SI / NO / PENDIENTE
- Lugar de devolución (texto libre)
- Municipio de devolución (subflow "10-Municipio")
- Fecha de devolución (validaciones: no futura, no más de 120 días de antigüedad)
- Observaciones (texto libre, opcional)

### 5. Selección de coordinador
- Muestra **siempre** la lista completa de coordinadores con `Rol = "Coordinador"` en la tabla `Coordinadores`
- El agricultor elige su coordinador
- Nota: un mismo agricultor puede tener diferentes coordinadores en distintos certificados

### 6. Confirmación
- Muestra resumen completo de todos los datos ingresados
- Pregunta: "¿Confirmar y enviar para revisión?"
  - **Sí** → crea registro en Airtable con estado `Pendiente`
  - **No** → cancela

### 7. Creación del registro
- Llama a `POST /api/certificados/crear-pendiente`
- Se crea en Airtable con `estado: "Pendiente"`
- **No se genera PDF en este paso**
- El coordinador recibe notificación (por definir: email / WhatsApp / solo en portal)

---

## Flujo en el portal (Coordinador)

### Vista de certificados pendientes
- El coordinador ve una lista de certificados con `estado = "Pendiente"` asignados a él
- Muestra: agricultor, finca, fecha, materiales, municipio
- Puede abrir el detalle de cada uno

### Revisión y ajuste
- El coordinador puede modificar las cantidades (rígidos, flexibles, metálicos, embalaje)
- Los demás campos no son editables por el coordinador
- Puede agregar observaciones

### Aprobación
- Botón "Aprobar" → dispara generación del PDF
- Llama a la lógica existente de `generar` (react-pdf, Vercel Blob, adjuntar a Airtable, backup R2+Neon, email)
- El estado cambia a `Aprobado`

---

## Cambios requeridos en Airtable

### Tabla `Certificados`
- Agregar campo `estado` (Single Select): `Pendiente`, `Aprobado`
- Verificar si ya existe antes de crear

### Tabla `ubicaciones`
- Ya tiene `telefonousuario` en formato `57XXXXXXXXXX` ✅
- Ya tiene `movilgenerador` en formato `3XXXXXXXXX` (sin código país)
- Ya está vinculada a tabla `usuarios`

---

## Endpoints del portal requeridos

### Nuevo: `POST /api/certificados/crear-pendiente`
Crea el registro en Airtable **sin generar PDF**.

**Auth:** Bearer `CERTIFICADOS_API_KEY` (mismo que el endpoint generar)

**Body:**
```json
{
  "ubicacionId": "recXXXX",
  "coordinadorId": "recXXXX",
  "municipioDevolucionId": "recXXXX",
  "rigidos": 10,
  "flexibles": 5,
  "metalicos": 3,
  "embalaje": 2,
  "triplelavado": "SI",
  "lugardevolucion": "Bodega Municipal",
  "fechadevolucion": "2026-03-27",
  "observaciones": "texto opcional"
}
```

**Respuesta:**
```json
{
  "recordId": "recXXXX",
  "consecutivo": 12345,
  "status": "pendiente"
}
```

### Nuevo: `POST /api/certificados/[id]/aprobar`
Aprueba un certificado pendiente y genera el PDF.

**Auth:** Sesión NextAuth (coordinador autenticado)

**Lógica:**
1. Verifica que el certificado existe y está en estado `Pendiente`
2. Verifica que el coordinador logueado es el asignado al certificado
3. Aplica modificaciones de cantidades si las hay
4. Genera PDF (mismo flujo que `/api/certificados/generar`)
5. Actualiza estado a `Aprobado`
6. Retorna URL del PDF

### Nuevo: `GET /api/certificados/pendientes`
Lista certificados pendientes para el coordinador logueado.

---

## Endpoints existentes (referencia)

### `POST /api/certificados/generar`
- Crea en Airtable + genera PDF + sube a Blob + adjunta a Airtable + backup R2 + Neon + email
- Usado actualmente por TextIt (coordinador)
- Auth: Bearer `CERTIFICADOS_API_KEY`

---

## Datos de la tabla `ubicaciones` (campos relevantes)

| Campo | Descripción | Formato |
|-------|-------------|---------|
| `cedulagenerador` | NIT/cédula del agricultor | texto |
| `nombregenerador` | Nombre completo | texto |
| `movilgenerador` | Teléfono sin código país | `3XXXXXXXXX` |
| `telefonousuario` | Teléfono con código país (lookup) | `57XXXXXXXXX` |
| `emailgenerador` | Email | texto |
| `direcciongenerador` | Dirección de la finca | texto |
| `cultivogenerador` | Tipo de cultivo | texto |
| `municipiogenerador` | Municipio | texto |
| `tipogenerador` | Tipo (AGRICOLA, etc.) | texto |
| `CODIGOMUN` | Link a tabla Municipios | linked record |
| `Certificados` | Certificados de esta ubicación | linked records |
| `usuario` | Link a tabla usuarios | linked record |

---

## Datos de la tabla `Coordinadores` (campos relevantes)

| Campo | Descripción |
|-------|-------------|
| `Name` | Nombre del coordinador |
| `telefono` | Teléfono (formato: `316 7445619`) |
| `email` | Email |
| `Rol` | `Coordinador`, `Administrador`, `Supervisor`, `Desactivado` |

Para listar coordinadores activos: filtrar por `Rol = "Coordinador"`.

**No hay campo de zona/municipio/departamento** — la asignación coordinador-agricultor no es geográfica, la elige el agricultor en cada certificado.

---

## Pendientes por definir

- [ ] ¿Existe ya campo `estado` en tabla `Certificados` de Airtable? → verificar antes de crear
- [ ] ¿Cómo se notifica al coordinador cuando llega un certificado pendiente? (email / WhatsApp / solo portal)
- [ ] ¿El agricultor recibe confirmación por WhatsApp cuando el coordinador aprueba?
- [ ] Flujo de registro de agricultor nuevo (subflow a crear en TextIt)
- [ ] ¿Se necesita página pública de seguimiento de certificado para el agricultor?

---

## Estado del desarrollo

- [x] Endpoint `POST /api/certificados/generar` — completo, en producción
- [x] Template PDF `CertificadoPDF.tsx` — validado
- [ ] Campo `estado` en Airtable — por verificar/crear
- [ ] `POST /api/certificados/crear-pendiente` — por construir
- [ ] `GET /api/certificados/pendientes` — por construir
- [ ] `POST /api/certificados/[id]/aprobar` — por construir
- [ ] Vista portal coordinador — pendientes — por construir
- [ ] Flujo TextIt agricultor — por construir

---

*Documento creado: 2026-03-27*
