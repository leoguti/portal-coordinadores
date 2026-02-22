# Flujo "09-Certificado v3" en TextIt

Flujo activo que genera certificados de devolucion de envases.
UUID: 3a79f037-e62a-41e6-991a-effe00388c3c

## Resumen del flujo

```
Coordinador (WhatsApp) → TextIt → Airtable + DO Server → PDF + Email
```

---

## Paso a paso

### 1. Validacion de coordinador
- Verifica que el contacto tenga rol de coordinador
- Si no → "No esta autorizado" → FIN
- verificado .. esta OK 

### 2. Input: Fecha de devolucion
- Formato: C+dd/mm/aaaa
- Validaciones:
  - No puede ser fecha futura
  - No puede tener mas de 120 dias de antiguedad (con advertencia a los 60)
  - Debe ser fecha valida
- Esta OK 

### 3. Input: Cedula del generador


### 4. Subflow → "21-generador v3"
- Construye URL de consulta Airtable: `ubicaciones?filterByFormula=({cedulagenerador}=CEDULA)`
- Llama al subflow "16-Paginador" que:
  - Hace GET a Airtable con esa URL
  - Pagina resultados de 10 en 10
  - Muestra lista: direccion + municipio de cada ubicacion
  - El usuario selecciona una
  - Retorna el `id` del registro seleccionado
- Si no encuentra generador → ofrece crear uno nuevo (subflow "17-ad_generador v2")
- Con el id seleccionado, hace GET a Airtable para leer el registro completo
- Extrae todos los campos: nombre, direccion, cultivo, municipio, cedula, movil, email, tipo
- Muestra resumen al coordinador: "Estos son los datos del generador..."
- Opciones: Si (continuar) / Editar (subflow ed_generador) / Agregar (nuevo)
- Si el generador no tiene municipio vinculado → subflow "10-Municipio" para asignarlo
Esta Ok 

### 5. Inputs de materiales (kg)
- Rigidos (validacion numerica)
- Flexibles (validacion numerica)
- Metalicos (validacion numerica)
- Embalaje (validacion numerica)
Esta OK

### 6. Input: Triple lavado
- Valores validos: SI, NO, PENDIENTE

### 7. Input: Lugar de devolucion
- Texto libre, obligatorio

### 8. Subflow → "10-Municipio"
- Busca municipio de devolucion
- Retorna id del municipio

### 9. Input: Observaciones
- Texto libre

### 10. Confirmacion
- Muestra resumen completo:
  - Fecha, Generador, Cedula, Direccion, Cultivo, Municipio
  - Rigidos, Flexibles, Metalicos, Embalaje, Total
  - Triple lavado, Lugar devolucion, Municipio devolucion
  - Observaciones
- Pregunta: "Generar certificado?" → Si / No
- Si No → "CANCELADO" → FIN

---

## Webhooks (en orden de ejecucion)

### Webhook 1: CREAR registro en Airtable
- Metodo: POST
- URL: `https://api.airtable.com/v0/appniHwKiUMS0imXD/Certificados`
- Auth: Bearer @globals.apikey
- Body:
```json
{
  "fields": {
    "link_ubicacion": ["ID_UBICACION"],
    "coordinador": ["ID_COORDINADOR"],
    "idmunicipiodevolucion": ["ID_MUNICIPIO"],
    "rigidos": "XX",
    "flexibles": "XX",
    "metalicos": "XX",
    "embalaje": "XX",
    "observaciones": "texto",
    "triplelavado": "SI/NO/PENDIENTE",
    "lugardevolucion": "texto",
    "fechadevolucion": "fecha"
  },
  "typecast": true
}
```
- Captura: `idregistrocertificado = @webhook.json.id`
- Nota: El consecutivo lo genera Airtable automaticamente (campo Autonumber)
esta ok 

### Webhook 2: LEER registro recien creado
- Metodo: GET
- URL: `https://api.airtable.com/v0/appniHwKiUMS0imXD/Certificados/{idregistrocertificado}`
- Auth: Bearer @globals.apikey
- Proposito: Obtener el registro completo incluyendo campos calculados/lookup (consecutivo, nombres de coordinador, datos del generador via link_ubicacion, etc.)
esta ok


### Webhook 3: GENERAR PDF en servidor DigitalOcean
- Metodo: POST
- URL: `https://campolimpio.rumbo.digital/genpdf.php`
- Auth: NINGUNA
- Body: `@(json(webhook.json))` — el JSON completo del registro de Airtable (resultado del webhook 2)
- Proceso en el servidor:
  1. Recibe JSON con todos los campos del certificado
  2. Extrae variables ($nombregenerador, $cedulagenerador, etc.)
  3. Incluye `formatocampolimpio.php` que genera HTML del certificado (~76KB de template)
  4. Dompdf convierte HTML → PDF
  5. Guarda como `certificado_XXXXX.pdf` en `/var/www/.../public_html/`
  6. Retorna: `{ "status": 200, "url": "https://campolimpio.rumbo.digital/certificado_XXXXX.pdf" }`
