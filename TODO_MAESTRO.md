# TODO Maestro — Portal CampoLimpio

**Documento unificado de todos los pendientes del proyecto.**
**Prioridad:** Lo que el cliente pidió primero, soporte técnico como habilitador.
**Última actualización:** 5 de febrero de 2026

> **Fuentes consolidadas:**
> - `REUNION_19_ENERO.md` — Reunión con cliente
> - `REUNION_COORDINADORES_26_ENERO_2026.md` — Reunión con coordinadores
> - `AUDITORIA_CLAUDE_MEJORAS.md` — Auditoría técnica (27 mejoras)

---

## Resumen de Estado

| Categoría | Pendientes | En Proceso | Completados | Descartados |
|-----------|-----------|------------|-------------|-------------|
| Compromisos cliente (P1) | 4 | 0 | 1 | 0 |
| Requests coordinadores (P2) | 2 | 0 | 4 | 1 |
| Features nuevas (P3) | 2 | 1 | 2 | 1 |
| Mejoras técnicas (P4) | 27 | 0 | 0 | 0 |
| **Total** | **35** | **1** | **7** | **2** |

---

## P1 — Compromisos con el Cliente (Reunión 19 enero)

Estos son compromisos directos adquiridos con el cliente. Son la máxima prioridad funcional.

### ~~P1-01: Foto de báscula obligatoria en kardex~~ COMPLETADO
- **Origen:** Reunión 19 ene (Prioridad 5)
- **Alcance:** Portal + Chatbot TextIt
- **Estado:** Completado
- **Detalle:**
  - [x] **Portal:** Campo obligatorio de foto de báscula en `KardexFormModal.tsx`
  - [x] **Portal:** Validación antes de guardar
  - [x] **Portal:** Indicador visual de obligatoriedad
  - [x] **Chatbot:** Flujo en TextIt exige imagen
  - [x] **Chatbot:** Mensaje de error si no se envía foto
- **Feature opcional adicional:** IA para leer automáticamente el peso de la foto con GPT-4o (prioridad baja, independiente)

### P1-02: Sistema de auditoría y trazabilidad
- **Origen:** Reunión 19 ene (Prioridad 4)
- **Estado:** No implementado
- **Detalle:**
  - [ ] Definir dónde almacenar logs (Airtable tabla nueva, servicio externo, o base de datos)
  - [ ] Registrar: login/logout de usuarios
  - [ ] Registrar: creación/edición/envío de órdenes de servicio
  - [ ] Registrar: cambios de estado en órdenes
  - [ ] Registrar: envío de emails (destinatario, fecha, estado)
  - [ ] Registrar: errores y excepciones
  - [ ] Crear interfaz para consultar logs
  - [ ] Exportación de logs para análisis
- **Nota:** Se cruza con mejora técnica M-19 (logging estructurado) y M-20 (Sentry). Implementar M-19 y M-20 como base técnica, luego agregar la capa de auditoría de negocio encima.

### P1-03: Manual de interacciones
- **Origen:** Reunión 19 ene (Prioridad 3)
- **Estado:** No implementado
- **Detalle:**
  - [ ] Documentar flujo completo del Chatbot (paso a paso con capturas)
  - [ ] Documentar flujo completo de Órdenes de Servicio
  - [ ] Formato: PDF o página web accesible para coordinadores
- **Nota:** Este manual también es insumo necesario para el chatbot de soporte IA (P3-05).

### P1-04: Backup y limpieza de registros antiguos en Airtable
- **Origen:** Reunión 19 ene (Optimización) + TODO_PORTAL.md
- **Estado:** No implementado
- **Detalle:**
  - [ ] Identificar tablas con más registros (Certificados es la prioridad)
  - [ ] Definir criterio de antigüedad (registros de qué fecha hacia atrás)
  - [ ] Crear script de exportación (Airtable → CSV/JSON backup)
  - [ ] Ejecutar backup
  - [ ] Eliminar registros antiguos de Airtable
  - [ ] Documentar proceso para repetirlo periódicamente
- **Urgencia:** Evitar costos adicionales por exceso de registros en plan de Airtable.

### P1-05: Migrar correo de órdenes al gestor
- **Origen:** Reunión coordinadores 26 ene (Johan)
- **Estado:** Por verificar
- **Detalle:**
  - [ ] Verificar que las órdenes de servicio lleguen al correo del gestor (no solo al coordinador)
  - [ ] Revisar si los gestores/proveedores tienen campo de correo en Airtable
  - [ ] Si falta, agregar campo de correo a la tabla de Gestores
  - [ ] Modificar flujo de envío para incluir al gestor como destinatario

---

## P2 — Requests de Coordinadores (Reunión 26 enero)

