# Notas de Reunión con Cliente
**Fecha:** 20 de diciembre de 2024

---

## Reglas de Bloqueo por Fecha (Actividades y Kardex)

### Regla General
- Los datos de un mes quedan **bloqueados el día 7 del mes siguiente**
- Ejemplo: 
  - Datos de **enero** → editables hasta el **7 de febrero**
  - Después del 7 de febrero → enero queda **bloqueado**

### Aplica para:
- [x] **Actividades**
- [x] **Kardex**
- [x] **Órdenes de Servicio**

### Aclaración sobre Fecha de Actividad
- La fecha que se registra en una actividad es la **fecha en que se realizó la actividad** (no la fecha de registro)
- El bloqueo se aplica según esta fecha de realización

### Operaciones afectadas:
- ❌ Crear (no se pueden crear registros en meses bloqueados)
- ❌ Crear con fecha futura (no se permiten fechas en el futuro)
- ❌ Editar (no se pueden modificar registros de meses bloqueados)
- ❌ Eliminar (no se pueden borrar registros de meses bloqueados)
- ✅ Ver (siempre se pueden ver, pero con indicador visual)

### Indicador Visual para Registros Bloqueados
- **Recomendación:** Usar un tono más claro/gris para los registros bloqueados
- Opciones:
  1. Fondo gris claro (`bg-gray-100`)
  2. Texto en gris (`text-gray-400`)
  3. Opacidad reducida (`opacity-60`)
  4. Icono de candado 🔒 junto al registro
  5. Badge "Bloqueado" o "Solo lectura"

---

## Lógica de Implementación

```
Fecha actual: 20 de febrero
Día del mes: 20

Si día_actual > 7:
  - Mes bloqueado = mes_anterior y anteriores
  
Si día_actual <= 7:
  - Mes bloqueado = 2 meses atrás y anteriores
  - (El mes anterior aún es editable)
```

### Ejemplos:
| Fecha Actual | Meses Editables | Meses Bloqueados |
|--------------|-----------------|------------------|
| 5 de febrero | Enero, Febrero | Diciembre y anteriores |
| 10 de febrero | Febrero | Enero y anteriores |
| 1 de marzo | Febrero, Marzo | Enero y anteriores |
| 15 de marzo | Marzo | Febrero y anteriores |

---

## Tareas Pendientes

### Bloqueo por Fecha
- [ ] Implementar función `isMonthLocked(date)` en utilidades
- [ ] Validar en API antes de crear/editar/eliminar (Actividades, Kardex, Órdenes)
- [ ] Validar: NO permitir fechas futuras
- [ ] Mostrar mensaje de error claro cuando se intente modificar registro bloqueado
- [ ] Aplicar estilos visuales a registros bloqueados en:
  - [ ] Lista de Actividades
  - [ ] Lista de Kardex
  - [ ] Lista de Órdenes
- [ ] Deshabilitar botones de edición/eliminación en registros bloqueados

### Funcionalidad Pendiente - Actividades
- [ ] **Subida de documentos** en el formulario de actividad

---

## Órdenes de Servicio (Transporte de Material)

### Concepto
- Las órdenes de servicio son para **movimiento de material por transportador**
- Se componen de varios registros de **Kardex** que aún no han sido procesados
- Kardex tiene una **marca especial** que indica si ha sido procesado o no

### Esquema de Tablas Actuales

#### Tabla: Ordenes
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `NumeroOrden` | Autonumber | **Consecutivo visible** - identificador operativo oficial |
| `ID Orden` | Text (Record ID) | ID interno de Airtable - NO se usa como referencia |
| `Coordinador` | Link → Coordinadores | **Obligatorio** - una orden pertenece a un solo coordinador |
| `Fecha de pedido` | Date | Fecha de creación de la orden |
| `Estado` | Select | Estado actual de la orden |
| `Beneficiario` | Link → Terceros | **Obligatorio** - transportador/proveedor que cobra |
| `ItemsOrden` | Link → ItemsOrden | Items que componen la orden |

