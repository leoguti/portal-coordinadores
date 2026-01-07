# Reglas de Negocio Pendientes - Portal CampoLimpio

## 1. Validación de Saldos en Movimientos de Kardex

### Problema Identificado
- **Descripción**: Al crear movimientos de kardex, NO se valida que haya saldo disponible en el centro de acopio
- **Riesgo**: Se pueden generar SALIDAS de material aunque el centro tenga saldo = 0 o negativo
- **Ubicación del problema**: Portal web Y Bot de WhatsApp/TextIt

### Requisitos
- Al crear un movimiento de SALIDA con CentroAcopio, validar saldo disponible
- Calcular saldo actual del centro antes de permitir la salida
- Rechazar movimiento si: `saldo_actual - cantidad_salida < 0`
- Mensaje de error claro indicando saldo disponible vs cantidad solicitada

### Implementación Necesaria
1. **Portal web**: Validación al crear/editar kardex
2. **Bot de WhatsApp/TextIt**: Validación durante flujo de creación (más complejo)
3. **Considerar**: Validación por material específico (no solo total)

### Contexto Técnico
- Saldo se calcula como: `SaldoInicial + SUMA(ENTRADAS) - SUMA(SALIDAS)`
- Validación debe ser en tiempo real (antes de guardar en Airtable)
- Revisar si hay registros históricos con saldos negativos

### Prioridad
**ALTA** - Siguiente sesión

### Edge Cases a Considerar
- Múltiples usuarios creando salidas simultáneas
- Definir si se permite "reserva" o debe ser instantáneo
- Periodo de gracia o validación estricta

---

## 2. Optimización: Cache de Saldo Actual

### Problema de Performance
- **Descripción**: Cada consulta de saldo recalcula desde TODOS los movimientos históricos
- **Impacto**: Costoso en tiempo y llamadas API a Airtable
- **Cálculo actual**: `SaldoInicial + SUMA(todas_entradas_históricas) - SUMA(todas_salidas_históricas)`

### Solución Propuesta
Implementar campo **`SaldoActual`** en tabla CentroAcopio como cache del saldo.

### Estrategias Posibles

#### Opción 1: Trigger en Airtable
- Automation que se dispara al crear/editar registro de Kardex
- Actualiza automáticamente el campo SaldoActual del centro
- **Ventaja**: Sincronización automática
- **Desventaja**: Requiere plan Airtable con automations avanzadas

#### Opción 2: Webhook desde Portal/Bot
- Al crear movimiento, llamar endpoint que recalcula saldo
- Actualizar campo SaldoActual vía API
- **Ventaja**: Control total del proceso
- **Desventaja**: Punto único de falla

#### Opción 3: Lazy Update con Timestamp
- Guardar `UltimaActualizacionSaldo` en centro de acopio
- Comparar con última fecha de movimiento
- Si hay movimientos nuevos → recalcular y actualizar cache
- **Ventaja**: Balance entre performance y precisión
- **Desventaja**: Primera consulta después de movimiento es lenta

### Campos Necesarios en CentroAcopio
```
SaldoActualTotal: Number
SaldoActual_Reciclaje: Number
SaldoActual_Incineracion: Number
SaldoActual_Flexibles: Number
SaldoActual_PlasticoContaminado: Number
SaldoActual_Lonas: Number
SaldoActual_Carton: Number
SaldoActual_Metal: Number
UltimaActualizacionSaldo: DateTime
```

### Ventajas del Cache
- ✅ Consultas ultra-rápidas (solo leer un campo)
- ✅ Validación de saldos instantánea para regla #1
- ✅ Menos carga en Airtable API
- ✅ Escalable a miles de movimientos

### Consideraciones Críticas
- **Sincronización**: Evitar race conditions (dos movimientos simultáneos)
- **Recuperación**: Mecanismo de recalculo completo si cache se desincroniza
- **Timestamp**: Fundamental para detectar desincronización
- **Transaccionalidad**: Movimiento + actualización saldo deben ser "atómicos"

### Prioridad
**MEDIA** - Implementar después de regla #1

