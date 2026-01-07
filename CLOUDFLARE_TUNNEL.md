# Cloudflare Tunnel - Portal Coordinadores

## 📋 Configuración Actual

**Dominio:** `portal.rumbo.digital`  
**Túnel ID:** `46d5071d-9261-4fc5-8ea9-175f32f72d3e`  
**DNS:** Cloudflare (nameservers cambiados desde GoDaddy)

---

## 🚀 Iniciar el Portal (Completo)

### 1. Iniciar Next.js
```bash
cd /home/leonardo-gutierrez/portal-campolimpio
npm run dev
```

### 2. Iniciar Cloudflare Tunnel (en otra terminal)
```bash
cloudflared tunnel run portal-rumbo
```

### 3. Acceder
**URL Pública:** https://portal.rumbo.digital  
**URL Local:** http://localhost:3000

---

## 🔧 Configuración de Variables de Entorno

**Archivo:** `.env.local`

```bash
# Para producción (con túnel)
NEXTAUTH_URL=https://portal.rumbo.digital

# Para desarrollo local (sin túnel)
NEXTAUTH_URL=http://localhost:3000
```

**⚠️ Importante:** Reiniciar Next.js después de cambiar `.env.local`

---

## 📁 Archivos de Configuración

### Configuración del Túnel
**Ubicación:** `~/.cloudflared/config.yml`

```yaml
tunnel: 46d5071d-9261-4fc5-8ea9-175f32f72d3e
credentials-file: /home/leonardo-gutierrez/.cloudflared/46d5071d-9261-4fc5-8ea9-175f32f72d3e.json

ingress:
  - hostname: portal.rumbo.digital
    service: http://localhost:3000
  - service: http_status:404
```

### Credenciales del Túnel
**Ubicación:** `~/.cloudflared/46d5071d-9261-4fc5-8ea9-175f32f72d3e.json`  
🔒 **No compartir este archivo - contiene credenciales**

---

## 🔄 Comandos Útiles

### Verificar Estado del Túnel
```bash
# Ver procesos de cloudflared
ps aux | grep cloudflared

# Ver procesos de Next.js
ps aux | grep "next.*dev"
```

### Verificar DNS
```bash
# Ver nameservers actuales
dig rumbo.digital NS +short

# Ver resolución del subdominio
dig portal.rumbo.digital +short

# Probar conexión
curl -I https://portal.rumbo.digital
```

### Limpiar Caché DNS Local
```bash
sudo resolvectl flush-caches
sudo systemctl restart systemd-resolved
```

### Ver Logs del Túnel
```bash
# Si corre en foreground, los logs aparecen en la terminal

# Si corre en background:
tail -f /tmp/cloudflared.log
```

---

## 💻 Ejecutar en Background

### Opción 1: nohup (Simple)
```bash
# Iniciar túnel en background
nohup cloudflared tunnel run portal-rumbo > /tmp/cloudflared.log 2>&1 &

# Ver PID del proceso
ps aux | grep cloudflared

# Detener (usar PID del comando anterior)
kill <PID>
```

### Opción 2: systemd (Recomendado para producción)

**Crear servicio:** `/etc/systemd/system/cloudflared-portal.service`

```ini
[Unit]
Description=Cloudflare Tunnel - Portal Coordinadores
After=network.target

[Service]
Type=simple
User=leonardo-gutierrez
ExecStart=/usr/bin/cloudflared tunnel run portal-rumbo
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

**Comandos:**
```bash
# Recargar systemd
sudo systemctl daemon-reload

# Habilitar inicio automático
sudo systemctl enable cloudflared-portal

# Iniciar servicio
sudo systemctl start cloudflared-portal

# Ver estado
sudo systemctl status cloudflared-portal

# Ver logs
sudo journalctl -u cloudflared-portal -f

# Detener
sudo systemctl stop cloudflared-portal
```

---

## 🔐 DNS en Cloudflare

### Nameservers Configurados
```
kia.ns.cloudflare.com
marek.ns.cloudflare.com
```

### Registros DNS Importantes
- **A record:** `rumbo.digital` → `143.198.74.165`
- **CNAME:** `portal` → `46d5071d-9261-4fc5-8ea9-175f32f72d3e.cfargotunnel.com`
- **MX records:** Email configurado con GoDaddy (smtp.secureserver.net)

---

## 🆘 Troubleshooting

### Error 530 (Cloudflare no puede conectar)
**Causa:** Túnel no está corriendo o Next.js no responde

**Solución:**
```bash
# 1. Verificar que Next.js esté corriendo
curl http://localhost:3000

# 2. Reiniciar túnel
cloudflared tunnel run portal-rumbo
```

### DNS no resuelve
**Causa:** Caché DNS o propagación pendiente

**Solución:**
```bash
# Limpiar caché
sudo resolvectl flush-caches

# Verificar propagación global
# https://www.whatsmydns.net/#NS/rumbo.digital
```

### "Failed to connect"
**Causa:** Firewall o puerto bloqueado

**Solución:**
```bash
# Verificar puerto 3000
sudo netstat -tlnp | grep 3000

# Verificar proceso Next.js
ps aux | grep next
```

---

## 📝 Notas Importantes

1. **Túnel Cloudflare es GRATUITO** - No hay límites de ancho de banda
2. **SSL automático** - Cloudflare maneja los certificados
3. **Sin exponer puerto** - No necesitas abrir puertos en tu firewall/router
4. **Email sigue en GoDaddy** - Registros MX no se ven afectados
5. **Dominio sigue en GoDaddy** - Solo DNS cambió a Cloudflare

---

## 🔄 Actualizar Configuración

### Cambiar hostname del túnel
```bash
# Editar archivo de configuración
nano ~/.cloudflared/config.yml

# Cambiar hostname en la sección ingress
# Reiniciar túnel
```

### Agregar más hostnames
```yaml
ingress:
  - hostname: portal.rumbo.digital
    service: http://localhost:3000
  - hostname: api.rumbo.digital
    service: http://localhost:4000
  - service: http_status:404
```

---

## 📚 Recursos

- **Dashboard Cloudflare:** https://dash.cloudflare.com
- **Documentación Cloudflare Tunnel:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **Verificar DNS Global:** https://www.whatsmydns.net

---

**Fecha de configuración:** 7 de enero de 2026  
**Configurado por:** Leonardo Gutiérrez
