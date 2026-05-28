# Plan: Chatbot WhatsApp para certificados de agricultores (V2)

**Estado**: borrador para revisión.
**Reemplaza**: `docs/CERTIFICADOS_WHATSAPP.md` (escrito contra esquema legado `ubicaciones`).
**Esquema base**: `GENERADORES` + `FINCAS` (migración `a0635d9`).

---

## 1. Resumen ejecutivo

El agricultor escribe a un número WhatsApp conectado a TextIt. El flow lo identifica por su número en `FINCAS.movil`, le pide los datos del certificado y **el nombre del coordinador que lo atiende (dropdown)**. La solicitud se crea en Airtable con `estado = "pendiente"` (sin PDF todavía). El coordinador elegido recibe notificación, entra al portal en una vista nueva **"Certificados pendientes"** y **aprueba o rechaza**. Solo al aprobar se genera el PDF y se envían los emails. Si rechaza, el agricultor recibe la razón por WhatsApp.

---

## 2. Decisiones de diseño

### 2.1 ¿Aprobación de coordinador? **SÍ — Estado Pendiente + aprobación** ✅ DECIDIDO

El agricultor crea la solicitud por WhatsApp → entra en Airtable con `estado = "pendiente"` (sin PDF, sin email). El coordinador asignado:
- Recibe notificación (email + opcional WhatsApp) "tienes 1 solicitud pendiente".
- Entra al portal a `/certificados/pendientes` (vista nueva).
- Revisa datos, puede editar cantidades o devolver con motivo.
- Aprueba → SOLO ahí se genera el PDF y se envía email al agricultor + al coordinador.
- Rechaza con motivo → bot WhatsApp avisa al agricultor.

**Pro**: control total del coordinador sobre lo emitido, audita antes del PDF, detecta certs falsos.
**Contra a manejar**: el coordinador debe entrar al portal regularmente. Mitigación: notificaciones empujadas y dashboard con badge "X pendientes" en el sidebar.

### 2.2 ¿Qué coordinador queda asignado? **El agricultor lo elige en un dropdown** ✅ DECIDIDO

Aunque `FINCAS.coordinador_asignado` ya tiene la asignación por zona, el flujo le pide al agricultor que **confirme/elija** su coordinador de un dropdown:

- El bot llama `GET /api/coordinadores/activos` (lista todos los registros `Coordinadores` con `Rol === "Coordinador"`).
- TextIt muestra dropdown con nombres ordenados alfabéticamente.
- Si la finca ya tiene `coordinador_asignado`, ese aparece como **primera opción** (sugerencia) pero el agricultor puede elegir otro.
- El coordinador elegido es quien queda en `Certificados.coordinador` y quien debe aprobar.

**Razones de pedir confirmación aunque ya esté en sistema:**
1. La asignación en `FINCAS.coordinador_asignado` puede estar desactualizada.
2. Aumenta la trazabilidad: el agricultor "elige" conscientemente quién aprueba.
3. Si el agricultor elige distinto al asignado, sirve de pista para limpiar la asignación de zonas.

**Fallback** si la lista falla: env `WHATSAPP_FALLBACK_COORDINADOR_ID` apuntando a un registro `Coordinadores` llamado "Buzón WhatsApp".

### 2.3 Normalización del teléfono

- `lib/validacionesCO.ts::normalizarMovilCO` ya limpia +57, 57, espacios → 10 dígitos.
- Match en Airtable con `RIGHT(REGEX_REPLACE({movil}&'', '[^0-9]', ''), 10) = '<10dig>'` (no asumir que `{movil}` está limpio en datos legacy).
- ❓ **DECISIÓN PENDIENTE**: ¿match de fallback en `GENERADORES.movil` si `FINCAS.movil` no encuentra? Recomendado: sí, listando todas las fincas del generador.

### 2.4 ¿Qué hacer si la finca tiene datos incompletos?

`lib/completitudGenerador.ts` exige: nombre generador, NIT, tipopersona, tipo, dirección sede, nombre finca, municipio finca, ≥1 cultivo, ≥1 móvil.

