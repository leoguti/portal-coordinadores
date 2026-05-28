# Plan: Certificados con WhatsApp + Web responsive (V4)

**Estado**: definitivo, listo para implementar.
**Reemplaza**: V1 (`docs/CERTIFICADOS_WHATSAPP.md`) y V2/V3 archivado (`docs/_archive_PLAN_CERTIFICADOS_WHATSAPP_V2.md`).
**Decisión arquitectónica clave**: WhatsApp solo identifica y notifica; **la captura de datos siempre va por web responsive vía magic-link**. La aprobación del coordinador se mantiene.
**Esquema base**: `GENERADORES` + `FINCAS` (la tabla `ubicaciones` se borra).

---

## 1. Resumen ejecutivo

El agricultor llega al bot de dos maneras:
1. **Escaneando un QR** (en bodegas, sedes, postales) que abre WhatsApp con un texto pre-rellenado.
2. **Escribiendo cualquier mensaje** al número del bot (catchall — no exigimos palabra clave específica).

El bot lo identifica por su teléfono y le muestra un **menú adaptado** según su estado (conocido con fincas / conocido sin finca / desconocido). El agricultor elige una opción y recibe un **link mágico al portal**. Ese link abre un formulario responsive ya pre-cargado con sus datos, donde el agricultor:

- **Crea un certificado** (caso principal).
- **Edita información** de su generador / finca.
- **Solicita crear una finca nueva** (vinculada a su generador).
- **Se registra como generador nuevo** (si no estaba).

Todo lo que el agricultor envía entra al portal con `estado="pendiente"`. El **coordinador** revisa en `/certificados/pendientes` y **aprueba o rechaza**. Al aprobar el certificado se genera el PDF y se le manda al agricultor por email + WhatsApp con el link de descarga.

**Por qué híbrido**: el agricultor hace 1-3 certs al año, la captura es compleja (4 numéricos + fecha + dropdown 1.122 municipios + dropdown 82 cultivos + texto largo). En chat puro: alta tasa de abandono y mantenimiento caro. En web responsive: validación en tiempo real, recuperación de error trivial, un solo lugar de código.

---

## 2. Decisiones cerradas

| # | Decisión | Estado |
|---|---|---|
| DEC 1 | Captura por web (magic-link), no por chat. | ✅ Sí |
| DEC 2 | Aprobación obligatoria del coord para cert / generador / finca nuevos. | ✅ Sí |
| DEC 3 | Magic-link sin login, token corto, TTL 30 min, 1 uso. | ✅ Sí |
| DEC 4 | Coord puede editar campos antes de aprobar. | ✅ Sí |
| DEC 5 | Notificación al coord de un pendiente: email V1. | ✅ Sí |
| DEC 6 | Match teléfono → FINCAS.movil con fallback en GENERADORES.movil. | ✅ Sí |
| DEC 7 | Anular cert ya aprobado: sí, `estado="anulado"`, sin liberar consecutivo. | ✅ Sí |
| DEC 8 | Agricultor crea finca pendiente desde web. | ✅ Sí |
| DEC 9 | Agricultor totalmente nuevo se auto-registra (generador pendiente). | ✅ Sí |
| DEC 10 | Default `estado="aprobado"` en records existentes (migración). | ✅ Sí |
| DEC 11 | WhatsApp también notifica el cierre (aprobado/rechazado) al agricultor. | ✅ Sí |
| DEC 12 | OTP / 2FA. | ❌ No en V1 — basta con la aprobación humana y el token de un solo uso. |

---

## 3. Arquitectura

