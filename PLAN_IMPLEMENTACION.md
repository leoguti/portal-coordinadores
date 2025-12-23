# PLAN DE IMPLEMENTACIÓN - Órdenes de Servicio

**Objetivo**: Crear la interfaz para que los coordinadores puedan crear Órdenes de Servicio

**Meta**: Tener algo funcional para mostrar al cliente en pocas horas

**Fecha inicio**: 23 de diciembre de 2024

---

## 🎯 ¿Qué vamos a construir?

Una pantalla donde el coordinador pueda:
1. Ver sus registros de Kardex que están "Por Pagar"
2. Seleccionar cuáles quiere incluir en una orden
3. Crear la Orden de Servicio
4. Ver la lista de sus órdenes creadas

---

## ✅ FASE 1: Preparación y Verificación ✅ COMPLETADA

### 1.1 Verificar campos en Airtable (Kardex) ✅
- [x] Confirmar que existe el campo `EstadoPago` en la tabla Kardex
- [x] Confirmar valores: "Caja Menor", "Sin Costo", "Por Pagar", "En Orden"
- [x] ✅ Campo existe y está configurado correctamente

**Notas**:
```
✅ Verificado el 23/12/2024
- Campo EstadoPago existe en Kardex
- Tabla Kardex tiene 29 campos totales
- ID Tabla: tblBUx4wF0xVjmpgh
```

---

### 1.2 Verificar tablas de Órdenes en Airtable ✅
- [x] Confirmar que existe tabla `Ordenes` - ID: tblw1iNr7HBhKnZZR
- [x] Confirmar que existe tabla `ItemsOrden` - ID: tbl0Wq9uybWVzWij3
- [x] Confirmar que existe tabla `Terceros` - ID: tblBNwRaF7iq4IAHG
- [x] Revisar campos necesarios (NumeroOrden, Estado, Coordinador, Beneficiario)

**Notas**:
```
✅ TODAS LAS TABLAS VERIFICADAS

Ordenes (9 campos):
- NumeroOrden, Coordinador, Beneficiario, Estado
- Fecha de pedido, ItemsOrden
- NombreCoordinador (lookup), RazonSocial (lookup), Observaciones

ItemsOrden (9 campos):
- Name, TipoItem, OrdenServicio, Kardex
- CatalogoServicio (Link to CatalogoServicios)
- FormaCobro, Cantidad, PrecioUnitario, Cálculo

Terceros (16 campos):
- RazonSocial, NIT, Direccion
- Movil, Correo, Tipo, Observaciones, etc.

CatalogoServicios (8 campos):
- Nombre, Descripcion, UnidadMedida, Activo
- Precio Unitario, ItemsOrden, etc.
```


---

## ✅ FASE 2: Crear función para leer Kardex ✅ COMPLETADA

### 2.1 Agregar función en lib/airtable.ts ✅
- [x] Crear función `getKardexPorPagar(coordinatorId)`
- [x] Esta función trae los Kardex con estado "Por Pagar" del coordinador
- [ ] Probar que funciona

**Notas**:
```
✅ Función creada en lib/airtable.ts (línea 379-431)

Características:
- Filtra por EstadoPago = "Por Pagar"
- Filtra por Coordinador (usando FIND + ARRAYJOIN)
- Ordena por fechakardex DESC (más recientes primero)
- Retorna tipo: Promise<Kardex[]>
- Interfaz KardexFields definida con todos los campos

Próximo: Probar la función
```


---

## ✅ FASE 3: Crear la página de Órdenes de Servicio

### 3.1 Crear la página básica ✅ COMPLETADA
- [x] Crear archivo: `app/ordenes-servicio/page.tsx` - ✅ Ya existe
- [x] Agregar link en el menú (Sidebar.tsx) - ✅ Ya está (línea 12, icono 🔧)
- [x] Verificar que se puede abrir la página - ✅ Funciona con datos demo

