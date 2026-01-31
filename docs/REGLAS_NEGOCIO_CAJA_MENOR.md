# Reglas de Negocio - Caja Menor

## Flujo General

1. Admin asigna un anticipo fijo a cada coordinador (una sola vez)
2. Coordinador registra gastos con factura adjunta
3. Admin revisa y aprueba/rechaza cada gasto individualmente
4. Si rechazado, coordinador puede corregir y reenviar
5. Admin selecciona gastos aprobados en lote y crea un reembolso
6. Al crear reembolso, los gastos pasan a estado "Reembolsado" y el saldo se repone

## Registro de Gasto

- **Fecha**: Misma regla de 7 dias (primeros 7 dias del mes se puede registrar mes anterior, cierra ultimo dia del mes)
- **Beneficiario**: Vinculado a tabla Terceros existente. Si no existe, se puede crear uno nuevo
- **Identificacion**: Campo NIT de Terceros (sirve para NIT o cedula, mismo campo)
- **Direccion**: Se toma de Terceros; si no la tiene, coordinador la ingresa y se actualiza
- **Concepto**: Descripcion del gasto
- **Valor**: Monto en pesos colombianos (COP)
- **% Retencion**: El coordinador ingresa manualmente el porcentaje (ej: 6%)
- **Valor Retencion**: Calculado automaticamente = Valor x %Retencion / 100
- **Valor Neto (Legalizacion)**: Calculado = Valor - Valor Retencion
- **Factura**: Adjunto obligatorio (soporte del gasto)

## Estados de un Gasto

| Estado       | Descripcion                                         |
|--------------|-----------------------------------------------------|
| Pendiente    | Recien registrado, esperando revision del admin      |
| Aprobado     | Admin valido el gasto                                |
| Rechazado    | Admin rechazo (coordinador puede corregir y reenviar)|
| Reembolsado  | Incluido en un reembolso en lote, saldo repuesto     |

## Calculo de Saldo

```
Saldo = Anticipo - Gastos con Estado "Aprobado"
```

- Los gastos "Reembolsado" ya no restan del saldo (liberan el cupo).
- Los gastos "Pendiente" y "Rechazado" no afectan el saldo.

## Anticipo Fijo

- Cada coordinador tiene **un unico anticipo** (no mensual).
- El admin puede editar el monto del anticipo en cualquier momento.
- No se permite asignar dos anticipos al mismo coordinador.

## Reembolsos en Lote

- El admin selecciona uno o mas gastos con estado "Aprobado" de un mismo coordinador.
- Al crear el reembolso:
  - Se crea un registro en `ReembolsosCajaMenor` vinculando los gastos.
  - Cada gasto seleccionado cambia a estado "Reembolsado".
  - El monto total del reembolso es la suma de los `ValorNeto` de los gastos.
- Cada reembolso queda registrado con numero, fecha, coordinador, gastos y observaciones.
- Los gastos reembolsados enlazan de vuelta al registro del reembolso.

### Gastos Legacy

Gastos marcados como "Reembolsado" antes de la implementacion de reembolsos en lote no tienen campo `Reembolso` vinculado. Se muestran como "Reembolsado (legacy)" sin enlace.

## Roles

### Coordinador
- Registra gastos con factura adjunta
- Ve solo sus propios gastos y reembolsos
- Corrige gastos rechazados y los reenvia
- No puede editar gastos aprobados
- No puede eliminar gastos aprobados

### Administrador
- Ve todos los gastos de todos los coordinadores
- Aprueba o rechaza gastos pendientes
- Agrega observaciones al aprobar/rechazar
- Asigna anticipo fijo a coordinadores
- Edita el monto del anticipo
- Crea reembolsos en lote (seleccion multiple de gastos aprobados)

## Regla de 7 Dias

La misma regla que aplica para Kardex y Actividades:
- **Dias 1-7 del mes**: Se pueden crear/editar/eliminar registros del mes actual y anterior
- **Despues del dia 7**: Solo se pueden crear/editar/eliminar registros del mes actual

## Restricciones de Eliminacion

- Solo se pueden eliminar gastos con estado **Pendiente**
- La eliminacion tambien esta sujeta a la regla de 7 dias
- Los gastos **Aprobados** nunca se pueden eliminar
- Los gastos **Rechazados** no se eliminan, se corrigen y reenvian
- Los gastos **Reembolsados** nunca se pueden eliminar

## Schema Airtable

### Tabla: GastosCajaMenor

| Campo                | Tipo                    | Descripcion                          |
|----------------------|-------------------------|--------------------------------------|
| NumeroGasto          | Autonumber              | Consecutivo visible (#1, #2...)      |
| Fecha                | Date                    | Fecha del gasto                      |
| Coordinador          | Link -> Coordinadores   | Quien registra                       |
| NombreCoordinador    | Lookup                  | Para mostrar sin fetch extra         |
| Beneficiario         | Link -> Terceros        | A quien se pago                      |
| RazonSocial          | Lookup (from Beneficiario) | Nombre del beneficiario           |
| NIT                  | Lookup (from Beneficiario) | NIT/Cedula                        |
| Concepto             | Single line text        | Descripcion del gasto                |
| Valor                | Currency (COP)          | Monto bruto                          |
| PorcentajeRetencion  | Number (%)              | % de retencion en la fuente          |
| ValorRetencion       | Formula                 | Valor x PorcentajeRetencion / 100    |
| ValorNeto            | Formula                 | Valor - ValorRetencion               |
| Factura              | Attachment              | Soporte/factura del gasto            |
| Estado               | Single select           | Pendiente / Aprobado / Rechazado / Reembolsado |
| ObservacionesAdmin   | Long text               | Notas del admin al aprobar/rechazar  |
| MesLegalizacion      | Formula                 | DATETIME_FORMAT(Fecha, "YYYY-MM")    |
| Reembolso            | Link -> ReembolsosCajaMenor | Reembolso que incluye este gasto |

### Tabla: AsignacionesCajaMenor

| Campo                | Tipo                    | Descripcion                          |
|----------------------|-------------------------|--------------------------------------|
| Coordinador          | Link -> Coordinadores   | A quien se asigna                    |
| NombreCoordinador    | Lookup                  | Nombre                               |
| MontoAsignado        | Currency (COP)          | Anticipo fijo                        |

### Tabla: ReembolsosCajaMenor

| Campo                | Tipo                    | Descripcion                          |
|----------------------|-------------------------|--------------------------------------|
| NumeroReembolso      | Autonumber              | Consecutivo (#1, #2...)              |
| Coordinador          | Link -> Coordinadores   | Coordinador del reembolso            |
| NombreCoordinador    | Lookup                  | Nombre del coordinador               |
| Fecha                | Date                    | Fecha de creacion del reembolso      |
| Gastos               | Link -> GastosCajaMenor | Gastos incluidos (multiples)         |
| MontoTotal           | Rollup (SUM ValorNeto)  | Suma de ValorNeto de los gastos      |
| Observaciones        | Long text               | Notas del admin                      |