- Captura: `url = @webhook.json.url`



### Webhook 4: ADJUNTAR PDF al registro en Airtable
- Metodo: PATCH
- URL: `https://api.airtable.com/v0/appniHwKiUMS0imXD/Certificados/{idregistrocertificado}`
- Auth: Bearer @globals.apikey
- Body:
```json
{
  "fields": {
    "certificadopdf": [
      { "url": "https://campolimpio.rumbo.digital/certificado_XXXXX.pdf" }
    ]
  }
}
```
- Captura: `consecutivo = @webhook.json.fields.consecutivo`

### 11. Mensaje al coordinador
- "Este es tu certificado, se ha generado Correctamente con el consecutivo XXXXX"

### Webhook 5: ENVIAR EMAIL con certificado
- Metodo: POST
- URL: `https://campolimpio.rumbo.digital/mail/api_sendmail.php`
- Auth: API key en body (`key=ekz_rbm1XTQ9bez_qtw`)
- Body (form-urlencoded):
  - `key`: API key
  - `certificado`: numero consecutivo
  - `email`: lista separada por comas (leogiga@gmail.com, certificados@campolimpio.org, email generador, email coordinador)
- Proceso en el servidor:
  1. Valida key y parametros
  2. Busca PDF en disco: `/var/www/.../certificado_XXXXX.pdf`
  3. Descarga infografia dinamica desde Airtable (tabla con adjuntos, ultimo registro)
  4. Construye email HTML con logos embebidos, infografia, link WhatsApp
  5. Adjunta PDF
  6. Envia via Gmail SMTP (smtp.gmail.com:587)

### 12. Subflow → "22-notificador"
- Notificacion adicional (telefono del usuario, etc.)

---

## Servidor DigitalOcean - Archivos relevantes

| Archivo | Usado en v3 | Funcion |
|---------|-------------|---------|
| `genpdf.php` | SI | Genera PDF con dompdf |
| `formatocampolimpio.php` | SI | Template HTML del certificado (incluido por genpdf) |
| `mail/api_sendmail.php` | SI | Envia email con PDF adjunto |
| `mail/config.php` | SI | Credenciales SMTP y Airtable |
| `generador.php` | NO (v1/v2) | Buscaba generador en SQLite local |
| `newrow.php` | NO (v1/v2) | Escribia fila en Google Sheets + SQLite |
| `newrow1.php` | NO (v1) | Version vieja de newrow |
| `cert_campolimpio.php` | NO (v1) | Generador de PDF viejo con phpToPDF |
| `sync.php` | NO | Sincronizaba ubicaciones de Google Sheets a SQLite |
| `sync_kardex.php` | NO | Sincronizacion de kardex |
| `correo.php` | NO | Test de email viejo |
| `formatocampolimpiov3.php` | NO (copia?) | Otra version del template |
| `newkardex.php` | ? | Creacion de kardex |
| `reversa.php` / `reversa_1.php` | ? | Reversa de certificados |
| `restaurador.php` | ? | Restauracion de datos |
| `short.php` | ? | Desconocido |

## Stack del servidor

- Ubuntu 18.04 LTS (EOL)
- Apache 2.4.29
- PHP 7.2.24 (EOL)
- Dompdf (version desconocida)
- PHPMailer 6.9
- Google API Client (para Sheets, ya no usado en v3)
- SQLite (campolimpio.db - solo usado por flujos viejos)
- Host: campolimpio.rumbo.digital (143.198.74.165)
- SSH: leonardo@campolimpio.rumbo.digital

## Problemas identificados

- PHP 7.2 y Ubuntu 18.04 estan fuera de soporte (sin parches de seguridad)
- genpdf.php no tiene autenticacion — cualquiera puede generar PDFs
- api_sendmail.php tiene API key debil en el body (no header)
- PDFs publicos sin auth en /public_html/
- Template HTML de 76KB exportado de Google Docs (dificil de mantener)
- Credenciales SMTP en config.php en el servidor
- El servidor DO solo se usa para 2 cosas: generar PDF y enviar email
- Ambas funciones se podrian migrar a Next.js API routes en Vercel

## Posible migracion

Reemplazar los 2 endpoints del servidor DO con API routes en el portal:

1. `POST /api/certificados/generar-pdf` — Reemplaza genpdf.php
   - Recibe datos del certificado
   - Genera PDF con @react-pdf/renderer (ya usado para ordenes)
   - Sube a Vercel Blob o R2
   - Retorna URL

2. `POST /api/certificados/enviar-email` — Reemplaza api_sendmail.php
   - Recibe consecutivo + emails
   - Descarga PDF desde URL
   - Envia email con Nodemailer (ya configurado para magic links)

Solo habria que cambiar 2 URLs en TextIt (webhooks 3 y 5).