Problemas y necesidades reportados directamente por los usuarios en la reunión del 26 de enero.

### ~~P2-01: Vista administrador para TODAS las órdenes de servicio~~ COMPLETADO
- **Origen:** Reunión coordinadores 26 ene
- **Reporta:** Administradores
- **Estado:** Completado
- **Detalle:**
  - [x] En `/ordenes-servicio`, si el usuario es Administrador, mostrar órdenes de todos los coordinadores
  - [x] Filtro por coordinador en vista admin
  - [x] Vista filtrada por coordinador actual si el usuario es Coordinador

### P2-02: Visibilidad de estados post-pago para coordinadores
- **Origen:** Reunión coordinadores 26 ene
- **Reporta:** Coordinadores
- **Estado:** No implementado
- **Detalle:**
  - [ ] Los estados "Rechazada" y "Pagada" deben ser visibles para coordinadores
  - [ ] Verificar que la tabla de Órdenes en Airtable tenga estos estados
  - [ ] Mostrarlos con badge de color en la lista de órdenes
  - [ ] Posible: notificación al coordinador cuando cambia el estado

### ~~P2-03: Proveedor ATICA con múltiples sucursales~~ DESCARTADO
- **Estado:** Descartado — no se implementará

### P2-04: Confirmación exitosa al registrar actividades
- **Origen:** Reunión coordinadores 26 ene
- **Estado:** No implementado
- **Detalle:**
  - [ ] Al guardar una actividad exitosamente, mostrar modal/toast de confirmación
  - [ ] Incluir: nombre de la actividad, fecha, municipio
  - [ ] Botón para "Crear otra" o "Ver actividad"
- **Nota:** El kardex YA tiene confirmación (implementado 26 ene). Replicar el mismo patrón para actividades.

### ~~P2-05: Control de sesión única~~ COMPLETADO
- **Origen:** Reunión coordinadores 26 ene
- **Estado:** Completado

### ~~P2-06: Material que no suma en kardex~~ COMPLETADO
- **Origen:** Reunión coordinadores 26 ene
- **Estado:** Completado

### ~~P2-07: Investigar problema de fotos en actividades (Andrés)~~ COMPLETADO
- **Origen:** Reunión coordinadores 26 ene
- **Estado:** Completado / Resuelto
- **Detalle:**
  - [x] Investigado y resuelto

---

## P3 — Features Nuevas (Backlog)

Features solicitadas por el cliente pero sin fecha de entrega comprometida.

### ~~P3-01: Filtrar centros de acopio por coordinador~~ COMPLETADO
- **Origen:** TODO_PORTAL.md + TODO_CENTROS_ACOPIO_POR_COORDINADOR.md
- **Estado:** Completado
- **Detalle:**
  - [x] Backend: crear `getCentrosAcopioPorCoordinador()` en `lib/airtable.ts`
  - [x] API: modificar GET `/api/centros-acopio` para aceptar `coordinatorId`
  - [x] Frontend: `KardexFormModal.tsx` envía `coordinatorRecordId` al fetch
  - [x] Chatbot: validar centro pertenece al coordinador antes de crear kardex
  - [x] Testing: coordinador A no puede usar centros de coordinador B

### ~~P3-02: Saldos centros de acopio para coordinadores~~ COMPLETADO
- **Origen:** Reunión 19 ene + TODO_PORTAL.md
- **Estado:** Completado
- **Detalle:**
  - [x] Habilitar vista de saldos para coordinadores (filtrada a sus centros)
  - [x] Mostrar: saldo actual por material, historial de movimientos
  - [x] Filtros y búsqueda

### P3-03: Interfaz de caja menor 🔄 EN PROCESO
- **Origen:** Reunión 19 ene + TODO_PORTAL.md
- **Prioridad:** Media
- **Estado:** En proceso — hay tareas pendientes
- **Detalle:**
  - [x] Definir schema con el cliente (qué campos, qué flujo)
  - [x] Crear tabla en Airtable (o verificar si ya existe)
  - [x] Crear página `/caja-menor` con CRUD completo
  - [ ] Tareas pendientes por definir

### P3-04: Interfaz de edición de ubicaciones de fincas
- **Origen:** Reunión 19 ene + TODO_PORTAL.md
- **Prioridad:** Media
- **Estado:** No implementado
- **Detalle:**
  - [ ] TODOS los usuarios pueden editar TODAS las ubicaciones (sin restricción por usuario)
  - [ ] Crear interfaz para gestionar ubicaciones
  - [ ] CRUD completo

### ~~P3-05: Chatbot de soporte IA~~ DESCARTADO
- **Estado:** Descartado — no se implementará
- **Razón:** Decisión de proyecto