```
WhatsApp (TextIt)                  Portal web (Next.js)
─────────────────                  ────────────────────
[QR físico] o agricultor escribe
   cualquier mensaje (catchall)
  │
  ▼
bot llama POST /api/whatsapp/identificar
  body: { telefono }
  → { estado: "conocido_con_fincas" | "conocido_sin_finca" | "desconocido",
      nombre, opciones[] }
  ▼
bot muestra MENÚ adaptado al estado:
  ├── Caso A: conocido + finca(s)
  │     [1] Generar certificado
  │     [2] Actualizar mis datos
  │     [3] Agregar otra finca
  │     [4] Hablar con mi coordinador
  │
  ├── Caso B: conocido sin finca
  │     [1] Registrar mi primera finca
  │     [2] Actualizar mis datos
  │     [3] Hablar con un coordinador
  │
  └── Caso C: desconocido
        [1] Registrarme como generador
        [2] Hablar con un coordinador
  ▼
agricultor elige opción → bot llama
POST /api/whatsapp/intent { telefono, opcion }
  → { url, expira_min }
  ▼
bot envía: "Abre este link (expira en 30 min): @url"
  ▼
agricultor abre link → formulario responsive
  ↓
[Enviar para aprobación]
  ↓
POST /api/m/<token>/enviar
  ↓
Airtable: crea / actualiza con estado="pendiente"
  ↓
bot notifica: "✓ enviado, tu coord lo aprobará"
  ↓
[coord aprueba en /certificados/pendientes]
  ↓
Si es certificado: genera PDF + email
  ↓
bot notifica: "✓ aprobado, PDF: [url]"
```

**Componentes**:
- **TextIt**: un solo flow corto (`30-agricultor-router`). No captura datos, solo identifica + muestra menú + envía magic-link.
- **QR físico**: imprimible, apunta a `wa.me/<numero>?text=hola%20campolimpio` (o similar). Lo entrega CampoLimpio a las fincas/bodegas durante eventos.
- **Magic-link**: token (`/m/<token>`) que apunta a un "intent" (cert / editar-finca / editar-generador / registro-generador / crear-finca). TTL 30 min, 1 uso, vinculado al teléfono del agricultor.
- **Página `/m/<token>`**: una sola ruta que rendea el formulario correspondiente al intent, con datos pre-cargados.
- **Portal coord**: bandeja unificada `/certificados/pendientes` (3 tabs: cert, generadores, fincas).
- **Notificador `lib/textitNotify.ts`**: broadcasts de cierre al agricultor (aprobado / rechazado).

---

## 4. Flujo WhatsApp (TextIt) — ultra simple

### Flow `30-agricultor-router`

**Trigger**: catchall (cualquier mensaje). Configurado con `interrupt: false` para no cortar flows activos.

```
[N0] Trigger: catchall
  ↓
[N1] Webhook POST /api/whatsapp/identificar
       body: { telefono: @contact.urn }
       → { estado, nombre, opciones[] }
       (opciones[] tiene { numero, label, intent })
  ↓
[N2] Send + Wait Response:
       "@webhook.json.saludo_personalizado
        Elige una opción:
        @webhook.json.menu_texto"
       (validar respuesta sea un número entre 1 y N)
  ↓
[N3] Webhook POST /api/whatsapp/intent
       body: { telefono, opcion: @results.opcion }
       → { url, expira_min, mensaje_ok }
  ↓
[N4] Send: "@webhook.json.mensaje_ok
            Abre este link (expira en @webhook.json.expira_min min):
            @webhook.json.url
            Cuando termines, te aviso por aquí. 👋"
  ↓
[END]
```

**Detalles del menú**: el servidor (no TextIt) arma el `menu_texto` según el estado. Ejemplos de strings que devuelve `/api/whatsapp/identificar`:

```jsonc
// Caso A (conocido con finca)
{
  "estado": "conocido_con_fincas",
  "saludo_personalizado": "Hola Pedro Pérez 👋",
  "menu_texto": "1️⃣ Generar un certificado\n2️⃣ Actualizar mis datos\n3️⃣ Agregar otra finca\n4️⃣ Hablar con mi coordinador",
  "opciones": [
    { "numero": 1, "intent": "cert-nuevo" },
    { "numero": 2, "intent": "editar-datos" },
    { "numero": 3, "intent": "crear-finca" },
    { "numero": 4, "intent": "contactar-coord" }
  ]
}

// Caso B (conocido sin finca)
{
  "estado": "conocido_sin_finca",
  "saludo_personalizado": "Hola Pedro 👋",
  "menu_texto": "Te falta registrar tu primera finca para generar certificados.\n\n1️⃣ Registrar mi primera finca\n2️⃣ Actualizar mis datos\n3️⃣ Hablar con un coordinador",
  "opciones": [
    { "numero": 1, "intent": "crear-finca" },
    { "numero": 2, "intent": "editar-generador" },
    { "numero": 3, "intent": "contactar-coord" }
  ]
}

// Caso C (desconocido)
{
  "estado": "desconocido",
  "saludo_personalizado": "Hola 👋",
  "menu_texto": "No te encuentro en nuestro sistema.\n\n1️⃣ Registrarme como generador\n2️⃣ Hablar con un coordinador",
  "opciones": [
    { "numero": 1, "intent": "registro-generador" },
    { "numero": 2, "intent": "contactar-coord" }
  ]
}
```

