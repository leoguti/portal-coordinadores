# Notas de Reunión - 23 de Diciembre 2024

**Fecha**: 23 de diciembre de 2024  
**Tema**: Revisión Órdenes de Servicio - Portal Coordinadores  
**Usuario de prueba**: cundinamarca@campolimpio.org (Andrea Villarraga)

---

## ✅ Lo que Ya Funciona

### Nueva Orden de Servicio
- ✅ Formulario completo para crear órdenes
- ✅ Visualización de Kardex "Por Pagar" con barras de colores por material
- ✅ Peso total destacado como información principal
- ✅ Búsqueda rápida de beneficiarios (terceros) con autocompletado
- ✅ Paginación de 20 Kardex por página (ordenados del más antiguo al más reciente)
- ✅ Dos opciones: "Guardar Borrador" o "Crear y Enviar"
- ✅ **Tabla resumen estilo factura** con beneficiario, items y totales

### Edición de Órdenes Borrador
- ✅ Ver y editar órdenes en estado "Borrador"
- ✅ Modificar fecha, beneficiario y observaciones
- ✅ Editar precios y forma de cobro de cada Kardex
- ✅ **Eliminar Kardex** de la orden (incluso todos si es necesario)
- ✅ **Agregar más Kardex** a la orden existente
- ✅ Paginación de Kardex disponibles (20 por página)
- ✅ **Filtro por número de Kardex** (búsqueda opcional)
- ✅ Tabla resumen con datos completos del beneficiario

### Cómo Se Ve
- **Barras de colores** muestran el desglose de materiales (Reciclaje, Flexibles, Lonas, etc.)
- **Kilogramos totales** en grande y negrita
- **Fecha y municipio** en texto más pequeño
- **Kilogramos NO se pueden modificar** (vienen del Kardex)
- **Sí se puede modificar**: Forma de cobro (Por Flete/Por Kilo) y Precio unitario
- **Resumen tipo factura**: Beneficiario con dirección/teléfono, tabla de items, total destacado

---

## ✅ RESPUESTAS DEL CLIENTE (23 Dic 2024)

### 1. ⚠️ Precios Diferenciados por Material

**RESPUESTA**: ❌ **NO** - El precio siempre es el mismo, no depende del tipo de material

**Decisión**: Mantener el diseño actual - un solo precio unitario por Kardex

**Impacto**: ✅ No requiere cambios - continuar con implementación actual

---

### 2. ⚠️ Tipos de Terceros

**RESPUESTA**: ✅ **CUALQUIER TERCERO** puede ser beneficiario

**Decisión**: Mantener búsqueda actual - sin filtros por tipo

**Impacto**: ✅ No requiere cambios - la búsqueda implementada es correcta

**Funcionalidad adicional solicitada**: 🔴 Interfaz administrativa para gestionar terceros (solo admin)

---

### 3. ⚠️ Forma de Cobro por Material

**RESPUESTA**: ❌ **NO** - La forma de cobro NO varía por material

**Decisión**: Una sola forma de cobro por Kardex (actual es correcto)

**Impacto**: ✅ No requiere cambios

---

### 4. ⚠️ Items Separados por Material

**RESPUESTA**: ❌ **NO** - NO se separan items por material

**Decisión**: Un solo ItemOrden por Kardex con el total de kg (actual es correcto)

**Impacto**: ✅ No requiere cambios

---

## ❓ PREGUNTA PENDIENTE - ✅ RESPONDIDA

### 5. ⚠️ ¿Qué Hacemos con las Órdenes Enviadas?

**RESPUESTA**: ✅ **FLUJO DE TESORERÍA**

**El proceso es**:
1. **Coordinador** envía la orden desde el portal → Estado "Enviada"
2. **Tesorero** accede al portal y ve listado de órdenes
3. **Tesorero** descarga PDF de la orden
4. **Tesorero tiene 2 opciones**:
   - ✅ **Aprobar y Pagar**: Marca como "Pagada" (adjunta PDF al documento contable)
   - ❌ **Rechazar**: Marca como "Rechazada" con observaciones obligatorias
5. Si rechazada: **Coordinador** ve el rechazo, puede editar y reenviar

**Requisitos técnicos**:
- ✅ Rol de "Tesorero" con acceso al portal
- ✅ Vista de listado de todas las órdenes (filtro por estado)
- ✅ Generar PDF por orden individual
- ✅ Marcar orden como "Pagada" (cambio de estado)
- ✅ **Rechazar orden con observaciones** (cambio de estado + comentario)
- ✅ Estados de orden: Borrador → Enviada → [Pagada | Rechazada]
- ✅ Coordinador puede ver observaciones de rechazo y reenviar