#### Tabla: ItemsOrden
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `Name` | Text | Descripción del item |
| `Orden` | Link → Ordenes | Orden a la que pertenece |
| `ID Orden (from Orden)` | Lookup | Número de orden |
| `TipoItem` | Select | **"CON Kardex"** / **"SIN Kardex"** |
| `Kardex` | Link → Kardex | Solo si TipoItem = "CON Kardex" |
| `Servicio` | Link → ServiciosSinKardex | Solo si TipoItem = "SIN Kardex" |
| `FormaCobro` | Select | **"Por Flete"** / **"Por Kilo"** |
| `Cantidad` | Number | Cantidad de kg o fletes |
| `Precio Unitario` | Currency | Precio por unidad |
| `Subtotal` | Formula | Cantidad × Precio Unitario |

#### Tabla: Kardex (campos completos)
| Campo | Tipo | Ejemplo |
|-------|------|---------|
| `idkardex` | Autonumber | 20313 |
| `Pre-ID` | Number | 379 |
| `fechakardex` | Date | 2025-02-19 |
| `TipoMovimiento` | Select | ENTRADA / SALIDA |
| `Coordinador` | Link | → Coordinadores |
| `Name (from Coordinador)` | Lookup | "Andrea Villarraga" |
| `MunicipioOrigen` | Link | → Municipios |
| `mundep (from MunicipioOrigen)` | Lookup | "Une - Cundinamarca" |
| `CentrodeAcopio` | Link | → CentrosAcopio |
| `NombreCentrodeAcopio` | Lookup | "C.A FACATATIVA" |
| `gestor` | Link | → Gestores (solo en SALIDA) |
| `nombregestor` | Lookup | "GEOCYCLE LTDA (HOLCIM)" |
| **Materiales (kg):** | | |
| `Reciclaje` | Number | 600 |
| `Incineracion` | Number | 0 |
| `Flexibles` | Number | 420 |
| `PlasticoContaminado` | Number | 0 |
| `Lonas` | Number | 0 |
| `Carton` | Number | 0 |
| `Metal` | Number | 0 |
| `Total` | Formula | 1020 (positivo=entrada, negativo=salida) |
| `TotalKilos` | Formula/Text | "600, 0, 420, 0, 0, 0, 0" |
| **Otros:** | | |
| `Descripción` | Formula | "20313->2025-02-19->Une->1020 Kg" |
| `Observaciones` | Text | Solo en salidas |
| `MES` | Formula | "2025-02" |
| `AÑO` | Formula | "2025" |
| `FechaCreacion` | Created time | Auto |
| `idcoordinador` | Lookup | ID del coordinador |

### Observaciones sobre Kardex:
- **ENTRADA**: Material que llega al centro de acopio (Total positivo)
- **SALIDA**: Material que sale del centro de acopio (Total negativo)
- Las salidas tienen `gestor` y `nombregestor` (destino del material)
- **NO existe campo de "procesado"** - hay que definir cómo marcarlo

### ⚠️ IMPORTANTE - Gestores y Órdenes de Servicio
- El campo `gestor` en Kardex **puede sugerir** a quién se le generará la Orden de Servicio (solo en algunos casos)
- Los **Gestores** cobran servicios en algunos casos (ej: GEOCYCLE/HOLCIM)
- **Pero hay otros servicios** que dependen de la tabla **Terceros** (donde también están los gestores)
- **Terceros = Todos los proveedores** (gestores, transportadores, y otras entidades)
- La Orden de Servicio **agrupa registros de Kardex de un solo coordinador**
- Hay items en la orden que **se asocian a Kardex** (CON Kardex)
- Hay items en la orden que **NO se asocian a Kardex** (SIN Kardex - servicios del catálogo)

### Flujo de Órdenes de Servicio:

**ENTRADA (Veredas → Centro de Acopio):**
- El coordinador contrata un camión (transportador)
- Recoge **residuos** en las veredas y los lleva al centro de acopio
- Ejemplo: 1000 kg de residuos de las veredas al C.A. FACATATIVA
- **La orden paga el TRANSPORTE del campo al centro de acopio**
- ⚠️ **Las ENTRADAS NO tienen campo `gestor` en Kardex**
- ✅ **El gestor se asigna en la ORDEN DE SERVICIO** (no en Kardex)
- Un gestor puede prestar servicio de transporte para entradas