**Intent `contactar-coord`**: no genera magic-link, manda email al coord asignado (o admin si no hay) y responde "Listo, un coordinador te contactará pronto."

**Intent `editar-datos`** (Caso A): el servidor decide si abrir `/m/finca/<token>` o `/m/generador/<token>` según completitud, o presenta sub-elección si el agricultor tiene varias fincas a editar.

### Flow `31-aviso-cierre`

Solo se dispara por API (no por input del usuario), vía `POST https://api.textit.com/api/v2/broadcasts.json`.

Mensajes:
- "✓ Tu certificado #1234 fue aprobado. PDF: [url]"
- "✗ Tu solicitud fue rechazada. Motivo: [texto]"
- "✓ Tu registro de generador fue aprobado. Ya puedes generar certificados."
- "✓ Tu finca [nombre] fue aprobada."

**Globals TextIt**:
- `@globals.portal_base` = `https://portal.campolimpio.org`
- `@globals.whatsapp_api_key` = bearer del portal.

**Timeouts**: `expire_after_minutes: 60`. Si no responde, END.

**Catchall vs flows activos**: en TextIt, el flow `30-agricultor-router` tiene `start_priority: high` pero `interrupt: false`. Esto significa: si el agricultor manda un nuevo mensaje mientras está esperando confirmación en N2, el mensaje se evalúa como respuesta al wait actual, no reinicia el flow.

Eso es todo. Un flow de 5 nodos. No hay subflows nuevos. El subflow `10-Municipio` no se usa más.

### QR físico

Imagen QR generada apuntando a:
```
https://wa.me/57XXXXXXXXXX?text=Hola%20CampoLimpio
```
Donde `XXXXXXXXXX` es el número del bot. Imprimible en cartilla, postales, posters de bodegas. Al escanear:
- Abre WhatsApp del usuario.
- Pre-carga el mensaje "Hola CampoLimpio".
- Usuario solo tiene que dar tap a enviar.
- El catchall del flow lo recibe y arranca el menú.

---

## 5. Magic-link — tipos de intent

`/m/<token>` resuelve a una de estas páginas según el intent guardado en el token:

| Intent | Página | Quién precarga | Acción al enviar |
|---|---|---|---|
| `cert-nuevo` | `/m/cert/<token>` | Datos de finca + generador del agricultor | Crea `Certificados` con `estado="pendiente"` |
| `editar-finca` | `/m/finca/<token>` | Datos actuales de la finca | PATCH la finca + marca `estado="pendiente_revision"` |
| `editar-generador` | `/m/generador/<token>` | Datos actuales del generador | PATCH generador + marca `estado="pendiente_revision"` |
| `crear-finca` | `/m/nueva-finca/<token>` | Sólo el generador (padre) | Crea `FINCAS` con `estado="pendiente"` vinculada |
| `registro-generador` | `/m/nuevo-generador/<token>` | Solo el teléfono validado | Crea `GENERADORES` con `estado="pendiente"` |

**Una sola tabla** `edicion_tokens` en Neon:
```sql
CREATE TABLE edicion_tokens (
  token TEXT PRIMARY KEY,
  intent TEXT NOT NULL,             -- cert-nuevo, editar-finca, etc.
  record_id TEXT,                   -- recXXX (finca o generador) o NULL si nuevo
  telefono_validado TEXT NOT NULL,
  contexto JSONB,                   -- datos extra (ej: lista de fincas si N>1)
  expira TIMESTAMPTZ NOT NULL,
  consumido_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ DEFAULT now()
);
```

