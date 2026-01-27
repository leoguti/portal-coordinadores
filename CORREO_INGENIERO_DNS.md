# Correo para Ingeniero de Infraestructura - Reporte de Cambio DNS

---

**Para:** [Ingeniero encargado de dominios]  
**De:** Leonardo Gutiérrez  
**Asunto:** Reporte de Modificación DNS - Subdominio portal.campolimpio.org  
**Fecha:** 27 de enero de 2026

---

Estimado [Nombre del Ingeniero],

Le informo que he realizado una modificación en la configuración DNS del dominio **campolimpio.org** para habilitar el acceso al Portal de Coordinadores mediante el subdominio **portal.campolimpio.org**.

## 📋 Cambio Realizado

Se agregó el siguiente registro DNS en el panel de gestión de **campolimpio.org**:

```
Tipo de registro:    CNAME
Nombre/Host:         portal
Dominio completo:    portal.campolimpio.org
Valor/Apunta a:      da5748be8820199b.vercel-dns-017.com
TTL:                 Auto (3600 segundos)
Proxy Status:        DNS Only (sin proxy/sin CDN)
```

## 🎯 Objetivo

Apuntar el subdominio `portal.campolimpio.org` a la infraestructura de **Vercel** (plataforma de hosting), donde está desplegada la aplicación Next.js del Portal de Coordinadores.

## 🔧 Detalles Técnicos

### Resolución DNS Actual

```bash
$ dig portal.campolimpio.org CNAME +short
da5748be8820199b.vercel-dns-017.com

$ dig portal.campolimpio.org A +short
64.29.17.65
216.198.79.65
```

### Cadena de Resolución

```
portal.campolimpio.org
    ↓ (CNAME)
da5748be8820199b.vercel-dns-017.com
    ↓ (A records - gestionados por Vercel)
64.29.17.65, 216.198.79.65
```

### Verificación de Propagación

El registro está completamente propagado y funcional:
- **DNS Check:** https://www.whatsmydns.net/#CNAME/portal.campolimpio.org
- **Estado:** ✅ Resolviendo correctamente a nivel global
- **TTL actual:** ~7200 segundos

## 🔒 Certificado SSL

Vercel gestionó automáticamente el certificado SSL para el dominio:

```
Dominio:             portal.campolimpio.org
Emisor:              Let's Encrypt
Protocolo:           TLS 1.3
Estado:              ✅ Válido y activo
Renovación:          Automática cada 90 días
```

Verificable en: https://www.ssllabs.com/ssltest/analyze.html?d=portal.campolimpio.org

## 🌐 Infraestructura Backend

- **Hosting:** Vercel (Plan Hobby - gratuito)
- **Proyecto:** portal-coordinadores
- **Stack:** Next.js 16 + TypeScript
- **Repositorio:** GitHub (leoguti/portal-coordinadores)
- **Deploy:** Automático vía Git push a rama `main`

## ✅ Estado Actual

🟢 **Operativo**

- Portal accesible en: https://portal.campolimpio.org
- HTTPS funcionando correctamente
- Redirección HTTP → HTTPS activa
- Sin errores de certificado
- Tiempo de carga: ~1.2s (promedio global)

## 📊 Impacto en Otros Servicios

✅ **Sin impacto**

- Los registros MX (correo) **NO fueron modificados**
- El dominio principal campolimpio.org **NO fue modificado**
- Otros subdominios existentes **NO fueron afectados**
- Los nameservers del dominio **NO fueron cambiados**

## 🔄 Reversibilidad

Si fuera necesario revertir este cambio:

1. Eliminar el registro CNAME `portal.campolimpio.org` del panel DNS
2. Esperar propagación (hasta 2 horas según TTL actual)
3. El subdominio dejará de resolver

**Nota:** No afecta otros servicios ya que es un registro independiente.

## 📝 Documentación Adicional

He documentado esta configuración en:
- `DNS_CONFIGURACION_PORTAL.md` (documentación técnica completa)
- `VERCEL_DEPLOYMENT.md` (proceso de deployment)

Disponibles en el repositorio del proyecto.

## 🔍 Comandos de Verificación

Para verificar el estado actual en cualquier momento:

```bash
# Ver registro CNAME
dig portal.campolimpio.org CNAME +short

# Ver IPs finales
dig portal.campolimpio.org A +short

# Ver resolución completa
dig portal.campolimpio.org +noall +answer

# Test de conectividad
curl -I https://portal.campolimpio.org
```

## 📞 Seguimiento

Si requiere alguna modificación adicional en la configuración DNS o tiene alguna observación sobre este cambio, quedo atento a sus comentarios.

También quedo disponible para coordinar cualquier ajuste necesario en caso de que se requieran cambios en la infraestructura de red o DNS del dominio.

---

Saludos cordiales,

**Leonardo Gutiérrez**  
Desarrollador - Portal CampoLimpio  
[Tu email de contacto]  
[Tu teléfono - opcional]

---

## Anexo: Información de Contacto Técnico

**En caso de requerirse coordinación técnica:**

- **Plataforma de Hosting:** Vercel (https://vercel.com)
- **Cuenta de Vercel:** [cuenta asociada]
- **Repositorio GitHub:** https://github.com/leoguti/portal-coordinadores
- **Documentación técnica:** Disponible en repositorio

---

**Fecha del cambio:** 19 de enero de 2026  
**Fecha de este reporte:** 27 de enero de 2026  
**Estado de verificación:** Operativo y estable