### Métricas a Monitorear
- Tiempo promedio de consulta de saldo (antes/después)
- Frecuencia de desincronización de cache
- Número de recalculos completos necesarios

---

## 3. Gestión de Caja Menor

### Descripción General
Sistema para administrar la caja menor de cada coordinador, controlando ingresos (envíos de Bogotá) y egresos (órdenes de servicio y gastos varios), con validación de saldo y comprobantes obligatorios.

### Estructura
- **Ámbito**: Cada coordinador tiene su propia caja menor independiente
- **Administración**: Cada coordinador administra su propia caja
- **Cálculo de saldo**: `SUMA(INGRESOS) - SUMA(EGRESOS)` histórico
- **Validación**: NO permitir egresos si saldo insuficiente (como kardex)
- **Periodo de gracia**: 7 días después del cierre del mes (igual que kardex)

---

### 3.1. INGRESOS a Caja Menor

#### Características
- **Tipo único**: Transferencia bancaria desde Bogotá
- **No hay otros tipos de ingreso** por ahora

#### Campos requeridos
```
Coordinador: Link to Coordinadores
Fecha: Date
Monto: Currency
Concepto: "Transferencia desde Bogotá" (fijo o editable)
Comprobante: Attachment (obligatorio)
NumeroTransferencia: Text (opcional)
```

#### Validación
- Fecha requerida
- Monto > 0
- Comprobante obligatorio (foto de comprobante bancario)

---

### 3.2. EGRESOS de Caja Menor

#### Tipos de Egresos

**A) Órdenes de Servicio (OS) con FormaDePago = "Caja Menor"**
- **Automático**: Al marcar una OS como "Caja Menor", se crea automáticamente registro de egreso
- **Monto**: Campo `Total` de la OS
- **Fecha**: Fecha de la OS
- **Tercero**: Viene de la OS
- **Relación**: Link a la OrdenServicio en Airtable

**B) Gastos Directos (sin OS)**
Ejemplos: materiales, operarios, transportes, almuerzos, peajes, combustibles, compras pequeñas

#### Campos requeridos para gastos directos
```
Coordinador: Link to Coordinadores
Fecha: Date
Monto: Currency
Concepto: Text (descripción del gasto)
Tercero: Link to Terceros (obligatorio)
Comprobante: Attachment (obligatorio - foto de factura/recibo)
OrdenServicio: Link (null si es gasto directo)
TipoGasto: "Orden de Servicio" | "Gasto Directo"
```

#### Gestión de Terceros
- **Tabla nueva**: `Terceros` en Airtable
- **Campos mínimos**:
  ```
  Nombre: Text (requerido)
  Cedula: Text (requerido, único)
  Telefono: Text (opcional)
  Email: Text (opcional)
  Tipo: "Persona Natural" | "Empresa" (opcional)
  ```
- **Creación**: 
  - Al crear gasto, seleccionar tercero de lista existente
  - Si no existe, **solo administrador puede crear nuevos terceros**
  - Coordinador debe solicitar creación de tercero faltante

#### Validaciones de Egresos
- Fecha requerida
- Monto > 0
- **Saldo suficiente**: `saldo_actual - monto_egreso >= 0`
- Comprobante obligatorio (TODOS los gastos)
- Tercero obligatorio
- Concepto requerido

---

### 3.3. Estructura de Datos en Airtable

#### Opción Propuesta: Tabla única `CajaMenor`
```
ID: Autonumber
Tipo: Single Select ["INGRESO", "EGRESO"]
Coordinador: Link to Coordinadores (requerido)
Fecha: Date (requerido)
Monto: Currency (requerido, > 0)
Concepto: Long Text (requerido)
Comprobante: Attachment (requerido)
Tercero: Link to Terceros (solo para EGRESOS)
OrdenServicio: Link to OrdenesServicio (solo si aplica)
TipoGasto: Single Select ["Orden de Servicio", "Gasto Directo"] (solo EGRESOS)
NumeroTransferencia: Text (solo INGRESOS, opcional)
MES: Formula (como en Kardex)
FechaCierre: Date (calculado: último día del mes + 7 días)
Estado: Single Select ["Abierto", "Cerrado"] (después de periodo de gracia)
```