**SALIDA (Centro de Acopio → Gestor Final):**
- Material sale del centro hacia gestor final (ej: Holcim)
- **La orden paga el procesamiento/disposición del material**
- ✅ Tiene campo `gestor` definido en Kardex
- ✅ **Se puede SUGERIR el gestor del Kardex** al crear la orden

**ENTRADA + SALIDA DIRECTA (Campo → Gestor Final):**
- Material va **directo del municipio al gestor de disposición final**
- **NO pasa por el centro de acopio**
- Se registra como **un solo Kardex** (limitación del chatbot - no crea dos registros vinculados)
- Ejemplo: Material del campo directo a planta de proceso (Holcim)
- **Forma de cobro**: **INTEGRAL** (transporte + procesamiento en un solo pago)
- 📌 **Decisión confirmada**: No se trabaja cobro separado en esta fase

**PROCESAMIENTO EN CENTRO DE ACOPIO:**
- Se realizan procesos de material en los centros de acopio
- **Este procesamiento se paga en la Orden de Servicio**
- ⚠️ **Puede NO estar asociada a un registro de Kardex**
- Sería un **TIPO DE ORDEN diferente** (sin enlace a Kardex)

### 📋 Estructura de Orden de Servicio:
- Una **Orden de Servicio** puede tener múltiples **Items**
- **Tipos de Items de Orden:**
  1. **Item CON Kardex**: Asociado a registro(s) de Kardex (transporte de entradas/salidas)
  2. **Item SIN Kardex**: Otros servicios (procesamiento, etc.) no asociables a Kardex
- Una misma orden puede mezclar ambos tipos de items

### 🚨 CASO DE FRAUDE A EVITAR - "Caso Fulano el Malo"
**Problema detectado:**
- Un coordinador ("Fulano el malo") hacía acuerdos con el municipio
- El **municipio llevaba el material al centro de acopio** (ej: Paipa, Boyacá) - **sin costo para Campolimpio**
- El municipio transportaba el material a las veredas como parte de su gestión
- **El coordinador fraudulento** decía que había que contratar y pagar este transporte
- Hacía que **Campolimpio pagara un transporte que ya estaba cubierto** por el municipio
- **Se quedaba con el dinero**

**Detalles adicionales del fraude:**
- Los pagos se hicieron a través de **CAJA MENOR** (no por la central de Campolimpio)
- Fulano el malo le decía a sus "amigotes" que presentaran recibos falsos
- **Al intentar contactar a los "amigotes"**: No sabían de qué les hablaban ni qué habían cobrado
- El coordinador se quedaba con el dinero de esos pagos fraudulentos

**📌 CAJA MENOR - Funcionalidad pendiente:**
- El cliente también quiere gestión de **Caja Menor** en el portal
- Límite actual: **hasta $500,000 COP** por pago
- **DEJADO PENDIENTE** para implementación futura

---

## 📌 REGLA GENERAL: Estados de Pago en Kardex

**El coordinador define el estado de cada Kardex al momento de crearlo (vía Chatbot):**

| Estado | Descripción |
|--------|-------------|
| **Caja Menor** | Ya pagado con caja menor del coordinador |
| **Sin Costo** | No requiere pago (ej: municipio asume costo) |
| **Por Pagar** | Debe ir a una orden de servicio (pago pendiente por Bogotá) |

**⚠️ REGLA: No se puede crear un Kardex sin definir el estado de pago**
- El chatbot DEBE preguntar y el coordinador DEBE indicar uno de los 3 estados
- No existe estado "Sin definir" - es obligatorio definirlo al crear

**Estado adicional (se asigna automáticamente en el Portal):**

| Estado | Cuándo se asigna | Descripción |
|--------|------------------|-------------|
| **En Orden** | Al crear la Orden de Servicio en el Portal | El Kardex ya tiene ID/número de orden asignado |

**Resumen de los 4 estados:**
1. **Caja Menor** - Pagado por caja menor (definido en chatbot)
2. **Sin Costo** - No genera pago (definido en chatbot)
3. **Por Pagar** - Pendiente de incluir en orden de servicio (definido en chatbot)
4. **En Orden** - Ya incluido en una orden de servicio (asignado en portal)

