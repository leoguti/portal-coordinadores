# Vercel Deployment - Portal Coordinadores

## 📋 Información del Proyecto

**Repositorio GitHub:** https://github.com/leoguti/portal-coordinadores.git  
**Branch principal:** `main`  
**Cuenta Vercel:** (pendiente verificar URL del proyecto)

---

## 🚀 Workflow de Deployment

### Proceso Automático (Git Push → Deploy)

```bash
# 1. Hacer cambios en código local
# Editar archivos...

# 2. Commit y push a GitHub
git add .
git commit -m "descripción de cambios"
git push origin main

# 3. Vercel detecta el push automáticamente
# - Build automático
# - Deploy automático
# - URL actualizada en minutos
```

**⚠️ Importante:** Cada push a `main` dispara un deploy automático en Vercel.

---

## 🔧 Configuración Inicial (Ya Completada)

### Pasos que se siguieron:

1. **Conectar Vercel con GitHub**
   - Entrar a https://vercel.com/dashboard
   - Click en "Add New Project"
   - Seleccionar repositorio: `leoguti/portal-coordinadores`
   - Autorizar acceso a GitHub

2. **Configurar Variables de Entorno**
   En dashboard de Vercel → Settings → Environment Variables:
   
   ```
   NEXTAUTH_URL=https://[tu-proyecto].vercel.app
   NEXTAUTH_SECRET=[tu-secret]
   
   AIRTABLE_API_KEY=[tu-api-key]
   AIRTABLE_BASE_ID=appniHwKiUMS0imXD
   
   EMAIL_SERVER_HOST=smtpout.secureserver.net
   EMAIL_SERVER_PORT=587
   EMAIL_SERVER_USER=[tu-email]
   EMAIL_SERVER_PASSWORD=[tu-password]
   EMAIL_FROM=[tu-email]
   
   TEXTIT_API_URL=https://textit.com/api/v2
   TEXTIT_API_TOKEN=[tu-token]
   ```

3. **Deploy Inicial**
   - Vercel hace el primer build automáticamente
   - Genera URL: `https://portal-coordinadores.vercel.app` (o similar)

---

## 🌐 URLs del Proyecto

### URL de Producción (Vercel)
**Pendiente verificar:** https://[proyecto].vercel.app

### URL con Dominio Custom (Opcional)
Si se configuró dominio custom:
- https://portal.rumbo.digital (apuntando a Vercel)

### URL de Preview (por cada PR)
Vercel genera URLs temporales para Pull Requests:
- https://portal-coordinadores-[hash].vercel.app

---

## 📝 Comandos Útiles

### Desarrollo Local
```bash
# Iniciar servidor local
npm run dev

# Ver en: http://localhost:3000
```

### Build Local (probar antes de push)
```bash
# Build de producción
npm run build

# Iniciar build localmente
npm run start
```

### Git Workflow
```bash
# Ver estado actual
git status

# Ver cambios
git diff

# Commit y push
git add .
git commit -m "feat: descripción del cambio"
git push origin main
```

---

## 🔍 Verificar Deployment en Vercel

### Dashboard de Vercel
1. Ir a: https://vercel.com/dashboard
2. Seleccionar proyecto: `portal-coordinadores`
3. Ver:
   - **Deployments**: Historial de deploys
   - **Domains**: URLs configuradas
   - **Settings**: Variables de entorno, build settings

### Ver Logs de Build
1. Click en el deployment más reciente
2. Ver "Building" logs si hay errores
3. Ver "Functions" logs para errores de runtime

---

## 🆘 Troubleshooting

### Build Failed en Vercel

**Problema:** El build falla en Vercel pero funciona en local

**Soluciones:**
```bash
# 1. Verificar que el build funciona localmente
npm run build

# 2. Revisar versión de Node.js en Vercel
# Settings → General → Node.js Version → 20.x

# 3. Revisar variables de entorno
# Settings → Environment Variables
```

### Variables de Entorno No Funcionan

**Problema:** NEXTAUTH_URL o Airtable no responden

**Solución:**
1. Ir a Vercel Dashboard → Settings → Environment Variables
2. Verificar que todas las variables estén configuradas
3. **Importante:** Después de agregar/editar variables, hacer un redeploy:
   - Deployments → Click en el último → "Redeploy"

### Cambios No Se Ven en Producción

**Problema:** Hice push pero no veo los cambios

**Solución:**
```bash
# 1. Verificar que el push fue exitoso
git log --oneline -5

# 2. Ver en Vercel si el deploy se activó
# Dashboard → Deployments

# 3. Si no se activó, hacer push manual
git commit --allow-empty -m "trigger deploy"
git push origin main

# 4. Limpiar caché del navegador
# Ctrl + Shift + R (hard refresh)
```

---

## 🔐 Dominio Custom (Opcional)

### Configurar portal.rumbo.digital en Vercel

Si quieres que Vercel sirva el dominio (en vez de Cloudflare Tunnel):

1. **En Vercel Dashboard:**
   - Project Settings → Domains
   - Add Domain: `portal.rumbo.digital`
   - Vercel te dará registros DNS

2. **En Cloudflare (DNS):**
   - Cambiar CNAME de `portal` a apuntar a Vercel
   - O agregar A record con IP de Vercel

3. **Actualizar NEXTAUTH_URL:**
   ```bash
   NEXTAUTH_URL=https://portal.rumbo.digital
   ```
   - Actualizar en Vercel → Settings → Environment Variables
   - Redeploy

---

## 📊 Diferencias: Vercel vs Cloudflare Tunnel

| Aspecto | Vercel | Cloudflare Tunnel |
|---------|--------|-------------------|
| **Deployment** | Build + Deploy automático | Tu localhost expuesto |
| **Disponibilidad** | 24/7 (servidor de Vercel) | Solo cuando tu PC está prendido |
| **Performance** | CDN global, muy rápido | Depende de tu internet |
| **Costo** | Gratis (plan Hobby) | Gratis |
| **Uso recomendado** | **Producción** | Testing/demos temporales |

---

## ✅ Workflow Recomendado

### Para Desarrollo
```bash
npm run dev  # Trabajar en localhost:3000
```

### Para Testing con Cliente (Rápido)
```bash
# Opción 1: Esperar auto-deploy de Vercel (2-3 min después de push)
git push origin main

# Opción 2: Tunnel inmediato (si cliente está esperando)
cloudflared tunnel run portal-rumbo
```

### Para Producción
```bash
# Push a main → Deploy automático en Vercel
git push origin main
```

---

## 📚 Recursos

- **Dashboard Vercel:** https://vercel.com/dashboard
- **Documentación Vercel:** https://vercel.com/docs
- **Vercel CLI (opcional):** https://vercel.com/docs/cli

---

## 📝 Notas

- **Auto-deploy:** Cada push a `main` hace deploy automático
- **Preview deploys:** Pull Requests generan URLs de preview
- **Rollback:** Se puede volver a un deploy anterior desde el dashboard
- **Logs:** Ver logs en tiempo real en el dashboard de Vercel

---

**Última actualización:** 19 de enero de 2026  
**Pendiente:** Verificar URL exacta del proyecto en Vercel