Estrategia:
1. Llamar `/api/certificados/finca-info?fincaId=…` (ya devuelve `completitud.missing[]`).
2. Si `complete: false` → **NO** capturar campos por chat (UX horrible). Avisar al agricultor + escalar al coordinador con deep link.
3. Si `complete: true` → continuar con captura de datos del cert.

### 2.5 Endpoints nuevos (separados en CREAR-PENDIENTE / APROBAR / RECHAZAR)

**Cambio mayor**: el endpoint del bot ya no genera el PDF. Solo crea una solicitud `pendiente`. Endpoints separados:

1. `POST /api/certificados/whatsapp/pendiente` — crea registro en Airtable con `estado="pendiente"`. NO genera PDF. NO envía email.
2. `GET /api/certificados/pendientes` — lista para el coordinador en el portal (filtrada por su `coordinatorRecordId`).
3. `POST /api/certificados/[id]/aprobar` — toma el pendiente, lo marca `aprobado`, **genera el PDF** llamando internamente a `/api/certificados/generar` con los datos guardados, envía emails.
4. `POST /api/certificados/[id]/rechazar` — marca `rechazado` con `motivo_rechazo`, dispara notificación al agricultor por WhatsApp.

Razones para mantener `/api/certificados/generar` intacto: lo usa el portal directo (sin aprobación) y otros flows; no hay que tocarlo.

### 2.6 Identificación segura — V1 sin OTP, mitigaciones suficientes

1. Validación server-side `teléfonoNormalizado === finca.movilNormalizado` (o vía generador).
2. Pantalla de confirmación previa con datos: "Vas a generar para finca [X], generador [Y]…".
3. Notificación obligatoria al coordinador.
4. Campo `origen=whatsapp` permite auditoría por muestreo.

❓ **DECISIÓN PENDIENTE**: ¿OTP en V1 (+1 día) o lo dejamos para V2 si vemos abuso?

---

## 3. Flujo conversacional propuesto

### Flow `30-cert-agricultor` (TextIt)

```
[N0] Trigger: keyword "certificado" / "envases"
  ↓
[N1] Saludo + "te ayudo a generar tu certificado"
  ↓
[N2] Webhook GET /api/whatsapp/fincas-por-telefono?telefono=@contact.urn
       → { found, fincas:[{id,nombre,municipio,generador,completitud,coordinador}], viaGenerador }
  ↓
[Router] por @results.fincas_encontradas:
   ├ 0 → [N10] no-registrado
   ├ 1 completa → [N20] confirmación
   ├ 1 incompleta → [N21] escalar
   ├ N>1 → [N30] menú selección
   └ error red → [N99]
```

**Rama 0 fincas (no encontrado)**
```
[N10] "No encuentro tu número. Avisaré a un coordinador. ¿Cómo te llamas?"
[N11] wait → @results.nombre
[N12] POST /api/whatsapp/escalar-no-registrado { telefono, nombre }
[N13] "Gracias, te contactarán pronto."
[END]
```

**Rama 1 finca**
```
[N20] Si !completo → [N21]
       Si completo → [N22]
[N21] "Tu finca [N] tiene datos incompletos (falta: …). Aviso al coordinador."
       POST /api/whatsapp/escalar-incompleto
       [END]
[N22] "Vas a emitir certificado para [FINCA], generador [NOMBRE], NIT [Z]. ¿Confirmas? Sí/No"
[N23] wait → Sí: [N40] / No: END "Cancelado."
```

**Rama N>1 fincas**
```
[N30] List: "Tengo varias fincas con tu número. Elige una:
       1. Finca La Esperanza — Subachoque
       2. Finca El Roble — Funza
       ..."
[N31] wait → @results.finca_idx
[N32] set fincaId = fincas[idx-1].id → [N20 con esa fincaId]
```