#### Tabla nueva: `Terceros`
```
ID: Autonumber
Nombre: Text (requerido)
Cedula: Text (requerido, único)
Telefono: Text
Email: Email
Tipo: Single Select ["Persona Natural", "Empresa"]
FechaCreacion: Created Time
CreadoPor: Link to Usuarios
Activo: Checkbox (default: true)
Notas: Long Text
```

---

### 3.4. Integración con Órdenes de Servicio

#### Proceso Automático
1. Coordinador crea/edita Orden de Servicio
2. Selecciona FormaDePago = "Caja Menor"
3. **Sistema automáticamente**:
   - Valida que coordinador tenga saldo suficiente
   - Si saldo OK: Crea registro en tabla CajaMenor:
     ```
     Tipo = "EGRESO"
     Coordinador = [de la OS]
     Fecha = [fecha OS]
     Monto = [Total OS]
     Concepto = "Orden de Servicio #[ID OS]"
     Tercero = [Tercero de la OS]
     OrdenServicio = [Link a OS]
     TipoGasto = "Orden de Servicio"
     Comprobante = [Comprobante de la OS]
     ```
   - Si saldo insuficiente: Rechazar y mostrar error

#### Cambios en tabla OrdenesServicio
- Ya existe campo `FormaDePago`
- Agregar validación de saldo antes de guardar si es "Caja Menor"
- Mostrar saldo disponible al coordinador

---

### 3.5. Vistas y Reportes Necesarios

#### Vista: Saldo Actual
Por coordinador mostrar:
- **Saldo disponible**: `SUMA(INGRESOS) - SUMA(EGRESOS)`
- Total ingresos (histórico)
- Total egresos (histórico)
- Último movimiento (fecha y concepto)

#### Vista: Movimientos de Caja Menor
- Filtrable por coordinador, fecha, tipo
- Columnas: Fecha, Tipo, Concepto, Tercero, Monto, Saldo Acumulado, Comprobante
- Similar a vista de Kardex

#### Vista: Movimientos por Periodo
- Selector de mes/año (últimos 12 meses)
- Ingresos del periodo
- Egresos del periodo
- Saldo final del periodo
- Estado (Abierto/Cerrado según periodo de gracia)

---

### 3.6. Validaciones y Reglas de Negocio

#### Al crear EGRESO
1. ✅ Validar saldo suficiente: `saldo_actual >= monto_egreso`
2. ✅ Comprobante obligatorio (foto)
3. ✅ Tercero obligatorio
4. ✅ Fecha no puede ser futura
5. ✅ Monto > 0

#### Al crear INGRESO
1. ✅ Comprobante obligatorio
2. ✅ Fecha no puede ser futura
3. ✅ Monto > 0

#### Periodo de Gracia (7 días)
- Movimientos pueden registrarse hasta 7 días después del fin de mes
- Ejemplo: Gastos de Enero pueden registrarse hasta el 7 de Febrero
- Después del día 7, el mes se considera "cerrado"
- Campo `Estado` cambia a "Cerrado"

#### Sin Periodo de Gracia
- NO se pueden crear/editar movimientos de meses cerrados
- Solo lectura de históricos

---

### 3.7. Implementación Técnica

#### Fase 1: Backend
- [ ] Crear tabla `CajaMenor` en Airtable
- [ ] Crear tabla `Terceros` en Airtable
- [ ] Agregar tipos a `lib/airtable.ts`
- [ ] Crear API endpoint para validar saldo: `/api/caja-menor/validar-saldo`
- [ ] Crear API endpoint CRUD: `/api/caja-menor`
- [ ] Crear API endpoint para terceros: `/api/terceros`

#### Fase 2: Integración con OS
- [ ] Modificar lógica de guardar OS
- [ ] Al cambiar FormaDePago a "Caja Menor", validar saldo
- [ ] Crear registro automático en CajaMenor
- [ ] Si se edita OS, actualizar registro de caja menor asociado