**Flujo "Por Pagar" → "En Orden":**
- Coordinador crea Kardex con estado "Por Pagar"
- Luego en el Portal crea Orden de Servicio y selecciona los Kardex "Por Pagar"
- Al crear la orden, esos Kardex cambian automáticamente a "En Orden"

**📌 Diferencia entre "Por Pagar" y "En Orden":**
- **Por Pagar**: Coordinador marcó que debe ir a orden, pero NO tiene número de orden asignado
- **En Orden**: Ya tiene el **ID de Airtable o número de orden** asignado (la orden fue creada en el portal)

**🔧 Interfaz necesaria (Portal Coordinador):**
- Opción para **corregir/cambiar estado** en caso de error del coordinador

**💡 MEJOR ESTRATEGIA: Definir estado al crear el Kardex (Chatbot)**
- El coordinador **sabe con seguridad el estado del registro al momento de crearlo**
- Es mejor preguntar en la conversación del chatbot cuando se genera el Kardex
- **Razón**: Después lo olvidan, mejor hacerlo en el momento de creación
- **Nota**: Esta interfaz ya existe en el chatbot y debe mejorarse (no es parte del portal)

---

## 📊 DASHBOARD - Tareas Pendientes del Coordinador

### Kardex "Por Pagar" = Tareas pendientes
- Mostrar en el dashboard los **registros de Kardex con estado "Por Pagar"**
- Estos son los que aún no se han incluido en una Orden de Servicio
- Posible indicador tipo **semáforo** (interfaz a definir)
- Son las tareas pendientes que el coordinador debe resolver

### 🤖 ALERTAS POR CHATBOT (Pendiente definir)
- Enviar alertas automáticas de Kardex pendientes
- **Condiciones a definir posteriormente** con el cliente
- Canal: Chatbot existente

---

## 💰 MÓDULO DE CAJA MENOR (Notas para desarrollo futuro)

### Aclaración importante sobre Órdenes de Servicio
- **NO se generan Órdenes de Servicio para pagos ya realizados por las cajas menores de los coordinadores**
- La Orden de Servicio es SOLO para solicitar pagos a Bogotá (pendientes)

### Flujo según canal de pago:

| Si el pago es por... | Proceso |
|---------------------|---------|
| **Caja Menor** | Se enlaza el Kardex al módulo de Caja Menor → Se valida con soportes/documentos |
| **Bogotá (Central)** | Se genera Orden de Servicio → Solicitud de pago pendiente |

### Módulo de Caja Menor - Funcionalidades:
1. **Enlazar registros de Kardex** que fueron pagados por caja menor
2. **Autenticar/Validar** los pagos con soportes (recibos, facturas)
3. **NO genera Orden de Servicio** - es validación de pago ya hecho

### Orden de Servicio - Rol único:
- **Solo para pagos pendientes** que se solicitan a Bogotá
- Cumple el rol de **solicitud de pago posterior**
- Coordinador solicita → Bogotá aprueba y paga

**Controles necesarios:**
- Marcar claramente cuándo el transporte es **"Sin Costo"** (lo asume el municipio u otro)
- Validar quién realmente presta el servicio antes de generar orden de pago
- Trazabilidad de quién define el estado de pago de cada Kardex

### ✅ ESTRATEGIA DE CONTROL - Registro en Chatbot
**Decisión:** Controlar desde el momento del registro de Kardex (en el chatbot)

- El chatbot de registro de Kardex debe **preguntar el estado de pago**
- Opciones: **Caja Menor**, **Sin Costo**, **Por Pagar**
- Si se marca como "Sin Costo" → **queda excluido automáticamente** de órdenes de servicio
- Si se marca como "Caja Menor" → va al módulo de Caja Menor (no a orden de servicio)
- Si se marca como "Por Pagar" → disponible para incluir en Orden de Servicio
- **Ventaja**: Imposible que un Kardex "Sin Costo" llegue a generar una orden de pago
- **Control preventivo** (en el registro) en vez de correctivo (después)

**Implementación:**
- [ ] Agregar campo en Kardex: `EstadoPago` (select: Caja Menor / Sin Costo / Por Pagar / En Orden)
- [ ] Agregar pregunta en chatbot: "¿Cómo se paga este transporte?" (obligatorio)
- [ ] Filtrar en órdenes de servicio: solo Kardex con `EstadoPago = "Por Pagar"`

