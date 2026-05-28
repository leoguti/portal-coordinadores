# TextIt Flow: `30-agricultor-router`

Guía paso a paso para crear el flow en la UI de TextIt. Asume que ya tienes
sesión iniciada en [textit.com](https://textit.com) y que ya configuraste los
**Globals** del paso 1.

---

## 0 · Resumen del flow

El flow tiene **5 nodos** en línea (sin ramas complejas), más un nodo de error:

```
[1] Webhook identificar → guarda @results.identificar
[2] Send + Wait Response (menú) → guarda @results.opcion
[3] Webhook intent → guarda @results.intent
[4] Split: ¿hay URL en @results.intent? → Sí va a [5], No va a [4b]
[5] Send (con link) → END
[4b] Send (sin link, ej. contactar-coord) → END
[E] Send error → END (solo si algún webhook falla)
```

Tiempo estimado de implementación: **20-30 minutos**.

---

## 1 · Globals (ya hecho según me dijiste)

`Settings → Globals` debe tener:

| Nombre | Valor |
|---|---|
| `portal_base` | `https://portal.campolimpio.org` |
| `whatsapp_api_key` | `ba332175870ee3e6c71097dbd3efa50916035151919f79d70d467b5b0d0b11a9` |

⚠️ El bearer es el mismo `WHATSAPP_BOT_API_KEY` de Vercel. Si lo regeneras, cambia en ambos lados.

---

## 2 · Crear el flow

1. Menú lateral → **Flows** → botón **`+ New Flow`** (esquina superior derecha).
2. **Type**: `Messaging` (NO Surveyor, NO Voice).
3. **Name**: `30-agricultor-router`
4. **Language**: `Español (es)`
5. Click **`Create`**.

Se abre el editor visual. Verás un nodo inicial ya creado: **"Send a message"**.

---

## 3 · Nodos del flow

### 🔸 Nodo 1 — `Webhook identificar`

El nodo inicial (el que ya está al abrir el flow) **lo vamos a borrar y reemplazar** por un webhook directo.

**Pasos**:

1. Click derecho en el primer nodo → **Delete node**.
2. En el espacio vacío, arrastra desde la paleta el bloque **"Call a webhook"** (o `+` flotante → `Call a webhook`).
3. Configurar:
   - **Name**: `Webhook identificar`
   - **Method**: `POST`
   - **URL**:
     ```
     @globals.portal_base/api/whatsapp/identificar
     ```
   - **Headers** (clic en "Add Header" 2 veces):

     | Name | Value |
     |---|---|
     | `Authorization` | `Bearer @globals.whatsapp_api_key` |
     | `Content-Type` | `application/json` |
   - **Body** (JSON):
     ```json
     { "telefono": "@contact.urn" }
     ```
   - **Save as**: `identificar`  ← este será `@results.identificar`
4. Click **Save**.

El nodo crea 2 salidas automáticas: **Success** y **Failure**. Conecta:
- **Success** → al nodo 2 (Menú) que crearás abajo.
- **Failure** → al nodo de Error (lo creas al final).

---

### 🔸 Nodo 2 — `Mostrar menú`

**Tipo**: `Wait for a response` (es un combo de Send + Wait, viene como un único nodo en TextIt).

1. Arrastra **"Wait for a response"** desde la paleta.
2. Configurar:
   - **Name**: `Mostrar menú`
   - **Message text** (el texto que se enviará antes de esperar):
     ```
     @results.identificar.json.saludo_personalizado

     @results.identificar.json.menu_texto
     ```
   - **Response type**: `Has only phrase`
   - **Rules**: agrega 1 regla:

     | Operator | Argument | Category | Save as |
     |---|---|---|---|
     | `has only phrase` | `1` | `Opción 1` | — |

     Repite para 2, 3 y 4 (4 reglas en total, una por número).
     - Ten en cuenta que para los casos donde el menú solo tiene 2 opciones (desconocido) o 3 opciones (sin finca), el agricultor solo verá 2 o 3 botones, pero las reglas extra simplemente no se activarán.
   - **Default category** (catch-all si no es 1-4): `Inválido`
   - **Expire after**: `5 minutes` (si no responde, expira).
   - **Save Result as**: `opcion`  ← `@results.opcion`
3. Click **Save**.

Salidas del nodo:
- `Opción 1`, `Opción 2`, `Opción 3`, `Opción 4` → todas conectan al **Nodo 3 (Webhook intent)**.
- `Inválido` → te recomiendo crear un nodo de re-prompt o ir directo al nodo Error.
- `Expired` → al nodo Error.

> **Tip**: para no duplicar conexiones, conecta una salida primero al nodo 3, y luego desde TextIt selecciona las otras y arrástrelas al mismo destino. Quedará un solo flecha visualmente.

---

### 🔸 Nodo 3 — `Webhook intent`

**Tipo**: `Call a webhook`

1. Arrastra **"Call a webhook"**.
2. Configurar:
   - **Name**: `Webhook intent`
   - **Method**: `POST`
   - **URL**:
     ```
     @globals.portal_base/api/whatsapp/intent
     ```
   - **Headers** (mismos 2 que el nodo 1):

     | Name | Value |
     |---|---|
     | `Authorization` | `Bearer @globals.whatsapp_api_key` |
     | `Content-Type` | `application/json` |
   - **Body**:
     ```json
     { "telefono": "@contact.urn", "opcion": "@results.opcion" }
     ```
   - **Save as**: `intent`  ← `@results.intent`
3. Click **Save**.

Salidas:
- **Success** → al **Nodo 4 (Split URL)**.
- **Failure** → al nodo Error.

---

### 🔸 Nodo 4 — `Split: ¿hay URL?`

Este nodo decide si mostrar el link o solo un mensaje (caso "contactar-coord" no genera URL).

**Tipo**: `Split by expression`

1. Arrastra **"Split by expression"**.
2. Configurar:
   - **Name**: `¿Hay URL?`
   - **Expression**:
     ```
     @results.intent.json.url
     ```
   - **Rules**:

     | Operator | Argument | Category |
     |---|---|---|
     | `has any text` | — | `Tiene link` |
     | `Other` (default) | — | `Sin link` |
3. Click **Save**.

Salidas:
- `Tiene link` → al **Nodo 5A (Enviar link)**.
- `Sin link` → al **Nodo 5B (Mensaje sin link)**.

---

### 🔸 Nodo 5A — `Enviar link`

**Tipo**: `Send a message`

1. Arrastra **"Send a message"**.
2. Configurar:
   - **Name**: `Enviar link`
   - **Message**:
     ```
     @results.intent.json.mensaje_ok

     🔗 Abre este link (expira en @results.intent.json.expira_min min):
     @results.intent.json.url

     Cuando termines, te aviso por aquí. 👋
     ```
3. **Save**.

Salida: ninguna (el flow termina). En TextIt esto se ve como un nodo sin
flecha de salida.

---

### 🔸 Nodo 5B — `Mensaje sin link`

**Tipo**: `Send a message`

1. Arrastra **"Send a message"**.
2. Configurar:
   - **Name**: `Mensaje sin link`
   - **Message**:
     ```
     @results.intent.json.mensaje_ok
     ```
3. **Save**.

Salida: ninguna (END).

---

### 🔸 Nodo Error (E) — `Aviso de error`

**Tipo**: `Send a message`

Sirve para los casos donde un webhook falla, el menú expira, o la respuesta es inválida.

1. Arrastra **"Send a message"**.
2. Configurar:
   - **Name**: `Aviso error`
   - **Message**:
     ```
     🤖 Algo no funcionó bien de mi lado. Intenta de nuevo en un momento, o escribe a wa.me/573152699275 para hablar con un coordinador.
     ```
3. **Save**.

Conectar desde:
- `Failure` del **Nodo 1 (Webhook identificar)**.
- `Failure` del **Nodo 3 (Webhook intent)**.
- `Inválido` y `Expired` del **Nodo 2 (Menú)**.

---

## 4 · Configurar el trigger del flow

Una vez los nodos están conectados:

1. Vuelve al listado de flows.
2. Click en el flow `30-agricultor-router`.
3. Botón superior derecho **`Triggers`** o **`Connect`**.
4. **Trigger type**: `Catch all` (cualquier mensaje no manejado por otro flow).
   - Si TextIt no tiene "Catch all" disponible (depende de tu plan), usa `Keyword` con valor `*` o crea varios triggers con palabras comunes: `hola`, `certificado`, `info`, `ayuda`.
5. **Channel**: marca solo el canal de WhatsApp (o Telegram si estás probando).
6. **Interrupt active flows**: `OFF` (importante — no queremos que reinicie un flow activo del agricultor a la mitad).
7. Click **Save Trigger**.

---

## 5 · Activar el flow

1. En el listado de flows, busca `30-agricultor-router`.
2. Verifica que el toggle de la izquierda esté en **Active** (verde).
3. Si dice "Draft", clic para activarlo.

---

## 6 · Probar (caso C1)

1. Desde tu celular, escribe **cualquier mensaje** al número del bot
   (`+57 323 468 8397`) o al canal de Telegram que conectes.
2. Debes recibir:
   - Saludo personalizado con tu nombre (si tu número está en `FINCAS.movil` o `GENERADORES.movil`).
   - Menú con 2-4 opciones según tu estado.
3. Responde `1` (o el número de la opción que quieras probar).
4. Debes recibir el magic-link al portal con instrucción de abrirlo.
5. Abre el link y verifica que el formulario cargó tus datos.

---

## 7 · Variables que el flow guarda (para debugging)

Cuando un agricultor pasa por el flow, en TextIt → Contacts → su perfil →
**Run history** vas a ver:

| Variable | Ejemplo |
|---|---|
| `@results.identificar.json.estado` | `conocido_con_fincas` |
| `@results.identificar.json.nombre` | `LUIS ALBERTO ANACONA SALCEDO` |
| `@results.opcion` | `1` |
| `@results.intent.json.url` | `https://portal.campolimpio.org/m/cert/abc…` |
| `@results.intent.json.intent` | `cert-nuevo` |

Si algo falla, mira los Run History para ver qué respondió cada webhook.

---

## 8 · Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| "No autorizado" al llamar el webhook | `@globals.whatsapp_api_key` mal escrito | Re-pega el bearer en Globals, sin espacios extras |
| Webhook retorna 404 | URL mal escrita | Verifica `@globals.portal_base/api/whatsapp/identificar` literal |
| `@results.identificar.json.nombre` vacío para todos | Match teléfono falla | Revisa formato del URN del canal (puede venir `tel:+573…` o `whatsapp:+573…`, el endpoint normaliza) |
| El menú se envía pero no responde a la opción | Reglas mal configuradas en el Wait | Asegúrate que las reglas sean `has only phrase` con valores `1`, `2`, `3`, `4` |
| El link expira muy rápido | `EDICION_TOKEN_TTL_MIN` está en 30 por default | Está OK; si quieres más, cambia en Vercel env |

---

## 9 · Flow `31-aviso-cierre` (NO se crea aparte)

El portal envía mensajes al agricultor cuando se aprueba/rechaza/anula un cert
usando `lib/textitNotify.ts`, que hace `POST /api/v2/broadcasts.json` a la API
de TextIt directamente. **No necesitas crear un segundo flow** — los mensajes
llegan como Direct Messages en la conversación del agricultor.

Si el agricultor responde a esos mensajes (ej. "gracias"), el catchall del
flow `30-agricultor-router` lo recibe normalmente.

### Si tienes varios canales en TextIt

Si la cuenta tiene WhatsApp + Telegram + Twitter, el broadcast usa el canal
default del contacto. Si quieres forzar el canal de WhatsApp, agrega en
Vercel:

```
TEXTIT_CHANNEL_UUID=<uuid del canal WhatsApp>
```

Sacas el UUID así:
1. TextIt → **Channels**
2. Click en el canal de WhatsApp.
3. La URL contiene `/channels/channel/abc-def-1234/` → ese `abc-def-1234` es el UUID.

---

## 10 · QR físico

Generado ya en el repo:

- `public/qr/whatsapp-campolimpio.png` (PNG 580×580, ECC alto, listo para imprimir tamaño A6).
- `public/qr/whatsapp-campolimpio.svg` (vectorial — escala sin pixelar para posters grandes).

Apuntan a: `https://wa.me/573234688397?text=Hola%20CampoLimpio`

Para descargarlos desde producción:
- `https://portal.campolimpio.org/qr/whatsapp-campolimpio.png`
- `https://portal.campolimpio.org/qr/whatsapp-campolimpio.svg`

---

## 11 · Casos de prueba completos (después de implementar)

| # | Setup | Acción | Esperado |
|---|---|---|---|
| C1 | Tu móvil en `FINCAS.movil` aprobado | Escribir "hola" | Saludo + menú A (4 opciones) |
| C2 | Tu móvil en finca SIN municipio/cultivo | Escribir cualquier cosa | Menú A → opción 1 → link a **editar-finca** (no cert) |
| C3 | Tu móvil solo en `GENERADORES.movil` | Escribir cualquier cosa | Menú B (sin finca) → opción 1 → link a **crear-finca** |
| C4 | Móvil NO registrado | Escribir cualquier cosa | Menú C → opción 1 → link a **registro-generador** |
| C5 | Cualquier estado | Responder "abc" al menú | Categoría `Inválido` → nodo Error |
| C6 | Cualquier estado | No responder en 5 min | Categoría `Expired` → nodo Error |
| C7 | Conocido con finca | Opción 4 (contactar-coord) | Mensaje "te contactarán pronto" SIN link |
| C8 | Escanear QR físico | Abre WhatsApp con texto pre-rellenado → enviar | Mismo flujo que C1 (catchall) |

---

## 12 · Después de pruebas, hacer rollout

1. **Piloto**: 1 coord (idealmente Andrea — ya conoce los issues) con 10 fincas suyas.
2. Imprimir el QR y darle a esas 10 fincas (vía coord o entrega física).
3. Dejarlo correr 2 semanas.
4. Métricas a revisar:
   - Tasa de finalización (agricultores que escribieron / agricultores que enviaron form). Target ≥80%.
   - Tasa de aprobación. Target ≥90%.
   - Tiempo medio coord→aprobación. Target <24h.
   - Errores 4xx en endpoints. <5%.
5. Si todo OK → ampliar a 5 coords.

---

## 13 · Variables de entorno (referencia)

Todas ya configuradas en Vercel salvo donde digo "opcional":

| Variable | Valor | Notas |
|---|---|---|
| `WHATSAPP_BOT_API_KEY` | `ba33…` | Mismo que `@globals.whatsapp_api_key` |
| `AIRTABLE_API_KEY` | configurado | — |
| `AIRTABLE_BASE_ID` | `appniHwKiUMS0imXD` | — |
| `WHATSAPP_FALLBACK_COORDINADOR_ID` | `rec5XxhgXdRwsTcVe` | Buzón WhatsApp |
| `TEXTIT_API_TOKEN` | configurado | Para enviar broadcasts |
| `TEXTIT_API_URL` | `https://textit.com/api/v2` | Default OK |
| `EDICION_TOKEN_TTL_MIN` | `30` | Default OK |
| `TEXTIT_CHANNEL_UUID` | (opcional) | Solo si tienes varios canales |
| `NEON_DATABASE_URL` | configurado | Para tokens magic-link |