**Captura de datos del cert (rama común)**
```
[N40] Fecha devolución (DD/MM/AAAA)            → validar ≤120 días, no futura
[N42] Kg rígidos                               → number
[N44] Kg flexibles                             → number
[N46] Kg metálicos                             → number
[N48] Kg embalaje                              → number
[N50] Subflow "10-Municipio"                   → municipio_devolucion_id
[N51] Lugar de devolución                      → text
[N53] Triple lavado (SI/NO/NO APLICA)          → enum
[N55] Observaciones (opcional, "no" si vacío)  → text
[N56] Webhook GET /api/coordinadores/activos   → lista para dropdown
[N56b] Send: "¿Cuál coordinador de CampoLimpio
       te atiende? Elige uno:
       1. Andrés Gómez (sugerido — atiende tu zona)
       2. Carolina Pérez
       3. Diego Rodríguez
       ..."
       quick_replies: numeradas
[N56c] wait → @results.coordinador_idx
       → set coordinadorId = lista[idx-1].id
[N57] Resumen + "¿Enviar solicitud? Sí/No
       Importante: tu coordinador [X] debe aprobarla
       antes de que se genere el PDF."
[N58] wait → Sí: [N59]
[N59] POST /api/certificados/whatsapp/pendiente
       { telefono, fincaId, coordinadorId, ... }
[N60] Router @webhook.status_code:
       200 → "✓ Solicitud enviada a tu coordinador [X].
              Te avisaré cuando esté aprobada (suele tomar
              menos de 24h en horario laboral).
              Número de solicitud: #@webhook.json.solicitudId"
       403/422 → mensaje específico
       otro → [N99]
[END]
```

**Notificación al agricultor cuando el coord aprueba/rechaza** (NUEVO):
- Al aprobar en el portal, el endpoint `/aprobar` llama al API de TextIt para enviar un mensaje fuera de flow (`POST https://api.textit.com/api/v2/broadcasts.json`):
  - "✓ Tu certificado #1234 fue aprobado. Te llegó al email. PDF: [URL]"
- Al rechazar:
  - "✗ Tu solicitud #1234 fue rechazada. Motivo: [texto del coordinador]. Contacta a tu coordinador para más info."

**Errores**
```
[N99] "Problema técnico. Intenta luego o contacta a tu coordinador."
```

**Timeout/abandono**: `expire_after_minutes: 720` (12h). No persistir parciales en Airtable.

---

## 4. Mapeo campo PDF ↔ pregunta del bot

| Campo | Pregunta | Validación | Default |
|---|---|---|---|
| `fincaId` | (selección lista) | record id | — |
| Generador/finca/cultivos/municipio/email/etc. | auto desde finca | — | — |
| `fechadevolucion` | "Fecha DD/MM/AAAA" | has_date, ≤120d, no futura | hoy si "hoy" |
| `rigidos` | "Kg rígidos" | number ≥ 0 | 0 |
| `flexibles` | "Kg flexibles" | number ≥ 0 | 0 |
| `metalicos` | "Kg metálicos" | number ≥ 0 | 0 |
| `embalaje` | "Kg embalaje" | number ≥ 0 | 0 |
| total | servidor | > 0 | — |
| `municipioDevolucionId` | Subflow Municipio | record id | — |
| `lugardevolucion` | "Lugar devolución" | texto ≥3 | — |
| `triplelavado` | "SI/NO/PENDIENTE" | enum | PENDIENTE |
| `observaciones` | "Observaciones (opc.)" | ≤500 | "" |
| `coordinador` | rollup `coordinador_id` finca | id válido | env `WHATSAPP_FALLBACK_COORDINADOR_ID` |
| `origen` (campo nuevo) | auto | — | "whatsapp" |

---

## 5. APIs

### 5.1 Reutilizadas tal cual

- `POST /api/certificados/generar` (file `app/api/certificados/generar/route.ts`) — sin cambios. Bearer `CERTIFICADOS_API_KEY`.
- `lib/fincaGeneradorResolver.ts` — sin cambios.
- `lib/validacionesCO.ts::normalizarMovilCO`, `esMovilCOValido` — sin cambios.

