# TextIt Flow: `30-agricultor-router`

Implementación del flow para que el agricultor pida certificados, edite info o
se registre. Compatible con WhatsApp Business y Telegram (sandbox).

**Endpoints del portal que usa**: `POST /api/whatsapp/identificar` y
`POST /api/whatsapp/intent`. Ya están desplegados en producción.

---

## Configuración previa

### 1. Globals en TextIt

En **Settings → Globals**, crear:

| Global | Valor |
|---|---|
| `portal_base` | `https://portal.campolimpio.org` |
| `whatsapp_api_key` | `ba332175870ee3e6c71097dbd3efa50916035151919f79d70d467b5b0d0b11a9` |

⚠️ **El `whatsapp_api_key` es el mismo bearer** que ya está en Vercel como
`WHATSAPP_BOT_API_KEY`. Si lo regeneras, actualiza en ambos lados.

### 2. Trigger del flow

- **Trigger type**: Catchall (cualquier mensaje dispara el flow).
- **Interrupt**: `false` (no reinicia flows activos del agricultor).
- Si la cuenta de TextIt requiere keyword explícito, usa `*` o crea uno
  llamado `hola` además del catchall.

---

## Estructura del flow (5 nodos)

```
[N0] Trigger: catchall
  ↓
[N1] Webhook POST → /api/whatsapp/identificar
       body: { "telefono": "@contact.urn" }
       → guarda @results en saludo + menu + opciones
  ↓
[N2] Send + Wait Response:
       "@webhook.saludo_personalizado
        Elige una opción:
        @webhook.menu_texto"
       (validar respuesta entre 1 y 4 con regex ^[1-4]$)
  ↓
[N3] Webhook POST → /api/whatsapp/intent
       body: { "telefono": "@contact.urn", "opcion": @results.opcion }
       → guarda @results en url + mensaje_ok
  ↓
[N4] Send: mensaje final con el magic-link
  ↓
[END]
```

---

## Definición nodo a nodo

### N1 — Webhook identificar

**Tipo**: Call webhook

```json
{
  "method": "POST",
  "url": "@globals.portal_base/api/whatsapp/identificar",
  "headers": {
    "Authorization": "Bearer @globals.whatsapp_api_key",
    "Content-Type": "application/json"
  },
  "body": {
    "telefono": "@contact.urn"
  }
}
```

**Save response as**: `@results.identificar`

**Result categories** (router):
- Success: status 200
- Otro: status >= 400 → ir a [N99]

**Variables que el webhook retorna** (en `@results.identificar.json`):
- `estado` (conocido_con_fincas / conocido_sin_finca / desconocido)
- `nombre`
- `saludo_personalizado`
- `menu_texto`
- `opciones[]` (array con `numero` e `intent`)

---

### N2 — Send + Wait Response (menú)

**Tipo**: Send message + wait for response

**Mensaje**:
```
@results.identificar.json.saludo_personalizado

@results.identificar.json.menu_texto
```

**Wait for**: response

**Validación**: `Has all of the words` con regex pattern `^[1-4]$` →
save as `@results.opcion`.

**Reintentos**: 2. Si tras 2 entradas inválidas no es número 1-4 → END con
mensaje "No entendí. Escríbeme de nuevo cualquier mensaje para empezar."

**Expire after**: 5 minutos (si el agricultor no responde, END).

---

### N3 — Webhook intent

**Tipo**: Call webhook

```json
{
  "method": "POST",
  "url": "@globals.portal_base/api/whatsapp/intent",
  "headers": {
    "Authorization": "Bearer @globals.whatsapp_api_key",
    "Content-Type": "application/json"
  },
  "body": {
    "telefono": "@contact.urn",
    "opcion": @results.opcion
  }
}
```

**Save response as**: `@results.intent`

**Variables que retorna**:
- `url` (string o null)
- `expira_min` (number)
- `mensaje_ok` (string)
- `intent` (string)

---

### N4 — Send (link final)

**Tipo**: Send message

**Mensaje** (con condicional):

Si `@results.intent.json.url` no es null:
```
@results.intent.json.mensaje_ok

🔗 Abre este link (expira en @results.intent.json.expira_min min):
@results.intent.json.url

Cuando termines, te aviso por aquí. 👋
```

Si `@results.intent.json.url` es null (caso contactar-coord):
```
@results.intent.json.mensaje_ok
```

**Routing**: split por `@results.intent.json.url` → has any text vs is empty.

---

### N99 — Error

**Tipo**: Send message + END

```
🤖 Algo no funcionó bien de mi lado. Intenta de nuevo en un momento, o escribe a +57 315 269 9275 para hablar con un coordinador.
```

---

## Flow `31-aviso-cierre`

Este flow **NO se dispara por mensaje del usuario**. Solo lo invoca el portal
vía API cuando se aprueba/rechaza/anula un cert.

**No necesitas crearlo como un Flow Trigger** — los broadcasts que enviamos
con `lib/textitNotify.ts` son mensajes directos al URN del agricultor que
aparecen en la conversación. Si el agricultor responde, el catchall del flow
`30-agricultor-router` lo recibe.

### Verificar canal correcto en TextIt

Si la cuenta tiene varios canales (WhatsApp + Telegram + Email), agrega en
Vercel:

```
TEXTIT_CHANNEL_UUID=<uuid del canal WhatsApp>
```

Sacas el UUID desde Settings → Channels → click en el canal → URL contiene
`/channels/channel/<uuid>/`.

---

## QR físico

Generado en `public/qr/whatsapp-campolimpio.png` (PNG, 580x580 px) y
`public/qr/whatsapp-campolimpio.svg` (vectorial).

**Apunta a**: `https://wa.me/573234688397?text=Hola%20CampoLimpio`

Al escanear:
1. Abre WhatsApp.
2. Pre-carga el mensaje "Hola CampoLimpio".
3. Usuario solo da enviar.
4. El catchall del flow `30-agricultor-router` lo recibe.

Imprimible en cartillas, postales, posters de bodegas.

---

## Casos de prueba (Telegram sandbox)

Para probar antes de WhatsApp Business, puedes conectar Telegram sandbox a
TextIt y probar como agricultor.

Casos mínimos:

- **C1**: número conocido con finca → menú A → opción 1 → recibe link cert.
- **C2**: número conocido con finca incompleta → menú A → opción 1 → recibe
  link editar-finca (no cert).
- **C3**: número conocido sin finca → menú B → opción 1 → link crear-finca.
- **C4**: número desconocido → menú C → opción 1 → link registro-generador.
- **C5**: responde "abc" al menú → re-pregunta → 2 fallos → END.
- **C6**: opción 4 (contactar-coord) → mensaje "te contactarán pronto".

---

## Variables de entorno requeridas

Ya configuradas en Vercel:

- `WHATSAPP_BOT_API_KEY` ✅
- `AIRTABLE_API_KEY` ✅
- `AIRTABLE_BASE_ID` ✅
- `WHATSAPP_FALLBACK_COORDINADOR_ID` ✅
- `TEXTIT_API_TOKEN` ✅
- `EDICION_TOKEN_TTL_MIN=30` ✅

**Opcional para limitar el broadcast a un canal específico**:
- `TEXTIT_CHANNEL_UUID` ⚠️ revisar si hace falta

---

## Próximos pasos

1. Crear los 5 nodos en TextIt según la guía de arriba.
2. Activar el flow (Active = true).
3. Hacer caso C1 desde tu propio Telegram/WhatsApp.
4. Si todo OK, imprimir el QR y empezar el piloto con 1 coord / 10 fincas.