**Notas**:
```
✅ Página creada con datos de prueba
- Grid de cards para mostrar órdenes
- Estados con colores (Borrador, Enviada, Aprobada, Pagada, Rechazada)
- Botón "Nueva Orden" (enlace a /ordenes-servicio/nueva)
- Link en Sidebar ya agregado con icono 🔧
- Pendiente: Conectar con datos reales de Airtable
```


---

### 3.2 Mostrar lista de Kardex "Por Pagar" ✅
- [x] Conectar página principal con getOrdenesCoordinador()
- [x] Reemplazar datos demo con datos reales
- [x] Manejar estados de loading, error y vacío
- [x] Mostrar órdenes en grid de cards

**Notas**:
```
✅ Página conectada a Airtable (app/ordenes-servicio/page.tsx)

Características implementadas:
- Carga órdenes del coordinador autenticado
- Estados: loading, error, empty state
- Muestra: NumeroOrden, Estado, Fecha, Beneficiario, Items count
- Grid responsive con colores por estado
- Empty state con botón para crear primera orden

Próximo: Crear formulario de nueva orden
```


---

## ✅ FASE 4: Formulario de Nueva Orden

### 4.1 Crear botón "Nueva Orden de Servicio"
- [ ] Botón que abre un modal o nueva sección
- [ ] Validar que haya al menos 1 Kardex seleccionado
- [ ] Mostrar mensaje si no hay nada seleccionado

**Notas**:


---

### 4.2 Formulario - Datos básicos
- [ ] Campo: Fecha de pedido (date picker, por defecto HOY)
- [ ] Campo: Beneficiario/Tercero (selector de tabla Terceros)
- [ ] Validar fecha (no futuras, no meses bloqueados)
- [ ] Mostrar resumen de Kardex seleccionados

**Notas**:


---

### 4.3 Formulario - Items de la orden
Por cada Kardex seleccionado, crear un item:
- [ ] Mostrar resumen del Kardex (fecha, municipio, kg)
- [ ] Campo: Forma de cobro (Por Flete / Por Kilo)
- [ ] Campo: Cantidad (kg o número de fletes)
- [ ] Campo: Precio unitario
- [ ] Calcular y mostrar: Subtotal

**Notas**:


---

## ✅ FASE 5: Crear la orden en Airtable ✅ COMPLETADA

### 5.1 Función para crear orden ✅
- [x] Crear función `createOrdenServicio()` en lib/airtable.ts
- [x] Crear registro en tabla `Ordenes`
- [x] Crear registros en tabla `ItemsOrden` (uno por cada Kardex)
- [x] Actualizar Kardex: cambiar estado a "En Orden"

**Notas**:
```
✅ Función creada en lib/airtable.ts (línea 533-650)

Proceso que ejecuta:
1. Crea registro en Ordenes con:
   - Coordinador, Beneficiario, Fecha
   - Estado = "Borrador" (por defecto)
   - Observaciones (opcional)

2. Por cada item:
   - Crea ItemOrden con:
     - OrdenServicio (link a la orden)
     - TipoItem = "CON Kardex"
     - Kardex (link), FormaCobro, Cantidad, PrecioUnitario
     - Cálculo/Subtotal (formula automática)

3. Actualiza cada Kardex:
   - EstadoPago: "Por Pagar" → "En Orden"

4. Retorna la Orden creada con NumeroOrden

Manejo de errores:
- Continúa con otros items si uno falla
- Logging completo de cada paso
- Throw error si falla la orden principal
```


---

### 5.2 Conectar formulario con la función
- [ ] Botón "Crear Orden de Servicio"
- [ ] Mostrar loading mientras se crea
- [ ] Mostrar mensaje de éxito con número de orden
- [ ] Limpiar formulario y refrescar lista

**Notas**:


---

## ✅ FASE 6: Ver lista de órdenes creadas

### 6.1 Mostrar órdenes del coordinador ✅
- [x] Crear función `getOrdenesCoordinador(coordinatorId)`
- [ ] Mostrar tabla con: Número, Fecha, Beneficiario, Estado, Total
- [ ] Ordenar por fecha (más recientes primero)