Validaciones en API:
- Token existe y no consumido.
- `now() < expira`.
- Si el intent edita un record, validar que `telefono_validado` coincide con el `movil` del record (anti-spoof a posteriori).

---

## 6. Páginas web responsive

**Patrón común**:
- Layout móvil-first (Tailwind, max-width 480px en mobile).
- Sin sidebar, sin auth check.
- Header simple: logo CampoLimpio + título.
- Footer con "¿problemas? escribe a wa.me/57xxx".
- Submit button sticky abajo en móvil.
- Validación inline (Zod + React Hook Form o similar manual).
- Loader durante POST + toast de confirmación.
- Estado terminal: "✓ Solicitud enviada. Te avisaremos por WhatsApp cuando se apruebe."

**Componentes reutilizables a heredar del portal**:
- `MunicipioSearch.tsx` (autocomplete municipio — ya construido).
- `CrearGeneradorForm.tsx` (los campos ya están definidos).
- `AgregarFincaForm.tsx`.

**Diferencia clave**: estos componentes en el portal asumen sesión. Para el magic-link, hay que:
- Hacer una variante "agnóstica de sesión" que reciba `token` en prop.
- POST a `/api/m/<token>/enviar` en vez de a los endpoints autenticados.

### 6.1 `/m/cert/<token>` (caso principal)

Campos visibles (en este orden, móvil scroll):
1. Banner: "Hola, [nombre]. Vas a generar un certificado para [finca]."
2. Si tiene varias fincas: dropdown nativo para elegir.
3. Fecha de devolución (input `type="date"`, default hoy, max hoy, min hoy-120).
4. Kg rígidos / flexibles / metálicos / embalaje (4 inputs `type="number"`, step=0.1, default 0, mínimo 0). Suma total visible debajo.
5. Triple lavado (radio: SI / NO / NO APLICA).
6. Municipio de devolución (autocomplete con `MunicipioSearch`).
7. Lugar de devolución (input text).
8. Observaciones (textarea, opcional).
9. Coordinador (dropdown, sugiere el asignado).
10. [Enviar para aprobación] (sticky bottom).

### 6.2 `/m/finca/<token>` (editar finca)

Solo campos seguros (no editables: NIT del generador, link al generador):
- Nombre, municipio, cultivos (multi-select desde lista canónica), móvil, email.
- [Guardar cambios] → marca `estado="pendiente_revision"`, dispara notif al coord.

### 6.3 `/m/generador/<token>` (editar generador)

Solo campos seguros (no editables: cédula/NIT, tipopersona):
- Nombre / razón social, tipo (AGRICOLA/PECUARIO/...), dirección sede, municipio sede, móvil, email.
- [Guardar cambios].

### 6.4 `/m/nueva-finca/<token>` (crear finca)

- Nombre finca, municipio, cultivos (multi), móvil (puede ser distinto al del gen), email opcional.
- [Solicitar creación].

### 6.5 `/m/nuevo-generador/<token>` (registro nuevo)

- Tipo persona, cédula/NIT (con cálculo automático del DV), nombre / razón social, tipo, dirección sede, municipio sede, móvil (ya validado por WhatsApp), email.
- Opcional al final: "¿Quieres registrar tu primera finca ya?" → si sí, abajo del mismo form los campos de finca.
- [Solicitar registro].

---

## 7. Endpoints

### 7.1 Existentes

- `POST /api/certificados/generar` — sin cambios, lo usa el portal coord directo.
- Refactor: extraer la lógica de PDF + Blob + Neon + email a función pura `lib/certificadosCore.ts::generarPDFCertificado()`. La invocan tanto el endpoint generar como `/api/certificados/[id]/aprobar`.

### 7.2 Nuevos — WhatsApp router (dos pasos: identificar + intent)

