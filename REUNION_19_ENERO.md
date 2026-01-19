# Reunión con Cliente - 19 de Enero 2026

## Contexto
- **Urgencia**: Cliente necesita comenzar a consultar información YA
- **Objetivo**: Evitar acumulación de trabajo
- **Prioridad crítica**: Generar órdenes de servicio

## Tareas Priorizadas (en orden)

### 🔴 PRIORIDAD 1: Chatbot
- [x] **BUG**: Revisar opciones del chatbot - Oscar (coordinador) reporta que aparecen 4 opciones cuando solo deberían ser 3 ✅ **SOLUCIONADO**

### 🔴 PRIORIDAD 2: Órdenes de Servicio
- [x] Revisar proceso completo de órdenes de servicio ✅
- [x] Implementar subida de PDF a Airtable (Vercel Blob Storage) ✅ **FUNCIONA**
- [x] Validación y captura de datos de Terceros ✅ **FUNCIONA**
- [x] Habilitar envío automático de órdenes por correo electrónico ✅ **FUNCIONA**
- [ ] **DEFINIR**: Migrar email remitente para órdenes de servicio
  - **Actualmente usa:** info@rumbo.digital (SMTP: smtpout.secureserver.net)
  - **Debe cambiar a:** facturaelectronica@campolimpio.org
  - Requiere configurar SMTP y actualizar variables de entorno
- [ ] **DEFINIR**: Migrar URL del portal
  - **Actualmente:** portal.rumbo.digital
  - **Debe cambiar a:** portal.campolimpio.org
  - Requiere configurar dominio en Vercel

### 🔴 PRIORIDAD 3: Documentación
- [ ] Generar manual de interacciones (Chatbot + Órdenes de Servicio)

### 🟡 PENDIENTE (Menor prioridad)
- [ ] **VALIDAR CON CLIENTE**: Confirmar si se debe agregar funcionalidad para editar y mantener las ubicaciones de fincas
- [ ] **BUG**: Revisar Certificado No. 88167 - Problema de visualización en el agrupamiento

### 🔵 OPTIMIZACIÓN AIRTABLE
- [ ] **CRÍTICO**: Hacer backup de registros antiguos y borrarlos de Airtable
  - Objetivo: Liberar espacio y evitar costos por registros viejos
  - Prioridad: Certificados muy antiguos
  - Proceso: Exportar → Guardar backup → Eliminar de Airtable
  - Evitar pagar por registros que exceden límites del plan

---
*Notas tomadas durante sesión de trabajo*
