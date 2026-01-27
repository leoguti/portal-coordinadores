# Configuración DNS - portal.campolimpio.org

## 📋 Resumen Ejecutivo

El subdominio **portal.campolimpio.org** está configurado con un registro **CNAME** que apunta a los servidores de Vercel, permitiendo que el Portal de Coordinadores sea accesible públicamente con SSL/HTTPS automático.

---

## 🌐 Detalles de la Configuración DNS

### Registro CNAME Principal

```
Tipo:       CNAME
Nombre:     portal
Dominio:    campolimpio.org
Apunta a:   da5748be8820199b.vercel-dns-017.com
TTL:        7194 segundos (~2 horas)
```

### Resolución Completa

Cuando un usuario accede a **portal.campolimpio.org**, el DNS resuelve de la siguiente manera:

```
portal.campolimpio.org 
    ↓ (CNAME)
da5748be8820199b.vercel-dns-017.com
    ↓ (A records)
64.29.17.65
216.198.79.65
```

### IPs Finales (Vercel)

El dominio resuelve a dos direcciones IP de Vercel para redundancia:
- **IP 1:** `64.29.17.65`
- **IP 2:** `216.198.79.65`

---

## 📝 ¿Qué se Configuró?

### 1. En el Panel DNS de campolimpio.org

Se agregó un registro **CNAME** con los siguientes valores:

| Campo | Valor |
|-------|-------|
| **Tipo de registro** | CNAME |
| **Host/Nombre** | `portal` |
| **Apunta a** | `da5748be8820199b.vercel-dns-017.com` |
| **TTL** | Automático (o 3600 segundos) |
| **Proxy status** | DNS only (sin proxy) |

### 2. En Vercel Dashboard

En el proyecto de Vercel (portal-coordinadores):

1. Se agregó el dominio custom: **portal.campolimpio.org**
2. Vercel generó automáticamente el valor CNAME: `da5748be8820199b.vercel-dns-017.com`
3. Se configuró el certificado SSL automático (Let's Encrypt)
4. Se actualizó la variable de entorno: `NEXTAUTH_URL=https://portal.campolimpio.org`

---

## ✅ Beneficios de Esta Configuración

### 1. **SSL/HTTPS Automático**
- Vercel maneja automáticamente los certificados SSL
- Renovación automática sin intervención manual
- Navegadores muestran el candado verde de seguridad

### 2. **CDN Global de Vercel**
- El portal se sirve desde múltiples ubicaciones globales
- Carga rápida para usuarios en cualquier parte del mundo
- Baja latencia para usuarios en Colombia

### 3. **Alta Disponibilidad**
- Múltiples IPs para redundancia (64.29.17.65 y 216.198.79.65)
- Si un servidor falla, el otro responde automáticamente
- Uptime de 99.9%+

### 4. **Deployment Automático**
- Cada cambio en el código se publica automáticamente
- Sin necesidad de configurar servidores manualmente
- Rollback inmediato si hay problemas

### 5. **Sin Costo**
- Plan gratuito de Vercel (Hobby)
- SSL incluido sin costo
- Ancho de banda generoso

---

## 🔒 Seguridad

### Certificado SSL

```
Dominio:        portal.campolimpio.org
Emisor:         Let's Encrypt
Tipo:           TLS 1.3
Validación:     Automática por Vercel
Renovación:     Automática cada 90 días
```

### Headers de Seguridad

Vercel configura automáticamente:
- **HTTPS Redirect**: Todo tráfico HTTP se redirige a HTTPS
- **HSTS**: Fuerza HTTPS en navegadores
- **X-Frame-Options**: Protección contra clickjacking
- **X-Content-Type-Options**: Protección contra MIME sniffing

---

## 🔧 Mantenimiento

### ¿Qué NO Necesita Mantenimiento?

✅ **Certificado SSL** - Renovación automática  
✅ **IPs de Vercel** - Actualizadas automáticamente si cambian  
✅ **Uptime** - Monitoreado por Vercel  
✅ **Backups** - Código en GitHub como respaldo  

### ¿Qué Revisar Periódicamente?

🔍 **Cada 6 meses:**
- Verificar que el dominio campolimpio.org no expire
- Confirmar que el registro CNAME sigue activo
- Revisar dashboard de Vercel para alertas

---

## 📊 Verificación de Estado

### Comandos para Verificar DNS

```bash
# Ver registro CNAME
dig portal.campolimpio.org CNAME +short
# Resultado esperado: da5748be8820199b.vercel-dns-017.com

# Ver IPs finales
dig portal.campolimpio.org A +short
# Resultado esperado: 64.29.17.65 y 216.198.79.65

# Verificar propagación completa
dig portal.campolimpio.org +noall +answer
```

### Herramientas Online

- **Verificar DNS global:** https://www.whatsmydns.net/#CNAME/portal.campolimpio.org
- **Verificar SSL:** https://www.ssllabs.com/ssltest/analyze.html?d=portal.campolimpio.org
- **Status de Vercel:** https://www.vercel-status.com/

---

## 📧 Correo Electrónico Modelo para Cliente

---

**Asunto:** Configuración DNS - Portal de Coordinadores (portal.campolimpio.org)

Estimado cliente,

Le compartimos los detalles técnicos de la configuración DNS implementada para el Portal de Coordinadores:

**Dominio configurado:** https://portal.campolimpio.org

### Registro DNS Configurado:

En el panel DNS de **campolimpio.org** se configuró el siguiente registro:

```
Tipo:       CNAME
Subdominio: portal
Apunta a:   da5748be8820199b.vercel-dns-017.com
```

### ¿Qué hace este registro?

Este registro CNAME funciona como un "alias" que apunta su subdominio `portal.campolimpio.org` a los servidores de Vercel (plataforma de hosting). Cuando alguien accede a portal.campolimpio.org, el DNS automáticamente lo redirige a los servidores de Vercel donde está alojada la aplicación.

### IPs finales de Vercel:

El dominio resuelve a las siguientes direcciones IP (manejadas automáticamente por Vercel):
- 64.29.17.65
- 216.198.79.65

### Ventajas de esta configuración:

✅ **Certificado SSL/HTTPS automático** (seguridad incluida, sin costo adicional)  
✅ **CDN global** (carga rápida desde cualquier ubicación)  
✅ **Alta disponibilidad** (99.9%+ uptime)  
✅ **Deployment automático** (actualizaciones sin intervención manual)  
✅ **Sin costo** (plan gratuito de Vercel)  

### Mantenimiento:

Esta configuración **NO requiere mantenimiento** rutinario. Vercel maneja automáticamente:
- Renovación de certificados SSL
- Actualización de IPs si fuera necesario
- Monitoreo de uptime

Lo único que debe verificarse es que el dominio principal (campolimpio.org) no expire con su proveedor de dominios.

### Estado actual:

🟢 **Activo y funcionando correctamente**

El portal es accesible en: https://portal.campolimpio.org

---

Si tiene alguna pregunta sobre esta configuración, quedo a su disposición.

Saludos cordiales,  
[Tu nombre]

---

## 📚 Referencias Técnicas

- **Vercel Domains:** https://vercel.com/docs/concepts/projects/domains
- **DNS CNAME Records:** https://www.cloudflare.com/learning/dns/dns-records/dns-cname-record/
- **Let's Encrypt SSL:** https://letsencrypt.org/

---

**Fecha de configuración:** 19 de enero de 2026  
**Estado:** ✅ Activo y funcionando  
**Última verificación:** 27 de enero de 2026