```
POST /api/whatsapp/identificar
  Auth: Bearer WHATSAPP_BOT_API_KEY
  Body: { telefono }
  Lógica:
    1. Normalizar teléfono (10 dígitos).
    2. Match en FINCAS.movil → fallback GENERADORES.movil.
    3. Determinar estado:
       - "conocido_con_fincas" si tiene ≥1 FINCA aprobada
       - "conocido_sin_finca"  si tiene generador aprobado pero 0 fincas
       - "desconocido"         si no aparece
    4. Devolver:
       {
         estado,
         nombre,                    // del generador, si conocido
         saludo_personalizado,      // "Hola Pedro 👋"
         menu_texto,                // string formateado para WhatsApp
         opciones: [{numero, intent}]
       }

POST /api/whatsapp/intent
  Auth: Bearer WHATSAPP_BOT_API_KEY
  Body: { telefono, opcion: <numero> }
  Lógica:
    1. Re-identificar al agricultor (no confiar en estado del cliente).
    2. Validar que la opción existe en su menú actual.
    3. Resolver intent:
       - cert-nuevo:        crear token + URL /m/cert/<token>
       - editar-datos:      decidir editar-finca o editar-generador según completitud
       - crear-finca:       crear token + URL /m/nueva-finca/<token>
       - registro-generador:crear token + URL /m/nuevo-generador/<token>
       - editar-finca:      crear token + URL /m/finca/<token>
       - editar-generador:  crear token + URL /m/generador/<token>
       - contactar-coord:   NO genera URL; manda email al coord asignado / admin
                            y devuelve { mensaje_ok, url: null }
    4. Crear token en edicion_tokens (TTL 30 min) si aplica.
    5. Devolver { url, expira_min, mensaje_ok }.
```

### 7.3 Nuevos — Magic-link

```
GET /api/m/<token>
  Auth: ninguna (verifica token).
  Devuelve: { intent, datos_precargados, opciones_extra }
            o 404 / 410 (expirado/consumido).

POST /api/m/<token>/enviar
  Auth: ninguna (verifica token + valida payload contra intent).
  Lógica según intent:
    - cert-nuevo:        crea Certificados estado=pendiente
    - editar-finca:      PATCH FINCAS + estado=pendiente_revision + cambios_pendientes JSON
    - editar-generador:  idem en GENERADORES
    - crear-finca:       crea FINCAS estado=pendiente
    - registro-generador:crea GENERADORES estado=pendiente (+ FINCAS si bandera "incluir_finca")
    Marca token como consumido.
    Notifica al coord por email.
    Devuelve { ok, mensaje }.
```

### 7.4 Nuevos — Bandeja del coord

```
GET /api/certificados/pendientes
  Auth: sesión NextAuth.
  Filtros: ?tab=cert|generadores|fincas&coordinadorId=
  Devuelve: { items: [{ tipo, id, agricultor, finca, fecha, resumen, datos }] }

POST /api/certificados/[id]/aprobar
  Body opcional con campos editados.
  Asigna consecutivo, llama a generarPDFCertificado(), marca estado=aprobado.
  Dispara notif WhatsApp al agricultor.

POST /api/certificados/[id]/rechazar
  Body: { motivo: string >=10 chars }
  Dispara notif al agricultor.

POST /api/certificados/[id]/anular   (DEC 7)
  Solo certs ya aprobados.

POST /api/generadores/[id]/aprobar    POST /api/generadores/[id]/rechazar
POST /api/fincas/[id]/aprobar         POST /api/fincas/[id]/rechazar
  Aplican cambios_pendientes si los hay, cambian estado.
  Dispara notif al agricultor.
```

### 7.5 Nuevos — Notificador

```
lib/textitNotify.ts
  enviarBroadcast(telefono, plantilla, parametros)
  Plantillas: "cert_aprobado", "cert_rechazado",
              "generador_aprobado", "generador_rechazado",
              "finca_aprobado", "finca_rechazado".
```

---

## 8. Cambios en Airtable

### 8.1 Tabla `Certificados` — campos nuevos

- `estado` Single Select: `pendiente | aprobado | rechazado | anulado`. Default `aprobado` en migración.
- `solicitud_origen` Single Select: `portal | whatsapp | telegram`.
- `fecha_solicitud`, `fecha_aprobacion`, `fecha_rechazo`, `fecha_anulacion` (Date with time).
- `motivo_rechazo`, `motivo_anulacion` (Long text).
- `aprobado_por`, `rechazado_por`, `anulado_por` (Link a Coordinadores).

### 8.2 Tabla `GENERADORES` — campos nuevos