### 5.2 Adaptaciones

- `GET /api/certificados/finca-info` — aceptar bearer (`WHATSAPP_BOT_API_KEY`) además de sesión NextAuth. Cambio pequeño en línea 41-43.
- `POST /api/certificados/generar` — aceptar parámetro `origen` (1 línea, `body.origen || "portal"`).

### 5.3 Nuevos endpoints

#### A. `GET /api/whatsapp/fincas-por-telefono?telefono=…`
Auth: `Bearer ${WHATSAPP_BOT_API_KEY}`.

Respuesta 200:
```json
{
  "telefonoNormalizado": "3001234567",
  "fincas": [{ "id":"rec…", "nombre":"…", "municipio":"…", "generador":{...}, "completitud":{...}, "coordinador":{...} }],
  "viaGenerador": false
}
```

#### B. `GET /api/coordinadores/activos?fincaId=…`
Auth: `Bearer ${WHATSAPP_BOT_API_KEY}`. Lista coordinadores activos (`Rol === "Coordinador"`) ordenados alfabéticamente. Si `fincaId` viene, marca al asignado como `sugerido: true` y lo pone primero.

```json
{
  "coordinadores": [
    { "id":"recCOOR1", "nombre":"Andrés Gómez", "sugerido": true },
    { "id":"recCOOR2", "nombre":"Carolina Pérez", "sugerido": false }
  ]
}
```

#### C. `POST /api/certificados/whatsapp/pendiente` (CREAR PENDIENTE)
Auth: `Bearer ${WHATSAPP_BOT_API_KEY}`.

Body:
```json
{
  "telefonoAgricultor":"+573001234567",
  "fincaId":"recXXX",
  "coordinadorId":"recCOORDQUE_AGRICULTOR_ELIGIO",
  "municipioDevolucionId":"recYYY",
  "rigidos":10, "flexibles":5, "metalicos":0, "embalaje":2,
  "triplelavado":"SI",
  "lugardevolucion":"Bodega Municipal",
  "fechadevolucion":"2026-05-15",
  "observaciones":""
}
```

Lógica:
1. Bearer check + normalizar teléfono.
2. Validar match teléfono↔finca (anti-spoofing) — `RIGHT(REGEX_REPLACE(movil),10) === telNorm`.
3. Validar coordinadorId existe en `Coordinadores` con `Rol === "Coordinador"`.
4. `evaluarCompletitud` del generador+finca; si incompleto → 422 con `missing[]`.
5. Validar fecha (≤120d, no futura) y total > 0.
6. **Crear registro en `Certificados`** con TODOS los datos + `estado="pendiente"` + `solicitud_origen="whatsapp"` + `fecha_solicitud=now` + `coordinador=[coordinadorId]` + `FINCAS=[fincaId]`. **NO** asigna consecutivo todavía. **NO** genera PDF.
7. Notificar al coordinador (email + opcional WhatsApp) con link a `/certificados/pendientes`.
8. Devolver `{ solicitudId, estado:"pendiente", coordinador:{id,nombre} }`.

#### D. `GET /api/certificados/pendientes`
Auth: sesión NextAuth. Lista certificados con `estado="pendiente"` donde `coordinador === session.coordinatorRecordId` (o todos si admin). Incluye datos completos para revisar sin más llamadas.

#### E. `POST /api/certificados/[id]/aprobar` (APROBAR)
Auth: sesión NextAuth. Verifica ownership: `coordinador === session.coordinatorRecordId` o admin.

Body opcional (para edición previa por el coord):
```json
{ "rigidos": 10, "flexibles": 5, "triplelavado": "SI", "lugardevolucion": "...", ... }
```