#### Fase 3: Portal Web
- [ ] Crear página `/caja-menor` (listado de movimientos)
- [ ] Crear página `/caja-menor/nuevo-ingreso`
- [ ] Crear página `/caja-menor/nuevo-egreso`
- [ ] Mostrar saldo actual en dashboard principal
- [ ] Vista de saldo por periodo (selector de mes)
- [ ] Gestión de terceros (solo admin)

#### Fase 4: Validaciones
- [ ] Implementar validación de saldo en tiempo real
- [ ] Mostrar mensaje claro de error si saldo insuficiente
- [ ] Validar periodo de gracia (7 días)
- [ ] Bloquear edición de meses cerrados

---

### 3.8. Preguntas Pendientes de Definir

#### Sobre Alertas de Saldo Bajo
- ❓ ¿A partir de qué monto se considera "saldo bajo"?
  - ¿$50,000? ¿$100,000? ¿Configurable por coordinador?
- ❓ ¿Cómo alertar? 
  - Email automático
  - Notificación en portal
  - Banner en pantalla principal
  - Combinación de las anteriores

#### Sobre Estructura de Datos
- ❓ ¿Preferencia por tabla única `CajaMenor` o dos tablas separadas (`Ingresos`/`Egresos`)?
  - Recomendación actual: Tabla única con campo `Tipo`

#### Sobre Reportes
- ❓ ¿Necesitan categorías de gastos? (combustible, materiales, etc)
  - Respuesta actual: NO por ahora
  - ¿Agregar en el futuro?

#### Sobre Comprobantes
- ❓ ¿Validación del formato de comprobante? (solo fotos, también PDFs)
- ❓ ¿Tamaño máximo de archivo?
- ❓ ¿Nombrar archivos con convención específica?

#### Sobre Terceros
- ❓ ¿Validación de cédula? (formato, existencia)
- ❓ ¿Tercero puede estar inactivo? (soft delete vs hard delete)
- ❓ ¿Auditoría de cambios en terceros?

#### Sobre Topes y Límites
- ❓ ¿Hay monto máximo para un gasto individual?
- ❓ ¿Requiere aprobación especial para gastos grandes?
- ❓ ¿Límite de movimientos por día/mes?

#### Sobre Conciliación
- ❓ ¿Proceso de conciliación mensual?
- ❓ ¿Revisión/aprobación por administrador?
- ❓ ¿Exportar reporte para contabilidad?

---

### 3.9. Prioridad y Orden de Implementación

**Prioridad**: MEDIA-ALTA (después de validación de saldos de kardex)

**Orden sugerido**:
1. Crear tablas en Airtable (CajaMenor, Terceros)
2. Implementar CRUD básico de movimientos (sin OS)
3. Agregar validación de saldo
4. Crear vistas en portal web
5. Integrar con Órdenes de Servicio
6. Implementar alertas de saldo bajo
7. Agregar reportes avanzados

---

## Notas de Implementación

### Orden Sugerido
1. **Primero**: Implementar validación de saldos (regla #1)
   - Usar cálculo en tiempo real inicialmente
   - Validar que funcione correctamente
   
2. **Segundo**: Optimizar con cache (regla #2)
   - Una vez validación probada, agregar cache
   - Mantener cálculo en tiempo real como fallback

### Testing Necesario
- [ ] Crear SALIDA con saldo suficiente → OK
- [ ] Crear SALIDA con saldo insuficiente → RECHAZAR
- [ ] Crear SALIDA cuando saldo = exactamente la cantidad → OK
- [ ] Movimientos simultáneos de diferentes usuarios
- [ ] Recuperación de cache desincronizado

### Documentación Adicional
Ver también:
- `lib/airtable.ts` - Campos SaldoInicial ya implementados (líneas 127-134)
- `app/saldos-centros/page.tsx` - Cálculo actual de saldos (líneas 158-183)
- `PLAN_IMPLEMENTACION.md` - Plan general del proyecto
