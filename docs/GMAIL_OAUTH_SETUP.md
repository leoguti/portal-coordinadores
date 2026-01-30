# Configuración OAuth2 para Gmail - facturaelectronica@campolimpio.org

## Paso 1: Crear Proyecto en Google Cloud Console

1. Ve a: **https://console.cloud.google.com**
2. En el menú superior, click en el selector de proyecto
3. Click en **"Nuevo Proyecto"**
4. Nombre del proyecto: **"Portal CampoLimpio"**
5. Click en **"Crear"**
6. Espera que se cree el proyecto (30 segundos aprox)

---

## Paso 2: Habilitar Gmail API

1. Con el proyecto seleccionado, ve al menú lateral: **"APIs y servicios"** → **"Biblioteca"**
2. O directo: **https://console.cloud.google.com/apis/library**
3. Busca: **"Gmail API"**
4. Click en **"Gmail API"**
5. Click en **"HABILITAR"**
6. Espera que se habilite (~10 segundos)

---

## Paso 3: Configurar Pantalla de Consentimiento OAuth

1. Ve a: **"APIs y servicios"** → **"Pantalla de consentimiento de OAuth"**
2. O directo: **https://console.cloud.google.com/apis/credentials/consent**
3. Selecciona tipo de usuario: **"Interno"** (si es Google Workspace) o **"Externo"**
4. Click en **"Crear"**

### Información de la aplicación:
- **Nombre de la aplicación**: Portal CampoLimpio
- **Correo de asistencia**: tu-email@campolimpio.org
- **Logotipo**: (Opcional - puedes omitir)
- **Dominio de la aplicación**: portal.campolimpio.org
- **Correo de contacto del desarrollador**: tu-email@campolimpio.org

5. Click en **"Guardar y continuar"**

### Permisos (Scopes):
6. Click en **"Añadir o quitar permisos"**
7. Busca y marca: **`https://mail.google.com/`** (acceso completo a Gmail)
   - O más restrictivo: **`https://www.googleapis.com/auth/gmail.send`** (solo envío)
8. Click en **"Actualizar"**
9. Click en **"Guardar y continuar"**

### Usuarios de prueba (solo si elegiste "Externo"):
10. Click en **"Añadir usuarios"**
11. Agrega: **facturaelectronica@campolimpio.org**
12. Click en **"Guardar y continuar"**
13. Click en **"Volver al panel"**

---

## Paso 4: Crear Credenciales OAuth 2.0

1. Ve a: **"APIs y servicios"** → **"Credenciales"**
2. O directo: **https://console.cloud.google.com/apis/credentials**
3. Click en **"+ CREAR CREDENCIALES"** → **"ID de cliente de OAuth 2.0"**

### Configuración:
- **Tipo de aplicación**: **"Aplicación web"**
- **Nombre**: Portal CampoLimpio - Email
- **Orígenes de JavaScript autorizados**: (dejar vacío)
- **URI de redirección autorizados**: 
  - Agrega: **`https://developers.google.com/oauthplayground`**

4. Click en **"Crear"**
5. Se mostrará un modal con:
   - **Client ID**: `xxxxx.apps.googleusercontent.com`
   - **Client Secret**: `xxxxxx`
6. **COPIA Y GUARDA** ambos valores (los necesitaremos)

---

## Paso 5: Generar Refresh Token

1. Ve a: **https://developers.google.com/oauthplayground**
2. En la esquina superior derecha, click en el **ícono de engranaje** ⚙️
3. Marca: **"Use your own OAuth credentials"**
4. Pega:
   - **OAuth Client ID**: (el que copiaste)
   - **OAuth Client secret**: (el que copiaste)
5. Cierra el modal

### Autorizar acceso:
6. En el panel izquierdo, busca: **"Gmail API v1"**
7. Expande y marca: **`https://mail.google.com/`** (o solo `gmail.send`)
8. Click en **"Authorize APIs"**
9. Selecciona la cuenta: **facturaelectronica@campolimpio.org**
10. Click en **"Permitir"** o **"Allow"** (puede aparecer advertencia "Esta app no está verificada" - click en "Avanzado" → "Ir a Portal CampoLimpio (no seguro)")
11. Click en **"Permitir"** nuevamente para confirmar permisos

### Obtener Refresh Token:
12. En el panel izquierdo verás el **Authorization code**
13. Click en **"Exchange authorization code for tokens"**
14. Se generarán:
    - **Access token**: (expira en 1 hora - no lo necesitamos)
    - **Refresh token**: `1//xxxxx` ← **COPIA ESTE VALOR**

---

## Paso 6: Guardar Credenciales

Tendrás 3 valores:
```
CLIENT_ID=xxxxx.apps.googleusercontent.com
CLIENT_SECRET=xxxxx
REFRESH_TOKEN=1//xxxxx
```

**Guárdalos de forma segura** - los usaremos para configurar el proyecto.

---

## Siguiente Paso

Una vez tengas los 3 valores, avísame y actualizaré:
1. El archivo `.env.local` con las nuevas variables
2. El código de `lib/sendEmail.ts` para usar OAuth2
3. El código de `app/api/auth/[...nextauth]/route.ts` para magic links

---

**Tiempo estimado**: 10-15 minutos
**Importante**: NO compartas estos valores públicamente