### 🤔 PROBLEMA: ¿Quién valida si el coordinador miente?
El coordinador puede ser "Fulano el malo" de nuevo...

**Opciones de control adicional (a discutir):**
1. **Auditoría por municipio**: Si un municipio tiene convenio de transporte, TODOS sus Kardex deberían ser "Sin Costo" → Alertar inconsistencias
2. **Registro de convenios**: Tabla de municipios con convenios de transporte → validar automáticamente
3. **Reportes de anomalías**: Alertar si un coordinador tiene muchos "Por Pagar" vs otros coordinadores
4. **Revisión aleatoria**: Auditorías periódicas de una muestra de Kardex
5. **Doble confirmación**: Si hay convenio con municipio, preguntar "¿Estás seguro? Este municipio tiene convenio"

**Nota**: ❌ NO hay segundo nivel de aprobación - el coordinador autoriza directamente

**¿Cuál prefiere el cliente?**

### 💰 Formas de Cobro - Transporte (ENTRADA y SALIDA):
- **Por FLETE**: Total por camión (precio fijo por viaje)
- **Por KILO**: Según cantidad de material movido (precio × kg)

### 🏢 Proveedores/Beneficiarios - Tabla: Terceros
| Campo | Tipo |
|-------|------|
| `Autonumber` | ID |
| `RazonSocial` | Text |
| `NIT` | Text |
| `Direccion` | Text |

- Los **Terceros** son los proveedores a quienes se les paga en las órdenes
- Incluye: Gestores, Transportadores, y otras entidades que cobran

### 📋 Orden de Servicio - Campos clave
- **Coordinador**: Campo obligatorio - una orden pertenece a UN SOLO coordinador
- **Transportador/Beneficiario**: Campo obligatorio a nivel de ORDEN (aplica a todos los items)
  - En SALIDAS: El sistema **sugiere** el `gestor` del Kardex (pero es editable)
  - En ENTRADAS: Seleccionar manualmente (transportador u otra entidad de Terceros)
  - Siempre se elige de la tabla **Terceros**

### ⚠️ Otras Entidades que Cobran
- Hay entidades que cobran pero **NO son gestores**
- Todas se registran en la tabla **Terceros** (gestores, transportadores, otros proveedores)
- La tabla **Terceros** es suficiente para todos los casos

### ✅ DEFINICIONES CONFIRMADAS:
- [x] ¿Crear nuevo campo "Procesado" o "OrdenAsociada" en Kardex? → **SÍ, campo `EstadoPago` con 4 estados**
- [x] ¿La orden se genera solo de SALIDAS? → **NO, ambos tipos (ENTRADA y SALIDA)**
- [x] ¿Una orden agrupa Kardex de varios coordinadores? → **NO, una orden es de UN SOLO coordinador**
- [x] ¿El transportador se asigna por orden o por item? → **A nivel de ORDEN** (aplica a todos los items)
- [x] ¿Requiere aprobación de segundo nivel? → **NO**, el coordinador autoriza directamente
- [x] ¿Un Kardex puede estar en varias órdenes? → **NO, relación 1 Kardex → 1 Orden** (estricta)
- [x] ¿Se puede cambiar EstadoPago después de crear orden? → **NO, solo antes de crear la orden**
- [x] ¿Las órdenes tienen bloqueo por fecha? → **SÍ**, igual que Actividades y Kardex
- [x] ¿Forma de cobro se hereda del Kardex? → **NO, se define a nivel de ITEM** de la orden
- [x] ¿Los convenios con municipios afectan el sistema? → **NO**, son solo información referencial
- [x] ¿Identificador de orden? → **Consecutivo visible** (autonumber de Airtable), no el ID interno

---

## 🔒 REGLAS DE NEGOCIO CONSOLIDADAS

### 1. Relación Kardex ↔ Orden de Servicio
- Un registro de Kardex **solo puede asociarse a UNA orden de servicio**
- No existe división ni asociación parcial
- Una vez asociado → estado "En Orden" → **bloqueado para otras órdenes**
- ✔️ Relación estricta: **1 Kardex → 1 Orden**