- `estado` Single Select: `pendiente | aprobado | rechazado`. Default `aprobado`.
- `solicitud_origen`, `fecha_solicitud`, `fecha_aprobacion`, `fecha_rechazo`.
- `motivo_rechazo`.
- `cambios_pendientes` (Long text JSON, para `pendiente_revision` de un gen ya existente).
- `aprobado_por`, `rechazado_por`.

### 8.3 Tabla `FINCAS` — campos nuevos

- `estado` Single Select: `pendiente | aprobado | rechazado | pendiente_revision`. Default `aprobado`.
- `solicitud_origen`, `fecha_solicitud`, `fecha_aprobacion`, `fecha_rechazo`.
- `motivo_rechazo`.
- `cambios_pendientes` (Long text JSON).
- `aprobado_por`, `rechazado_por`.

### 8.4 Migración inicial

Script `scripts/migrar-estados-iniciales.js`:
- PATCH masivo: todos los certs / gens / fincas existentes → `estado="aprobado"`, `solicitud_origen="portal"`.
- Idempotente: salta si ya tiene `estado` definido.

### 8.5 Buzón fallback

- Crear `Coordinadores → "Buzón WhatsApp"` con Rol Administrador.
- Env `WHATSAPP_FALLBACK_COORDINADOR_ID`.

---

## 9. Vista del portal — `/certificados/pendientes`

```
┌─ Tabs ──────────────────────────────────────────────┐
│ Certificados (12) │ Generadores (3) │ Fincas (5)    │
└─────────────────────────────────────────────────────┘
┌─ Filtros (admin) ────────────────────────────────────┐
│ Coordinador: [Todos ▼]   Orden: [Más reciente ▼]    │
└─────────────────────────────────────────────────────┘
┌─ Item ──────────────────────────────────────────────┐
│ Pendiente #1234 — Finca La Esperanza                 │
│ Pedro Pérez · 2026-05-28 14:30 · 25 kg total         │
│ Coordinador: Andrés Gómez                            │
│ [Ver detalle ▼]                                      │
│   ├ Triple lavado: SÍ                                │
│   ├ Devolución: Bodega Mosquera                      │
│   ├ Rígidos: 10  Flexibles: 5  Metálicos: 3  Emb: 2  │
│   └ Observaciones: ninguna                           │
│ [Editar antes] [✓ Aprobar] [✗ Rechazar]              │
└─────────────────────────────────────────────────────┘
```

- Tab activa por defecto: la que tenga más items.
- Badge "X pendientes" en el sidebar, actualizado por SWR cada 30s.
- "Editar antes": modal con campos editables, luego aprobar.
- "Rechazar": modal con textarea de motivo (≥10 chars).
- En el tab Fincas, si `estado="pendiente_revision"`, mostrar diff antes/después.

---

## 10. Variables de entorno

```env
# Magic-link y bot WhatsApp
WHATSAPP_BOT_API_KEY=<bearer para que TextIt llame al portal>
WHATSAPP_FALLBACK_COORDINADOR_ID=recXXX
TEXTIT_API_KEY=<para broadcasts fuera de flow>
EDICION_TOKEN_SECRET=<HMAC del token>
EDICION_TOKEN_TTL_MIN=30

# Ya existentes
NEXTAUTH_URL, NEXTAUTH_SECRET, AIRTABLE_API_KEY, etc.
```

---

## 11. Orden de implementación

### Sprint 1 — Airtable + refactor backend (PREPARACIÓN)
- T1. Campos `estado` y auxiliares en `Certificados`, `GENERADORES`, `FINCAS` (Airtable UI).
- T2. Script PATCH masivo migración a `estado="aprobado"`.
- T3. Registro "Buzón WhatsApp" en Coordinadores + envs.
- T4. Refactor `generarPDFCertificado()` a `lib/certificadosCore.ts`.
- T5. Tabla `edicion_tokens` en Neon + `lib/edicionTokens.ts` (crear, verificar, consumir).

### Sprint 2 — Endpoints magic-link
- T6. `POST /api/whatsapp/identificar` (router del bot).
- T7. `GET /api/m/<token>` (devuelve intent + datos precargados).
- T8. `POST /api/m/<token>/enviar` (despacha según intent).
- T9. `lib/textitNotify.ts` (broadcast de cierre).