**Notas**:
```
✅ Función creada en lib/airtable.ts (línea 458-505)

Características:
- Filtra por Coordinador (usando FIND + ARRAYJOIN)
- Ordena por "Fecha de pedido" DESC (más recientes primero)
- Retorna tipo: Promise<Orden[]>
- Interfaz OrdenFields definida con todos los campos
- Incluye lookups: NombreCoordinador, RazonSocial

Próximo: Conectar con la página de órdenes
```


---

### 6.2 Ver detalle de una orden
- [ ] Click en una orden → mostrar detalle
- [ ] Ver items de la orden
- [ ] Ver Kardex asociados
- [ ] Mostrar estado actual

**Notas**:


---

## ✅ FASE 7: Validaciones y Pulido

### 7.1 Validaciones de negocio
- [ ] No permitir fechas futuras
- [ ] No permitir crear orden en mes bloqueado (después del día 7)
- [ ] Validar que Kardex "Por Pagar" no esté ya en otra orden
- [ ] Mensaje de confirmación antes de crear

**Notas**:


---

### 7.2 Estilos y UX
- [ ] Tabla responsive y fácil de leer
- [ ] Botones claros y visibles
- [ ] Mensajes de error comprensibles
- [ ] Loading states en acciones

**Notas**:


---

## ✅ FASE 8: Pruebas finales

### 8.1 Probar flujo completo
- [ ] Login como coordinador
- [ ] Ver Kardex "Por Pagar"
- [ ] Crear nueva orden seleccionando Kardex
- [ ] Verificar que se creó en Airtable
- [ ] Verificar que Kardex cambió a "En Orden"
- [ ] Ver la orden en la lista

**Notas**:


---

## 🚀 VERSIÓN MÍNIMA PARA CLIENTE

**Lo mínimo para mostrar**:
- ✅ Ver Kardex "Por Pagar"
- ✅ Crear orden básica con datos mínimos
- ✅ Ver lista de órdenes creadas

**Podemos dejarlo pendiente para después**:
- Estados de orden (Borrador, Enviada, etc.) - puede ser siempre "Borrador" por ahora
- Editar órdenes creadas
- Items SIN Kardex (servicios del catálogo)
- Validación de bloqueo por fecha (podemos agregarlo después)

---

## 📝 DECISIONES Y NOTAS

### ¿Qué decidimos durante el desarrollo?



---

## 🐛 PROBLEMAS ENCONTRADOS



---

## ✨ MEJORAS FUTURAS

- [ ] Agregar items SIN Kardex (servicios del catálogo)
- [ ] Estados de orden (workflow: Borrador → Enviada → Aprobada → Pagada)
- [ ] Editar/cancelar órdenes en estado Borrador
- [ ] Filtros y búsqueda en listas
- [ ] Exportar orden a PDF
- [ ] Bloqueo por fecha (día 7 del mes)
- [ ] Dashboard con indicadores de Kardex pendientes

---

---

## 📊 NOMBRES REALES DE CAMPOS EN AIRTABLE

| Campo Doc | Campo Real en Airtable | Tabla | Tipo |
|-----------|------------------------|-------|------|
| EstadoPago | EstadoPago | Kardex | Select |
| NumeroOrden | NumeroOrden | Ordenes | Autonumber |
| Coordinador | Coordinador | Ordenes | Link → Coordinadores |
| Beneficiario | Beneficiario | Ordenes | Link → Terceros |
| Estado | Estado | Ordenes | Select |
| Fecha de pedido | Fecha de pedido | Ordenes | Date |
| Orden | OrdenServicio | ItemsOrden | Link → Ordenes |
| Servicio | CatalogoServicio | ItemsOrden | Link → CatalogoServicios |
| FormaCobro | FormaCobro | ItemsOrden | Select |
| Kardex | Kardex | ItemsOrden | Link → Kardex |
| Precio Unitario | PrecioUnitario | ItemsOrden | Currency |
| Subtotal | Cálculo | ItemsOrden | Formula |