Lógica:
1. Leer el pendiente.
2. Si llegan campos, actualizar antes de aprobar (el coord editó cantidades).
3. Asignar `consecutivo` (siguiente del autonumber).
4. Llamar a la lógica de `/api/certificados/generar` (refactorizar como función pura `generarPDFCertificado(...)` para no pasar por la auth de su endpoint) → PDF Blob R2 Neon emails.
5. Marcar `estado="aprobado"`, `fecha_aprobacion=now`, `aprobado_por=coordinator`.
6. Disparar mensaje TextIt al agricultor: "✓ Cert #1234 aprobado, PDF: [url]".
7. Devolver `{ consecutivo, pdfUrl, estado:"aprobado" }`.

#### F. `POST /api/certificados/[id]/rechazar` (RECHAZAR)
Auth: sesión NextAuth. Verifica ownership.

Body:
```json
{ "motivo": "Las cantidades no coinciden con lo entregado en la bodega" }
```

Lógica:
1. Validar motivo no vacío (>10 chars).
2. Marcar `estado="rechazado"`, `motivo_rechazo=motivo`, `fecha_rechazo=now`, `rechazado_por=coordinator`.
3. Disparar mensaje TextIt al agricultor con el motivo.
4. Devolver `{ estado:"rechazado", motivo }`.

#### G. `POST /api/whatsapp/escalar-no-registrado` { telefono, nombre? }
Envía email a admin. (Sin cambios.)

#### H. `POST /api/whatsapp/escalar-incompleto` { telefono, fincaId, missing[] }
Notifica al coordinador del rollup. (Sin cambios.)

---

## 6. Cambios en Airtable

**Campos nuevos en `Certificados` (necesarios para el flujo de aprobación):**

1. **`estado`** (Single Select): valores `pendiente | aprobado | rechazado | anulado`. **OBLIGATORIO** — sin esto no hay flujo. Default `aprobado` para certs viejos del portal (no requirieron aprobación).
2. **`solicitud_origen`** (Single Select): `portal | whatsapp | telegram`. Indica de dónde vino la solicitud.
3. **`fecha_solicitud`** (Date with time): cuándo el agricultor envió la solicitud por WhatsApp. NULL para certs creados directos desde el portal.
4. **`fecha_aprobacion`** (Date with time): cuándo el coordinador aprobó.
5. **`motivo_rechazo`** (Long text): si fue rechazado, motivo que el coord escribió.
6. **`fecha_rechazo`** (Date with time): cuándo fue rechazado.
7. **`aprobado_por`** (Link to Coordinadores) y **`rechazado_por`** (Link to Coordinadores): para trazabilidad. Puede ser distinto al `coordinador` asignado si un admin actuó.

**Otros:**

8. **Rollup `FINCAS.coordinador_id`** — ya existe (línea 104 de `/api/revisiones/fincas`).
9. **Registro `Coordinadores → "Buzón WhatsApp"`** (Rol Administrador) para fallback. Guardar id en env `WHATSAPP_FALLBACK_COORDINADOR_ID`.
10. **Campo `Coordinadores.activo_whatsapp`** (checkbox, opcional). Si un coord no quiere recibir WhatsApp del bot, lo desmarca. Lista de dropdown filtra por este. Si no se crea, default true para todos.

---

## 7. Estructura del flow en TextIt

**Flow principal**: `30-cert-agricultor`.
**Subflows reutilizados**: `10-Municipio`.

**Globals nuevos**:
- `@globals.portal_base` = `https://portal.campolimpio.org`
- `@globals.whatsapp_api_key` = bearer del bot.

**Variables del flow** (`@results.*`): `fincas_resp`, `fincas_encontradas`, `fincaId`, `fincaNombre`, `nombreGenerador`, `nitGenerador`, `coordinadorNombre`, `completitud_complete`, `fechadevolucion`, `rigidos`, `flexibles`, `metalicos`, `embalaje`, `triplelavado`, `lugardevolucion`, `observaciones`, `municipio_devolucion_id`, `cert_consecutivo`, `cert_pdf_url`.