### Sprint 3 — Páginas responsive
- T10. Layout común `/m/*` mobile-first, sin sidebar/auth.
- T11. `/m/cert/<token>` (caso principal — formulario cert).
- T12. `/m/finca/<token>` (editar finca).
- T13. `/m/generador/<token>` (editar generador).
- T14. `/m/nueva-finca/<token>` (crear finca).
- T15. `/m/nuevo-generador/<token>` (registro + opcional finca).

### Sprint 4 — Bandeja del coord
- T16. `/certificados/pendientes` con 3 tabs.
- T17. `GET /api/certificados/pendientes` unificado.
- T18. Endpoints `[id]/aprobar`, `/rechazar`, `/anular` para cert / generador / finca.
- T19. Componente "diff" para `pendiente_revision`.
- T20. Modal rechazar con motivo.
- T21. Badge "X pendientes" en sidebar.
- T22. Email al coord cuando llega nueva solicitud.

### Sprint 5 — TextIt flow + pruebas
- T23. Flow `30-agricultor-router` (3 nodos).
- T24. Flow `31-aviso-cierre` (solo broadcast).
- T25. Pruebas C1-C10 en Telegram (ver §13).
- T26. Conectar canal WhatsApp Business productivo.

### Sprint 6 — Rollout + métricas
- T27. Métricas en dashboard cert: "X aprobados / Y pendientes / Z rechazados esta semana".
- T28. Doc para coordinadores (cómo aprobar/rechazar/anular).
- T29. Rollout piloto: 1 coord, 10 fincas, 2 semanas.
- T30. Iterar mensajes y formularios según feedback.

**Dependencias críticas**:
- Sprints 2-3 dependen de T1, T4, T5.
- Sprint 4 depende de T1.
- T16-T22 dependen de T8.
- Sprint 5 depende de Sprint 2 (endpoints listos).
- T27-T30 dependen de Sprint 5.

---

## 12. Riesgos y mitigaciones

| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| Agricultor no abre el link / no tiene datos en el móvil | Media | Medio | Mensaje claro en WhatsApp: "abre desde tu navegador". Link de 30 min, si expira pueden volver a pedirlo. |
| Magic-link compartido / fuga | Media | Alto | Token 1 uso + TTL 30 min + HMAC firmado. Cambio sensible solo si `telefono_validado === movil`. |
| Falla red al cargar el form | Media | Bajo | App resiliente: si GET falla, mostrar reintento. |
| Agricultor crea 5 generadores falsos | Baja | Medio | Rate limit por teléfono: máx 1 generador-pendiente vivo a la vez. |
| Catchall reinicia flow al recibir mensaje en medio | Media | Bajo | `interrupt: false` en trigger + `wait_for_response` con `expire_after_minutes: 5` en N2. Mensajes recibidos durante el wait se interpretan como respuesta al menú. |
| Usuario responde texto en vez de número al menú | Media | Bajo | `wait_for_response` con validación regex `^[1-4]$`. Si falla, re-pregunta hasta 2 intentos, luego END "no entendí". |
| QR pegado en sitio público escaneado por curiosos | Media | Bajo | Catchall reconoce número desconocido y le ofrece registrarse. Si no quiere, END. Sin costo para el sistema. |
| Solicitudes pendientes acumuladas (coord no entra) | Media | Medio | Email diario con conteo >24h. Escalación a admin a las 48h. |
| Cambios via magic-link rompen certs (cambia NIT) | Baja | Alto | Campos no editables: NIT, tipopersona, link generador. Solo dirección, móvil, email, cultivos, nombre. |
| Doble envío del form (click x2) | Media | Bajo | Disable submit + idempotencia por hash (telefono + intent + payload + 5 min). |
| TextIt no manda notif de cierre | Baja | Medio | Fallback email + reintentos exponenciales en `textitNotify`. |
| Formulario sin validar coordinador en cert | Baja | Medio | Server-side: verificar coordinadorId existe y `Rol === "Coordinador"`. |

---

## 13. Casos de prueba (Telegram dev sandbox)

