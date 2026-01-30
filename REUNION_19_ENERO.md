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
- [x] **DEFINIR**: Migrar email remitente para órdenes de servicio ✅ **COMPLETADO Y EN PRODUCCIÓN**
  - **Solución**: Usar `certificados@campolimpio.org` (con contraseña de aplicación)
  - **From**: `facturaelectronica@campolimpio.org` (aparece como remitente)
  - **Autenticación**: SMTP con contraseña de aplicación de Google
  - ✅ Configurado en Vercel con variables de entorno
  - ✅ Funcionando correctamente en producción
  - ✅ Magic links y órdenes de servicio enviándose correctamente
- [x] **DEFINIR**: Migrar URL del portal ✅ **MIGRADO**
  - **Antes:** portal.rumbo.digital
  - **Ahora:** portal.campolimpio.org
  - ✅ Dominio configurado en Vercel

### 🔴 PRIORIDAD 3: Documentación
- [ ] Generar manual de interacciones (Chatbot + Órdenes de Servicio)

### 🔴 PRIORIDAD 4: Sistema de Auditoría
- [ ] **Crear sistema de registros de auditoría para trazabilidad**
  - Registrar acciones importantes del sistema
  - Login/logout de usuarios
  - Creación/edición/envío de órdenes de servicio
  - Cambios de estado en órdenes
  - Envío de emails (con destinatario, fecha, estado)
  - Errores y excepciones
  - Opciones de implementación:
    - Base de datos (SQLite local o PostgreSQL)
    - Servicio externo (Logtail, Sentry)
    - Tabla en Airtable
  - Interfaz para consultar logs
  - Exportación de logs para análisis

### 🔴 PRIORIDAD 5: Fotografía de Báscula en Kardex (OBLIGATORIA)
- [ ] **Chatbot**: Hacer obligatoria la fotografía de la báscula en registro de kardex
  - Modificar flujo en TextIt para exigir imagen
  - Validar que la imagen se reciba antes de continuar
  - Mensaje de error si no se envía foto
- [ ] **Portal**: Agregar campo obligatorio de foto de báscula en interfaz de kardex
  - Crear/modificar formulario de registro de kardex
  - Campo de imagen requerido con validación
  - Subida y almacenamiento en Airtable

### 🟡 PENDIENTE (Media prioridad)
- [ ] **NUEVA FUNCIONALIDAD**: Saldos de Centros de Acopio para Coordinadores
  - Mostrar saldos de centros de acopio a coordinadores
  - Vista por centro de acopio
  - Filtros y búsqueda
  - Historial de movimientos

- [ ] **NUEVA FUNCIONALIDAD**: Interfaz de Caja Menor
  - Crear interfaz completa en el portal
  - Gestión de gastos de caja menor
  - Registro, consulta y reportes

- [ ] **NUEVA FUNCIONALIDAD**: Interfaz de edición de ubicaciones de fincas
  - Requisito: Todos los usuarios pueden editar todas las ubicaciones
  - Crear interfaz completa para gestionar ubicaciones
  - Permitir edición sin restricciones por usuario

- [ ] **NUEVA FUNCIONALIDAD**: Interfaz de Certificados
  - **Por definir** con cliente qué incluye la interfaz
  - Posibles funciones: visualización, búsqueda, filtros, descarga, agrupamiento
  - Pendiente de reunión para definir alcance

- [ ] **BUG**: Revisar Certificado No. 88167 - Problema de visualización en el agrupamiento

### 🔵 OPTIMIZACIÓN AIRTABLE
- [ ] **CRÍTICO**: Hacer backup de registros antiguos y borrarlos de Airtable
  - Objetivo: Liberar espacio y evitar costos por registros viejos
  - Prioridad: Certificados muy antiguos
  - Proceso: Exportar → Guardar backup → Eliminar de Airtable
  - Evitar pagar por registros que exceden límites del plan

---
*Notas tomadas durante sesión de trabajo*