### P3-07: Exportar .zip de órdenes de servicio filtradas
- **Origen:** Requerimiento de auditoría fiscal (30 ene 2026)
- **Prioridad:** Media
- **Estado:** No implementado
- **Detalle:**
  - [ ] Desde la lista de órdenes de servicio, permitir exportar las órdenes filtradas como archivo .zip
  - [ ] El .zip debe incluir los PDFs de las órdenes y las facturas asociadas
  - [ ] Respetar los filtros activos (coordinador, beneficiario, estado, mes)
  - [ ] Útil para auditoría fiscal: entregar paquete completo de soportes
- **Nota:** Evaluar si incluir también fotos de báscula de los kardex vinculados

### P3-06: Interfaz de certificados
- **Origen:** Reunión 19 ene + TODO_PORTAL.md
- **Prioridad:** Baja (pendiente definir alcance con cliente)
- **Estado:** Placeholder en `/certificados`
- **Detalle:**
  - [ ] Reunión con cliente para definir alcance
  - [ ] Posibles funciones: visualización, búsqueda, filtros, descarga, agrupamiento
  - [ ] Bug certificado #88167 — problema de visualización en agrupamiento

---

## P4 — Mejoras Técnicas (Auditoría)

Hallazgos de la auditoría técnica. No son pedidos del cliente pero habilitan la calidad y sostenibilidad del producto. Detalle completo en `AUDITORIA_CLAUDE_MEJORAS.md`.

### P4-A: Bloqueadores (resolver antes de producción formal)

| ID | Mejora | Impacto |
|----|--------|---------|
| M-01 | Sidebar responsive (menú hamburguesa móvil) | Los coordinadores en campo usan celular |
| M-02 | Middleware.ts para protección global de rutas | Rutas podrían quedar expuestas sin auth |
| M-03 | Validación de inputs con Zod en API routes | Datos malformados pueden corromper Airtable |
| M-04 | Fix SSRF en image-proxy (whitelist dominios) | Vulnerabilidad de seguridad activa |
| M-05 | Protección CSRF en endpoints mutantes | Requests maliciosas pueden ejecutar acciones |
| M-06 | Rate limiting en magic links | Email bombing posible |

**Estado:** Ninguno implementado.

### P4-B: Corto plazo (primeras semanas)

| ID | Mejora | Impacto |
|----|--------|---------|
| M-07 | Componentes base UI (Button, Input, Badge, Toast) | Consistencia visual |
| M-08 | Sistema de toast (reemplazar alert()) | UX profesional |
| M-09 | Validación inline por campo en formularios | Reduce errores de usuario |
| M-10 | Breadcrumbs en navegación | Orientación del usuario |
| M-11 | Desactivar EMAIL_TO_OVERRIDE en prod | Prevenir redirección accidental |
| M-12 | Tests para API routes críticos | Confiabilidad |
| M-13 | Tests para reglas de negocio | Prevenir regresiones |

### P4-C: Mediano plazo

| ID | Mejora | Impacto |
|----|--------|---------|
| M-14 | Dividir lib/airtable.ts (2108 líneas) en módulos | Mantenibilidad |
| M-15 | Extraer magic strings a constantes | Evitar errores de typo |
| M-16 | Optimizar queries con filterByFormula | Performance con datos crecientes |
| M-17 | Lazy loading de imágenes | Velocidad de carga |
| M-18 | TTL en cache de municipios/terceros | Datos actualizados sin restart |
| M-19 | Logging estructurado (pino) | Base para P1-02 (auditoría) |
| M-20 | Monitoreo de errores (Sentry) | Detectar problemas proactivamente |
| M-21 | Configuración de despliegue | Despliegues confiables |
| M-22 | Health check endpoint | Monitoreo de disponibilidad |
| M-23 | Validación de env vars al arrancar | Prevenir arranques rotos |

### P4-D: Mejoras continuas

| ID | Mejora | Impacto |
|----|--------|---------|
| M-24 | Migrar emojis a lucide-react | Apariencia profesional |
| M-25 | Mejoras de accesibilidad (ARIA) | Inclusión |
| M-26 | Vista de tarjetas en tablas para móvil | UX móvil |
| M-27 | Soporte dark mode | Preferencia de usuario |

---

## Dependencias entre pendientes

```
P4-M19 (Logging) ───────────► P1-02 (Sistema auditoría)
P4-M20 (Sentry)  ───────────►  │
                                  │
P3-01 (Filtro centros) ─────► P3-02 (Saldos coordinador)
                                  │
P4-M01 (Responsive) ────────► P4-M26 (Tarjetas móvil)
                                  │
P4-M07 (Componentes UI) ────► P4-M08 (Toasts)
                              ► P2-04 (Confirmación actividades)
```

**Lectura:** Implementar primero lo que está a la izquierda de la flecha.