---

**Última actualización**: 23 de diciembre de 2024 - 20:45
**Estado general**:
- ✅ Fase 1: Airtable verificado (100%)
- ✅ Fase 2: getKardexPorPagar() creada (100%)
- ✅ Fase 3: Página básica conectada a datos reales (100%)
- ✅ Fase 4: Formulario de Nueva Orden completo (100%)
- ✅ Fase 5: createOrdenServicio() creada (100%)
- ✅ Fase 6: getOrdenesCoordinador() creada (100%)
- ✅ Fase 7: Edición de Órdenes Borrador completa (100%)
- 🎉 IMPLEMENTACIÓN CORE COMPLETADA AL 100%

---

## 📋 PRÓXIMAS FUNCIONALIDADES (Por Priorizar)

### 🔴 ALTA PRIORIDAD

#### 1. Gestión de Terceros (Solo Administrador)
**Requerimiento del cliente**: Interfaz administrativa para gestionar terceros

**Funcionalidades**:
- [ ] Vista de lista de todos los terceros
- [ ] Crear nuevo tercero (formulario completo)
- [ ] Editar tercero existente
- [ ] Desactivar/activar terceros
- [ ] Búsqueda y filtrado por tipo
- [ ] Exportar listado (CSV/Excel)

**Campos a gestionar**:
- Razón Social (requerido)
- NIT (requerido)
- Tipo: Proveedor, Cliente, Empleado, Gestor, Transportador, Otro
- Dirección
- Teléfono/Móvil
- Correo Electrónico
- Estado (Activo/Inactivo)

**Estimado**: 6-8 horas
**Ruta sugerida**: `/admin/terceros`
**Acceso**: Solo usuarios con rol `admin`

---

#### 1.5 Gestión del Catálogo de Servicios (Solo Administrador)
**Requerimiento del cliente**: Interfaz administrativa para gestionar items del catálogo

**Funcionalidades**:
- [ ] Vista de lista de todos los servicios del catálogo
- [ ] Crear nuevo servicio (formulario)
- [ ] Editar servicio existente
- [ ] Activar/desactivar servicios
- [ ] Búsqueda y filtrado
- [ ] Definir precio unitario por defecto
- [ ] Definir unidad de medida (kg, unidad, flete, etc.)

**Campos a gestionar**:
- Nombre del servicio (requerido)
- Descripción
- Unidad de Medida (kg, unidad, flete)
- Precio Unitario (por defecto)
- Estado (Activo/Inactivo)

**Estimado**: 4-5 horas
**Ruta sugerida**: `/admin/catalogo`
**Acceso**: Solo usuarios con rol `admin`

**Nota**: Estos servicios se usan para agregar items NO-Kardex en las órdenes

---

#### 2. Rol Tesorero + Gestión de Órdenes y PDF
**Requerimiento del cliente**: El tesorero debe poder gestionar el pago de órdenes

**Flujo completo**:
1. Coordinador envía orden → Estado cambia a "Enviada"
2. Tesorero accede al portal y ve listado de órdenes
3. Tesorero descarga PDF de la orden
4. **Tesorero tiene 2 opciones**:
   - **Opción A - Aprobar**: Marca como "Pagada" (adjunta PDF al documento contable)
   - **Opción B - Rechazar**: Marca como "Rechazada" con observaciones obligatorias
5. Si rechazada: Coordinador ve el rechazo, edita y vuelve a enviar

**Funcionalidades a implementar**:
- [ ] **Rol "Tesorero"** en NextAuth
  - Middleware de autorización
  - Permisos específicos del rol
  
- [ ] **Vista `/tesoreria/ordenes`** (Solo Tesorero)
  - Listado de todas las órdenes (todos los coordinadores)
  - Filtros por: Estado, Coordinador, Fecha, Beneficiario
  - Búsqueda por número de orden
  - Ordenamiento por fecha/monto
  