Fincas de prueba:
- `FINCA_TEST_A`: completa, móvil `3001234501`, generador `GEN_A`, coord asignado.
- `FINCA_TEST_B`: incompleta (sin municipio), móvil `3001234502`, generador `GEN_A`.
- `GEN_C`: generador sin fincas, móvil `3001234503`.

Casos:
- C1: agricultor de `FINCA_TEST_A` escribe "hola" → menú A → elige 1 → link → form cert → enviar → coord aprueba → PDF + WhatsApp.
- C2: agricultor de `FINCA_TEST_B` escribe cualquier cosa → menú A → elige 1 → como datos están incompletos, link a `editar-finca` → completa → coord aprueba → bot avisa.
- C3: agricultor de `GEN_C` escribe "buenas" → menú B (sin finca) → elige 1 (crear-finca) → link → coord aprueba.
- C4: agricultor desconocido escribe "info" → menú C → elige 1 (registro-generador) → coord aprueba.
- C5: agricultor escanea QR → mensaje pre-rellenado "Hola CampoLimpio" → menú A.
- C6: link abierto a los 31 min → 410 "link expirado, vuelve a pedirlo".
- C7: link consumido → 410 "ya usaste este link".
- C8: agricultor edita finca: cambia móvil → estado=pendiente_revision → coord aprueba.
- C9: cert rechazado con motivo → WhatsApp recibe motivo.
- C10: doble click en submit → solo 1 solicitud creada.
- C11: payload alterado en cliente (cambia fincaId) → 422 server-side.
- C12: agricultor responde "abc" al menú → re-pregunta. Tras 2 fallos, END "no entendí".
- C13: agricultor elige `contactar-coord` → no recibe link, recibe "te contactarán pronto".

---

## 14. Archivos críticos

**Lectura previa**:
- `app/api/certificados/generar/route.ts`
- `app/api/certificados/finca-info/route.ts`
- `lib/fincaGeneradorResolver.ts`
- `lib/completitudGenerador.ts`
- `lib/validacionesCO.ts`
- `components/MunicipioSearch.tsx`
- `components/CrearGeneradorForm.tsx`
- `components/AgregarFincaForm.tsx`
- `docs/FLUJO_CERTIFICADOS_V3.md`
- `memory/project_textit_flows.md`
- `memory/project_generadores_fincas_modelo.md`

**Nuevos**:
- `lib/certificadosCore.ts` (función pura PDF)
- `lib/edicionTokens.ts` (Neon-backed)
- `lib/textitNotify.ts` (broadcasts)
- `lib/whatsappResolver.ts` (match teléfono → fincas/generadores)
- `app/api/whatsapp/identificar/route.ts`
- `app/api/m/[token]/route.ts` (GET intent + datos)
- `app/api/m/[token]/enviar/route.ts` (POST despacha)
- `app/api/certificados/pendientes/route.ts`
- `app/api/certificados/[id]/aprobar/route.ts`
- `app/api/certificados/[id]/rechazar/route.ts`
- `app/api/certificados/[id]/anular/route.ts`
- `app/api/generadores/[id]/aprobar/route.ts` y `/rechazar`
- `app/api/fincas/[id]/aprobar/route.ts` y `/rechazar`
- `app/m/cert/[token]/page.tsx`
- `app/m/finca/[token]/page.tsx`
- `app/m/generador/[token]/page.tsx`
- `app/m/nueva-finca/[token]/page.tsx`
- `app/m/nuevo-generador/[token]/page.tsx`
- `app/certificados/pendientes/page.tsx`
- `components/MagicLinkForm.tsx` (layout común mobile-first)

---

## 15. Métricas para medir éxito

Tras el rollout piloto (2 semanas), revisar:
- **Tasa de finalización**: agricultores que pidieron link y enviaron form / agricultores que pidieron link. Target ≥80%.
- **Tasa de aprobación**: certificados aprobados / certificados enviados. Target ≥90%.
- **Tiempo medio coord → aprobación**: target <24h en horario laboral.
- **Tiempo de carga del form**: target P95 <2s en 3G.
- **Errores de cliente (4xx)**: <5% de envíos.

---

*Documento V4 — 2026-05-28. Sustituye V3 con decisión arquitectónica: WhatsApp = identificador + cartero; captura siempre por web responsive vía magic-link.*