**Impacto en desarrollo**: 
- Rol Tesorero: 1-2 horas
- Vista listado órdenes: 2-3 horas  
- Generación PDF: 3-4 horas
- Cambio de estado (Pagar + Rechazar): 2 horas
- **TOTAL**: ~10-12 horas

---

## 📋 Resumen Final de Decisiones

**✅ TODAS LAS PREGUNTAS RESPONDIDAS:**

1. ❌ NO hay precios diferenciados por material → Un solo precio por Kardex
2. ❌ NO hay formas de cobro diferentes por material → Una forma de cobro por Kardex  
3. ❌ NO se separan items por material → Un ItemOrden por Kardex
4. ✅ Cualquier tercero puede ser beneficiario → Búsqueda sin filtros
5. ✅ **Flujo de Tesorería**: Tesorero ve órdenes, descarga PDF, marca como pagada

---

## 🎯 Decisiones Más Importantes

### 1. ¿Los materiales tienen precios unitarios diferentes?
- **NO** → Seguir como está (terminar en 1-2 horas)
- **SÍ** → Rediseñar formulario (4-6 horas adicionales)

### 2. ¿Qué hacemos cuando se envía una orden?
- Esta decisión define el siguiente paso de desarrollo
- Determina cómo se comunica el coordinador con Bogotá
- Afecta el flujo completo del proceso

## 📋 Resumen Final de Decisiones

**✅ CONFIRMADO - No requiere cambios:**
1. ❌ NO hay precios diferenciados por material → Un solo precio por Kardex
2. ❌ NO hay formas de cobro diferentes por material → Una forma de cobro por Kardex  
3. ❌ NO se separan items por material → Un ItemOrden por Kardex
4. ✅ Cualquier tercero puede ser beneficiario → Búsqueda sin filtros

**✅ NUEVOS REQUERIMIENTOS IDENTIFICADOS:**

### 🔴 ALTA PRIORIDAD
1. **Rol Tesorero + Gestión de Órdenes** (10-12 horas)
   - Vista de listado de todas las órdenes
   - Filtros por estado (Borrador, Enviada, Pagada, Rechazada)
   - Generar y descargar PDF individual
   - **Aprobar**: Marcar orden como "Pagada"
   - **Rechazar**: Marcar como "Rechazada" con observaciones obligatorias
   - Coordinador ve rechazo y puede reenviar
   
2. **Gestión de Terceros para Admin** (6-8 horas)
   - CRUD completo de terceros
   - Solo acceso admin

### 🟡 FUNCIONALIDADES ADICIONALES SUGERIDAS
- Dashboard de estadísticas
- Exportar listado completo
- Historial de cambios de estado
- Notificaciones por email (opcional)

---

## 🎯 Conclusión de la Reunión

**✅ El diseño actual es 100% correcto** - No requiere cambios en la lógica de órdenes.

**✅ Flujo completo definido**:
1. Coordinador crea y envía orden → Estado "Enviada"
2. Tesorero ve orden en su listado
3. Tesorero descarga PDF
4. Tesorero **aprueba** (→ "Pagada") o **rechaza** (→ "Rechazada" + observaciones)
5. Si rechazada: Coordinador ve motivo, edita y reenvía

**Próximos pasos de desarrollo**:
1. 🔴 Implementar rol Tesorero + PDF + Estados + Rechazo (~10-12h)
2. 🔴 Implementar gestión de terceros (~6-8h)
3. 🟡 Dashboard y reportes (opcional, ~8-10h)

**Total próximas implementaciones**: ~18-20 horas

---

## 💡 Estado Actual

✅ **Crear órdenes** - Completo (nueva y editar borradores)  
✅ **Visualización de Kardex** con barras de materiales  
✅ **Guardar borrador** o enviar directamente  
✅ **Búsqueda de terceros** rápida con autocompletado  
✅ **Paginación** de 20 items por página  
✅ **Filtro por número** de Kardex  
✅ **Tabla resumen** estilo factura profesional  
✅ **Edición completa** - agregar, eliminar, modificar Kardex  
✅ **Información beneficiario** - nombre, NIT, dirección, teléfono, email  
✅ **Badge ENTRADA/SALIDA** con colores verde/rojo  

**Lo siguiente**: Esperar decisión sobre envío de órdenes + Gestión de terceros

---

**Preparado por**: Equipo de desarrollo  
**Revisado con**: cundinamarca@campolimpio.org  
**Fecha**: 23 de diciembre de 2024 - 20:45  
**Estado**: ✅ Diseño validado - Pendiente flujo post-envío