### 2. Cambio manual de EstadoPago
- ✅ **Permitido**: Cambiar estado ANTES de crear la Orden de Servicio (en el portal)
- ❌ **Prohibido**: Cambiar estado DESPUÉS de que esté "En Orden"
- 💬 **Mensaje requerido** al crear orden: 
  > *"Después de crear la orden, no será posible modificar el estado de estos Kardex."*

### 3. ENTRADA + SALIDA DIRECTA (Campo → Gestor Final)
- El cobro es **INTEGRAL** (transporte + procesamiento en un solo pago)
- **Limitación conocida del chatbot**: No existe vinculación automática de dos registros de Kardex
- Se registra como un solo Kardex representando el movimiento
- La Orden de Servicio puede tener un Item SIN Kardex adicional para el cobro integral
- 📌 **Nota**: Esto queda documentado como limitación conocida, no como error

### 4. Bloqueo por fecha en Órdenes de Servicio
- Las órdenes **también están sujetas a bloqueo por fecha** (día 7 del mes siguiente)
- Órdenes de meses bloqueados:
  - ❌ No se pueden crear
  - ❌ No se pueden editar
  - ❌ No se pueden eliminar
  - ✅ Solo lectura
- ✔️ El criterio de bloqueo se aplica de forma **consistente a todo el sistema**

### 5. Servicios SIN Kardex
- **SÍ existe un listado formal**, pero la tabla **NO existe aún en Airtable**
- **Acción requerida**: Crear nueva tabla **"ServiciosSinKardex"** (o nombre similar)
- Campos sugeridos:
  - `Nombre` - Descripción del servicio
  - `Tipo` - Categoría (procesamiento, etc.)
  - `UnidadMedida` - Para cálculo de precio
- Los coordinadores **NO crean servicios libres** - solo seleccionan del catálogo
- 📌 Esto mejora control y estandarización

### 6. Forma de cobro (por kilo / por flete)
- Se define **a nivel de ITEM** de la Orden de Servicio
- **NO se hereda** del Kardex ni del Tercero
- Cada item define explícitamente:
  - Tipo de cobro: "Por Flete" / "Por Kilo"
  - Valores asociados (precio unitario, cantidad, etc.)
- ✔️ Máxima flexibilidad, controlada por item

### 7. Convenios con municipios
- **NO se trabajan como lógica del sistema**
- Los convenios:
  - NO generan validaciones automáticas
  - NO bloquean flujos
  - NO forman parte del desarrollo en esta fase
- **Uso**: Solo información referencial/informativa
- ✔️ Esto elimina complejidad innecesaria

### 8. Identificador de Orden de Servicio
- **Consecutivo visible obligatorio** (número entero positivo)
- Basado en **autonumber de Airtable**
- Visible para coordinadores y Bogotá
- Es el **identificador operativo oficial**
- 📌 El ID interno de Airtable NO se usa como referencia externa
- Campo sugerido: `NumeroOrden` (autonumber)

---

## 📝 PENDIENTES Y PREGUNTAS ABIERTAS

### Chatbot
- [ ] ¿Cuándo se mejorará el flujo del chatbot para preguntar `EstadoPago`?
- [ ] ¿Quién implementa las mejoras del chatbot? (¿equipo externo o interno?)

### Alertas
- [ ] **Condiciones** para enviar alertas de Kardex pendientes por chatbot (a definir con cliente)
- [ ] Umbral de días para semáforo en dashboard (rojo/amarillo/verde)

### Controles de Fraude
- [ ] ¿Cuál(es) de las opciones de control prefiere el cliente?
  - Auditoría por municipio
  - Registro de convenios
  - Reportes de anomalías
  - Revisión aleatoria
  - Doble confirmación

### Caja Menor
- [ ] ¿Qué soportes son obligatorios? (recibo, factura, fotos, etc.)
- [ ] ¿Se requiere aprobación adicional para Caja Menor?
- [ ] Definir flujo completo del módulo (dejado para fase futura)

### Otras Entidades que Cobran
- [ ] Definir si se necesita tabla adicional o campo específico
- [ ] Ejemplos de entidades que NO son gestores pero cobran servicios

---

## Notas Adicionales

*(Espacio para más notas durante la reunión)*