---

## Orden de Ejecución Recomendado

### Sprint 1 — Lo urgente del cliente + bloqueadores críticos
1. ~~**P1-01** — Foto de báscula obligatoria~~ COMPLETADO
2. ~~**P3-01** — Filtro centros por coordinador~~ COMPLETADO
3. ~~**P2-01** — Vista admin para todas las órdenes~~ COMPLETADO
4. **P2-02** — Estados post-pago visibles
5. **M-01** — Responsive sidebar (coordinadores usan celular)
6. **M-04** — Fix SSRF image-proxy (vulnerabilidad activa)

### Sprint 2 — Experiencia de coordinadores
7. **P2-04** — Confirmación al registrar actividades
8. **P1-05** — Correo de órdenes al gestor
9. ~~**P2-06** — Investigar material que no suma~~ COMPLETADO
10. ~~**P2-07** — Investigar fotos de Andrés~~ COMPLETADO
11. ~~**P2-03** — Proveedor ATICA múltiples sucursales~~ DESCARTADO
12. **M-02** — Middleware de autenticación global
13. **M-03** — Validación de inputs con Zod

### Sprint 3 — Infraestructura y auditoría
14. **M-05** — CSRF
15. **M-06** — Rate limiting
16. **M-11** — Desactivar EMAIL_TO_OVERRIDE en prod
17. **M-19** — Logging estructurado (prerequisito de P1-02)
18. **M-20** — Sentry
19. **P1-02** — Sistema de auditoría (sobre M-19 y M-20)

### Sprint 4 — Features de negocio
20. ~~**P3-02** — Saldos centros para coordinadores~~ COMPLETADO
21. **P3-03** — Interfaz caja menor 🔄 EN PROCESO
22. **P3-04** — Edición ubicaciones fincas
23. **P1-04** — Backup y limpieza Airtable

### Sprint 5 — Documentación y soporte
24. **P1-03** — Manual de interacciones
25. ~~**P3-05** — Chatbot soporte IA~~ DESCARTADO
26. ~~**P2-05** — Control sesión única~~ COMPLETADO

### Sprint 6 — Calidad y deuda técnica
27. **M-07** — Componentes base UI
28. **M-08** — Sistema de toasts
29. **M-09** — Validación inline formularios
30. **M-10** — Breadcrumbs
31. **M-14** — Dividir airtable.ts en módulos
32. **M-12/M-13** — Tests

### Backlog (sin sprint asignado)
- **P3-06** — Certificados (pendiente definir alcance)
- **M-15 a M-18** — Optimizaciones de código y performance
- **M-21 a M-27** — Mejoras continuas

---

## Completado Recientemente (referencia)

### 30 enero 2026
- [x] Fix webhook kardex en TextIt: campo EstadoPago no se enviaba en el body principal (siempre quedaba "Por Pagar"). Corregido con tres expresiones @(if()) separadas comparando estadopago_num como string.

### 27 enero 2026
- [x] Fix bug timezone en fechas kardex (22312eb)
- [x] Conciliación automática de kardex (ENTRADA/SALIDA)
- [x] Borrado en cascada con conciliación
- [x] Fix mapeo origenTipo
- [x] Fix TypeScript optional chaining en DELETE (a4155db)
- [x] Documentación DNS

### 26 enero 2026
- [x] Filtros para coordinadores (mes, año, municipio, tipo)
- [x] Modal confirmación kardex con consecutivo y resumen
- [x] Fix validación municipio en SALIDAS desde centro de acopio
- [x] Paridad portal-bot para municipio de centro de acopio

### 19 enero 2026
- [x] Órdenes de servicio completas (CRUD + PDF + email)
- [x] Subida PDF a Airtable vía Vercel Blob
- [x] Validación y captura de terceros
- [x] Email configurado con certificados@campolimpio.org
- [x] Migración dominio a portal.campolimpio.org
- [x] Fix opciones chatbot (4→3)

---

## Archivos de referencia

| Archivo | Para qué usarlo |
|---------|-----------------|
| `AUDITORIA_CLAUDE_MEJORAS.md` | Detalle técnico de las 27 mejoras M-01 a M-27 (archivos, soluciones, schemas) |
| `REUNION_19_ENERO.md` | Contexto de compromisos con cliente |
| `REUNION_COORDINADORES_26_ENERO_2026.md` | Contexto de problemas reportados por usuarios |
| `docs/REGLAS_NEGOCIO_KARDEX.md` | Reglas de negocio del kardex |
| `docs/AIRTABLE_SCHEMA.md` | Schema completo de Airtable |

---

*Documento consolidado el 29 de enero de 2026. Actualizar este documento cuando se complete o agregue un pendiente.*