**Timeouts**: `expire_after_minutes: 720` en el flow + timeout corto por cada wait con default → END "Tiempo agotado".

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| `FINCAS.movil` sucio en data legacy | Alta | Alto | `REGEX_REPLACE` + `RIGHT(_,10)`. Cron limpieza opcional. |
| Número compartido entre fincas | Media | Bajo | Menú "elige finca". |
| Agricultor con número viejo escalado eternamente | Media | Medio | Email a admin en /escalar-no-registrado, SLA 24h. |
| TextIt manda teléfono con `whatsapp:` prefix u otros | Alta | Bajo | Normalización servidor. |
| Finca sin `coordinador_asignado` | Media | Medio | Fallback `WHATSAPP_FALLBACK_COORDINADOR_ID` + observación en cert. |
| Certificados falsos en serie | Baja | Alto (auditoría) | Notif. coordinador + filtro `origen=whatsapp` para revisión. OTP en V2 si crece. |
| Doble envío | Media | Medio | Confirmación final SÍ/NO. Idempotencia por hash 60s si crece. |
| `/generar` >30s vs TextIt timeout 30s | Media | Alto | Configurar 60s en TextIt. Si insuficiente: endpoint responde "encolado" y dispara PDF con `after()`. |
| Spam al webhook | Baja | Medio | Rate limit por bearer + IP. |

---

## 9. Plan de pruebas

**Fase 1 — Telegram dev (sandbox)**

Crear 2 fincas de prueba:
- `FINCA_TEST_A`: completa, móvil `3001234501`, coordinador asignado.
- `FINCA_TEST_B`: incompleta (sin municipio), móvil `3001234502`.

Casos:
- C1: happy path → cert generado. Verificar Airtable + Neon + email.
- C2: finca incompleta → bot escala al coord.
- C3: número no registrado → escala a admin.
- C4: mismo número en 2 fincas → menú.
- C5: fecha futura → re-pide.
- C6: fecha hace 200 días → re-pide.
- C7: total = 0 → rechaza server-side.
- C8: abandono a la mitad + retomar 3h después → reinicia.
- C9: 500 forzado → mensaje genérico.
- C10: anti-spoof (hardcodear fincaId ajeno en TextIt) → 403.

**Fase 2 — WhatsApp Business staging**

Conectar canal WhatsApp staging. Repetir C1, C2, C3, C7 con 3-5 fincas piloto. Verificar formato real del teléfono entrante.

**Fase 3 — Producción gradual**

1 coordinador / 10 fincas primera semana. Métricas en dashboard. Iterar mensajes según feedback.

---

## 10. Orden de implementación

### Sprint 1 — Airtable + refactor backend (PREPARACIÓN)
- T1. **Airtable**: crear campos `estado`, `solicitud_origen`, `fecha_solicitud`, `fecha_aprobacion`, `motivo_rechazo`, `fecha_rechazo`, `aprobado_por`, `rechazado_por` en `Certificados`.
- T2. **Migración**: PATCH masivo de todos los certs existentes → `estado="aprobado"`, `solicitud_origen="portal"`.
- T3. **Registro `Buzón WhatsApp`** en Coordinadores. Env `WHATSAPP_FALLBACK_COORDINADOR_ID`.
- T4. **Refactor**: extraer la lógica de `/api/certificados/generar` a función pura `generarPDFCertificado(...)` en `lib/certificadosCore.ts` para poder llamarla desde `/aprobar` sin pasar por el endpoint.

### Sprint 2 — Endpoints backend (paralelo, después de Sprint 1)
- T5. `GET /api/whatsapp/fincas-por-telefono` + `lib/whatsappResolver.ts`.
- T6. `GET /api/coordinadores/activos`.
- T7. `POST /api/certificados/whatsapp/pendiente` (crear PENDIENTE).
- T8. `POST /api/certificados/[id]/aprobar` (aprobar — genera PDF, llama a `generarPDFCertificado`).
- T9. `POST /api/certificados/[id]/rechazar`.
- T10. `GET /api/certificados/pendientes`.
- T11. `POST /api/whatsapp/escalar-no-registrado` + `/escalar-incompleto`.

