# Especificacion: Vincular Kardex "Caja Menor" a Gastos

## Contexto

Cuando un coordinador paga un flete de transporte con fondos de caja menor, crea un registro de Kardex con `EstadoPago = "Caja Menor"`. Actualmente no hay trazabilidad entre ese Kardex y el gasto de caja menor que lo respalda.

Esta funcionalidad permite vincular uno o mas registros de Kardex a un gasto de caja menor, de forma similar a como las Ordenes de Servicio agrupan Kardex "Por Pagar".

## Flujo

1. Coordinador crea un gasto de caja menor normalmente (fecha, beneficiario, concepto, valor, factura)
2. **Opcionalmente** selecciona uno o mas Kardex con `EstadoPago = "Caja Menor"` que corresponden a ese pago
3. El gasto se crea con el link a los Kardex seleccionados
4. El Kardex mantiene su `EstadoPago = "Caja Menor"` (no cambia de estado)
5. La trazabilidad queda establecida por el campo link

## Cambios en Airtable (manual, usuario)

### GastosCajaMenor — nuevo campo
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| Kardex | Link -> Kardex | Registros de Kardex cubiertos por este gasto (multiple) |

El campo reciproco aparece automaticamente en la tabla Kardex.

## Cambios en codigo

### 1. `lib/airtable.ts`

**Tipo `GastoCajaMenorFields`**: agregar `Kardex?: string[]`

**Nueva funcion `getKardexCajaMenorDisponibles(coordinatorRecordId)`**:
- Obtiene Kardex con `EstadoPago = "Caja Menor"` del coordinador
- Excluye los que ya estan vinculados a un gasto (campo reciproco no vacio)
- Retorna lista para el selector

**Modificar `createGastoCajaMenor()`**: agregar parametro opcional `kardexIds?: string[]`
- Si se proporcionan, incluir `Kardex: kardexIds` en los fields al crear

### 2. `app/api/caja-menor/route.ts`

**POST**: aceptar campo opcional `kardexIds` en el body y pasarlo a `createGastoCajaMenor()`

### 3. Nueva API: `app/api/kardex/caja-menor/route.ts`

**GET**: retorna Kardex disponibles para vincular (EstadoPago = "Caja Menor", del coordinador, sin gasto vinculado)

### 4. `app/caja-menor/nuevo/page.tsx`

**UI**: agregar seccion opcional "Vincular Kardex" debajo del formulario actual:
- Boton "Vincular Kardex" que despliega un selector
- Lista de Kardex disponibles con checkbox (muestra: #idkardex, fecha, municipio origen, total kg)
- Kardex seleccionados se muestran como chips/tags removibles
- Campo es opcional — si no se selecciona ninguno, el gasto se crea sin vinculo

### 5. `app/caja-menor/[id]/page.tsx`

**Vista detalle**: si el gasto tiene Kardex vinculados, mostrar seccion "Kardex vinculados" con:
- Lista de Kardex (#idkardex, fecha, municipio, total kg)
- Link a detalle del Kardex si existe la pagina

### 6. `docs/REGLAS_NEGOCIO_CAJA_MENOR.md`

Agregar seccion sobre vinculacion de Kardex.

## Reglas de negocio

- La vinculacion de Kardex es **opcional** (la mayoria de gastos no tienen Kardex)
- Solo se muestran Kardex con `EstadoPago = "Caja Menor"` del mismo coordinador
- Un Kardex solo puede estar vinculado a **un** gasto de caja menor
- Kardex ya vinculados a otro gasto no aparecen en el selector
- El `EstadoPago` del Kardex **no cambia** al vincularse (se queda "Caja Menor")
- La vinculacion se hace al **crear** el gasto (no al editar)
- El valor del gasto lo ingresa el coordinador manualmente (no se calcula desde Kardex)

## Categoria del gasto

Los gastos de caja menor deben categorizarse. Nuevo campo `Categoria` (single select) en GastosCajaMenor.

### Asignacion automatica
- Si el gasto tiene Kardex vinculados → categoria se asigna automaticamente como **"Transporte"** (o la que se defina para fletes)
- El coordinador no necesita seleccionarla manualmente en ese caso

### Asignacion manual
- Si el gasto **no** tiene Kardex vinculados → el coordinador selecciona la categoria de una lista predefinida
- El campo es **obligatorio** para todos los gastos

### Categorias propuestas (pendiente definir con cliente)
Las categorias exactas deben ser definidas por la clienta. Ejemplos posibles:
- Transporte (automatica para gastos con Kardex)
- Alimentacion
- Hospedaje
- Papeleria
- Comunicaciones
- Otros

> **PENDIENTE**: La clienta debe definir la lista final de categorias antes de implementar. Una vez definidas, se configuran como opciones del single select en Airtable y en el formulario.

### Cambios en Airtable
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| Categoria | Single select | Categoria del gasto (obligatorio) |

### Cambios en codigo
- **`GastoCajaMenorFields`**: agregar `Categoria?: string`
- **`createGastoCajaMenor()`**: agregar parametro `categoria: string`
- **Formulario nuevo gasto**: dropdown de categoria (obligatorio). Si hay Kardex vinculados, se preselecciona "Transporte" y se puede cambiar
- **Tabla de gastos**: mostrar columna Categoria
- **Filtros admin**: agregar filtro por Categoria

## No se requiere

- No se necesita tabla nueva
- No se cambia el estado del Kardex
- No se crea gasto automaticamente al crear Kardex
- No se vinculan Kardex al editar/corregir un gasto existente