- [ ] **Generación de PDF**
  - Formato profesional con logo CampoLimpio
  - Encabezado: Número orden, fecha, estado
  - Beneficiario: Razón social, NIT, dirección, contacto
  - Tabla de items: Kardex, cantidad, unidad, precio, subtotal
  - Total destacado
  - Pie de página con firma/sello (opcional)
  
- [ ] **Cambio de Estado**
  - Botón "Marcar como Pagada"
  - Botón "Rechazar Orden" (con campo de observaciones)
  - Confirmación antes de cambiar
  - Registro de fecha de pago/rechazo
  - Solo desde estado "Enviada"
  - Si se rechaza: Orden vuelve a estado "Rechazada" con observaciones
  
- [ ] **Estados de Orden**
  - **Borrador**: Coordinador editando
  - **Enviada**: Coordinador finalizó, esperando pago
  - **Pagada**: Tesorero procesó el pago ✅
  - **Rechazada**: Tesorero rechazó con observaciones ❌
  - Flujo: Borrador → Enviada → [Pagada | Rechazada]
  
- [ ] **Observaciones de Rechazo**
  - Campo obligatorio al rechazar
  - Visible para el coordinador que creó la orden
  - Razón del rechazo (ej: "Precio incorrecto", "Falta documentación")
  - Coordinador puede editar y reenviar después del rechazo

**Tecnología sugerida para PDF**:
- Opción A: `jsPDF` + `jspdf-autotable` (simple, rápido)
- Opción B: `react-pdf/renderer` (más control, mejor diseño)
- Opción C: Puppeteer (genera desde HTML, más pesado)

**Estimado**: 8-10 horas → **10-12 horas** (con funcionalidad de rechazo)
- Rol y permisos: 1-2h
- Vista listado: 2-3h
- Generación PDF: 3-4h
- Cambio estado (Pagar + Rechazar con observaciones): 2h
- Pruebas: 1h

**Ruta sugerida**: `/tesoreria/ordenes`
**Acceso**: Solo usuarios con rol `tesorero`

---

### 🟡 MEDIA PRIORIDAD

#### 3. Dashboard Administrador
- [ ] Resumen general de órdenes por estado
- [ ] Listado de todas las órdenes (todos los coordinadores)
- [ ] Aprobar/rechazar órdenes
- [ ] Estadísticas y reportes

**Estimado**: 8-10 horas

---

#### 4. Roles y Permisos
- [ ] Definir roles: Admin, Coordinador, Visualizador
- [ ] Restricciones por rol
- [ ] Middleware de autorización

**Estimado**: 4-6 horas

---

### 🟢 BAJA PRIORIDAD

#### 5. Items SIN Kardex
- [ ] Agregar servicios del catálogo a órdenes
- [ ] Precio manual
- [ ] Descripción libre

**Estimado**: 3-4 horas

---

#### 6. Exportar/Imprimir Órdenes
- [ ] Generar PDF de orden individual
- [ ] Exportar listado a Excel
- [ ] Vista de impresión

**Estimado**: 4-5 horas

---

## 📝 NOTAS DE REUNIÓN CON CLIENTE (23 Dic 2024)

**Decisiones tomadas**:
1. ✅ Precios NO diferenciados por material → Un solo precio por Kardex
2. ✅ Forma de cobro NO varía por material → Una forma de cobro por Kardex
3. ✅ NO se separan items por material → Un ItemOrden por Kardex completo
4. ✅ Cualquier tercero puede ser beneficiario → Sin filtros
5. ✅ **Flujo de Tesorería definido**:
   - Coordinador envía orden → Estado "Enviada"
   - Tesorero ve listado, descarga PDF, marca como "Pagada"
6. ✅ **Gestión de terceros** requerida para rol Admin

**Resultado**: El diseño actual de órdenes es 100% correcto. No requiere cambios estructurales.

**Próximas implementaciones prioritarias**:
1. 🔴 Rol Tesorero + PDF + Estados (8-10h)
2. 🔴 Gestión de Terceros Admin (6-8h)

---