### Sprint 3 — Vista del coordinador en portal
- T12. Página `/certificados/pendientes` con lista + detalle inline + botones "Aprobar" / "Rechazar".
- T13. Modal de rechazo con campo motivo (>10 chars).
- T14. Inline edit de cantidades antes de aprobar.
- T15. Badge "X pendientes" en el sidebar (notificación visual).
- T16. Email al coordinador cuando llega un pendiente nuevo (con link al portal).

### Sprint 4 — TextIt flow
- T17. Diseñar `30-cert-agricultor`.
- T18. Globals `@globals.whatsapp_api_key`, `@globals.portal_base`, `@globals.textit_api_key`.
- T19. Pruebas C1-C10 en Telegram.
- T20. Endpoint `lib/textitNotify.ts`: helper para mandar mensajes fuera de flow (lo usan `/aprobar` y `/rechazar`).

### Sprint 5 — Notificaciones + rollout
- T21. Notificación al agricultor cuando se aprueba/rechaza (TextIt broadcast).
- T22. Dashboard coordinador: "X aprobados / Y pendientes / Z rechazados esta semana".
- T23. Canal WhatsApp Business productivo + rollout gradual (1 coord / 10 fincas).
- T24. Doc para coordinadores: cómo aprobar/rechazar/anular.

**Dependencias críticas**:
- T7 (crear pendiente) y T8 (aprobar) ambos dependen de T1 (campos Airtable).
- T8 depende de T4 (refactor).
- T17 (flow) depende de T5-T7 (endpoints).
- T21 depende de T20.

---

## 11. Decisiones (estado actualizado tras revisión del usuario)

✅ **DEC 1 — Aprobación obligatoria**: el certificado se crea como `pendiente`. El coordinador debe aprobarlo desde el portal antes de que se genere el PDF.

✅ **DEC 2 — Coordinador por dropdown**: aunque la finca tenga `coordinador_asignado`, el agricultor SIEMPRE elige de un dropdown. El sistema sugiere el asignado como primera opción.

❓ **DEC 3 — Notificación al coordinador de un pendiente nuevo**: ¿solo email, o también WhatsApp template? Recomendado: email V1 (simple, ya funciona). WhatsApp V2 si los coordinadores reportan que se les pasa.

❓ **DEC 4 — Edición del cert por el coordinador antes de aprobar**: ¿puede editar cantidades / lugar / fecha antes de aprobar? Recomendado: SÍ, en la vista de pendientes. Sin esto, si el agricultor escribe mal una cifra, hay que rechazar y pedir nueva solicitud.

❓ **DEC 5 — Fallback match en `GENERADORES.movil` cuando `FINCAS.movil` falla**: Recomendado: SÍ, listando todas las fincas del generador.

❓ **DEC 6 — OTP en V1 o V2**: Con aprobación obligatoria, el riesgo de spoofing baja mucho (el coord humano filtra). Recomendado: SIN OTP en V1.

❓ **DEC 7 — Anular un certificado ya aprobado**: si el coord aprobó y luego se da cuenta de error, ¿puede anularlo? Recomendado: SÍ (`estado="anulado"`), revierte el consecutivo NO (queda con hueco para auditoría) y notifica al agricultor.

❓ **DEC 8 — Permitir que el agricultor cree finca nueva desde el bot**: Recomendado: NO en V1. Escalar a coord para que la cree en el portal.

❓ **DEC 9 — Default de `estado` en certificados viejos**: hay miles de certs ya emitidos desde el portal sin estado. ¿Marcamos todos como `aprobado` en migración? Recomendado: SÍ (un PATCH masivo Airtable con `estado="aprobado"` para los que no tengan el campo).

---

**Archivos críticos para implementación**:
- `app/api/certificados/generar/route.ts`
- `app/api/certificados/finca-info/route.ts`
- `lib/fincaGeneradorResolver.ts`
- `lib/completitudGenerador.ts`
- `lib/validacionesCO.ts`
- `memory/project_textit_flows.md` (para patrón flow)
- `docs/FLUJO_CERTIFICADOS_V3.md` (referencia coord)
