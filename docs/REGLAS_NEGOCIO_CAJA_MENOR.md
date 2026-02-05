# Reglas de Negocio - Caja Menor

**Ultima actualizacion:** 5 de febrero de 2026

## Flujo General

1. Admin asigna un **saldo inicial** a cada coordinador (una sola vez)
2. Coordinador registra gastos/facturas con comprobante adjunto
3. Admin revisa y aprueba/rechaza cada gasto (puede agregar observaciones al aprobar)
4. Si rechazado, coordinador puede corregir y reenviar
5. Admin crea reembolsos con **monto libre** (sin vinculacion a gastos especificos)
6. El saldo se calcula automaticamente

## Calculo de Saldo

```
Saldo = Saldo Inicial + Total Reembolsos - Total Facturas Aprobadas
```

- **Saldo Inicial**: Valor con el que comienza cada coordinador (campo en tabla Coordinadores)
- **Total Reembolsos**: Suma de todos los reembolsos recibidos
- **Total Facturas Aprobadas**: Suma del ValorNeto de gastos con estado "Aprobado"

> **Nota**: No hay tope ni restriccion de saldo. El coordinador puede tener saldo negativo si sus gastos superan los reembolsos recibidos.

## Registro de Gasto/Factura

- **Fecha**: Regla de 7 dias (primeros 7 dias del mes se puede registrar mes anterior)
- **Beneficiario**: Vinculado a tabla Terceros existente. Si no existe, se puede crear uno nuevo
- **Identificacion**: Campo NIT de Terceros (sirve para NIT o cedula)
- **Direccion**: Se toma de Terceros; si no la tiene, coordinador la ingresa y se actualiza
- **Concepto**: Descripcion del gasto
- **Valor**: Monto en pesos colombianos (COP)
- **% Retencion**: El coordinador ingresa manualmente el porcentaje (ej: 6%)
- **Valor Retencion**: Calculado automaticamente = Valor x %Retencion / 100
- **Valor Neto**: Calculado = Valor - Valor Retencion
- **Factura/Comprobante**: Adjunto obligatorio (soporte del gasto)

## Estados de un Gasto

| Estado       | Descripcion                                         |
|--------------|-----------------------------------------------------|
| Pendiente    | Recien registrado, esperando revision del admin      |
| Aprobado     | Admin valido el gasto (puede incluir observaciones)  |
| Rechazado    | Admin rechazo (coordinador puede corregir y reenviar)|

> **Nota**: Ya no existe el estado "Reembolsado". Los gastos aprobados permanecen como "Aprobados".

## Reembolsos

Los reembolsos son **pagos con monto libre** que el admin registra para reponer dinero al coordinador.

### Caracteristicas
- **Sin vinculacion a gastos**: El monto del reembolso no depende de gastos especificos
- **Monto libre**: El admin puede poner cualquier valor
- **Sin validacion de tope**: No hay restriccion de cuanto se puede reembolsar

### Campos del Reembolso
| Campo           | Descripcion                          |
|-----------------|--------------------------------------|
| Coordinador     | A quien se le reembolsa              |
| Monto           | Valor del reembolso (libre)          |
| Fecha           | Fecha del reembolso                  |
| Observaciones   | Notas del admin                      |

## Vista Unificada

La interfaz muestra una **lista unificada** con:
- Facturas/gastos registrados
- Reembolsos recibidos
- Sumatoria de facturas del mes
- Sumatoria de reembolsos del mes
- **Saldo actual** (Saldo Inicial + Reembolsos - Facturas Aprobadas)

## Roles

### Coordinador
- Registra gastos/facturas con comprobante adjunto
- Ve solo sus propios gastos y reembolsos
- Corrige gastos rechazados y los reenvia
- No puede editar gastos aprobados
- No puede eliminar gastos aprobados
- Ve su saldo actual

### Administrador
- Ve todos los gastos de todos los coordinadores
- Aprueba o rechaza gastos pendientes
- Agrega observaciones al aprobar/rechazar
- Edita el saldo inicial (campo en tabla Coordinadores)
- Crea reembolsos con monto libre

## Regla de 7 Dias

La misma regla que aplica para Kardex y Actividades:
- **Dias 1-7 del mes**: Se pueden crear/editar/eliminar registros del mes actual y anterior
- **Despues del dia 7**: Solo se pueden crear/editar/eliminar registros del mes actual

## Restricciones de Eliminacion

- Solo se pueden eliminar gastos con estado **Pendiente**
- La eliminacion tambien esta sujeta a la regla de 7 dias
- Los gastos **Aprobados** nunca se pueden eliminar
- Los gastos **Rechazados** no se eliminan, se corrigen y reenvian

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
| Estado               | Single select           | Pendiente / Aprobado / Rechazado     |
| ObservacionesAdmin   | Long text               | Notas del admin al aprobar/rechazar  |
| MesLegalizacion      | Formula                 | DATETIME_FORMAT(Fecha, "YYYY-MM")    |

### Tabla: Coordinadores (campo adicional)

| Campo                | Tipo                    | Descripcion                          |
|----------------------|-------------------------|--------------------------------------|
| SaldoInicialCajaMenor | Currency (COP)         | Saldo inicial para caja menor        |

> **Nota**: El saldo inicial se guarda directamente en la tabla Coordinadores, no requiere tabla separada.

### Tabla: ReembolsosCajaMenor

| Campo                | Tipo                    | Descripcion                          |
|----------------------|-------------------------|--------------------------------------|
| NumeroReembolso      | Autonumber              | Consecutivo (#1, #2...)              |
| Coordinador          | Link -> Coordinadores   | Coordinador del reembolso            |
| NombreCoordinador    | Lookup                  | Nombre del coordinador               |
| Fecha                | Date                    | Fecha del reembolso                  |
| Monto                | Currency (COP)          | Valor del reembolso (libre)          |
| Observaciones        | Long text               | Notas del admin                      |

---

## Cambios respecto a version anterior

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| Anticipo fijo | Si (tope de gasto) | **No** - Saldo inicial sin tope |
| Calculo saldo | Anticipo - Gastos Aprobados | **Saldo Inicial + Reembolsos - Facturas Aprobadas** |
| Reembolso | Vinculado a gastos especificos | **Monto libre, sin vinculacion** |
| Estados gasto | Pendiente/Aprobado/Rechazado/Reembolsado | **Pendiente/Aprobado/Rechazado** |
| Vista | Gastos y reembolsos separados | **Lista unificada con saldo** |
| Tope de gasto | Si (no podia exceder anticipo) | **No hay tope** |
