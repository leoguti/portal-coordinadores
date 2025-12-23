# Implementación Airtable - Órdenes de Servicio

**Fecha de inicio:** 23 de diciembre de 2024
**Responsable:** Leonardo Gutiérrez
**Objetivo:** Configurar las tablas y campos necesarios en Airtable para el módulo de Órdenes de Servicio

---

## 📋 CHECKLIST PRINCIPAL

### ✅ Resumen de progreso
- [X] Tabla CatalogoServicios - 0/5 campos
- [ ] Tabla Kardex - 0/1 campo nuevo
- [ ] Tabla Ordenes - 0/4 campos nuevos/actualizados
- [ ] Tabla ItemsOrden - 0/3 campos nuevos

---

## 1️⃣ CREAR TABLA: CatalogoServicios

**Propósito:** Catálogo de servicios que NO están asociados a Kardex (ej: procesamiento en planta, clasificación manual, etc.)

### Campos a crear:

- [X] **Campo 1: `Nombre`**
  - Tipo: `Single line text`
  - Descripción: Nombre del servicio
  - Ejemplos: "Procesamiento en planta", "Clasificación manual", "Almacenamiento temporal"
  - ¿Requerido?: ✅ Sí
  - **Notas:**
    ```
    [Espacio para tus notas]
    ```

- [X] **Campo 2: `Descripcion`**
  - Tipo: `Long text`
  - Descripción: Descripción detallada del servicio
  - Ejemplo: "Procesamiento y clasificación de material reciclable en planta industrial"
  - ¿Requerido?: ❌ No (opcional)
  - **Notas:**
    ```
    [Espacio para tus notas]
    ```

- [X] **Campo 3: `Categoria`**
  - Tipo: `Single select`
  - Opciones sugeridas:
    - `Procesamiento`
    - `Clasificación`
    - `Almacenamiento`
    - `Transporte interno`
    - `Otros`
  - ¿Requerido?: ✅ No 
  - **Notas:**
    ```
    (Creo que por ahora no es necesario Categoria no son tantos)

- [X] **Campo 4: `UnidadMedida`**
  - Tipo: `Single select`
  - Opciones **EXACTAS** (importantes para el portal):
    - `Por Flete`
    - `Por Kilo`
    - `Por Hora`
    - `Por Mes`
    - `Precio Fijo`
    - `Otro`
  - ¿Requerido?: ✅ Sí
  - **Notas:**
    ```
    Puse global pero no estoy seguro si mis clientes entiendasn .. a veces se hacen servicios que se pagan sin detallar hora ni flete simplente se acuerda una tarifa .   tambien hay Mes que corresponde a posibles servicios de Arredamiento. 
    ```

- [X] **Campo 5: `Activo`**
  - Tipo: `Checkbox`
  - Descripción: Si el servicio está disponible para selección en el portal
  - Valor por defecto: ✅ Checked (activo)
  - **Notas:**
    ```
    [Espacio para tus notas]
    ```

### 📝 Datos de prueba sugeridos:
Después de crear la tabla, agrega al menos 2-3 servicios de ejemplo para testing:

- [ ] **Servicio ejemplo 1**
  - Nombre: "Procesamiento en planta"
  - Categoría: Procesamiento
  - UnidadMedida: Por Kilo
  - Activo: ✅

- [ ] **Servicio ejemplo 2**
  - Nombre: "Clasificación manual"
  - Categoría: Clasificación
  - UnidadMedida: Por Hora
  - Activo: ✅

- [ ] **Servicio ejemplo 3**
  - Nombre: "Almacenamiento temporal"
  - Categoría: Almacenamiento
  - UnidadMedida: Por Flete
  - Activo: ✅

**Notas generales sobre CatalogoServicios:**
```
Es necesario hacer un enlace con las ordenes o los items de las ordenes?   o solo sera una cosa de consulta?   se pegan los datos alli .. cual es la mejor practica. habia pensado que necesito conectarla a items de orden pero no estoy seguro .. que se acostumbra o cual es la mejor práctica? 
```

---

## 2️⃣ MODIFICAR TABLA: Kardex

**Propósito:** Agregar campo para manejar los 4 estados de pago

### Campos a agregar:

- [X] **Campo NUEVO: `EstadoPago`**
  - Tipo: `Single select`
  - Opciones **EXACTAS** (en este orden):
    1. `Caja Menor` (color: verde)
    2. `Sin Costo` (color: gris)
    3. `Por Pagar` (color: amarillo/naranja)
    4. `En Orden` (color: azul)
  - ¿Requerido?: ⚠️ **Idealmente SÍ, pero puede ser opcional inicialmente**
    - Si lo haces opcional: registros viejos quedarán sin valor
    - Si lo haces obligatorio: deberás actualizar registros existentes
  - Valor por defecto sugerido: `Por Pagar`
  - **Decisión que debes tomar:**
    - [ ] Lo hago OPCIONAL (más fácil, pero menos estricto)
    - [ ] Lo hago OBLIGATORIO y actualizo registros existentes manualmente
    - [X] Lo hago OBLIGATORIO y pongo valor por defecto "Por Pagar" en todos los existentes
  - **Notas:**
    ```
    [Espacio para tus notas y decisión tomada]
    ```

### 📝 Validación post-creación:

- [X] Verificar que el campo `EstadoPago` aparece en la tabla Kardex
- [X] Verificar que las 4 opciones están disponibles
- [X] Verificar que los colores se ven distintos
- [x] Crear 1 registro de prueba con cada estado para validar

**Notas generales sobre modificación de Kardex:**
```
[¿Cuántos registros existentes tienes en Kardex? ¿Necesitas ayuda para decidir si hacerlo obligatorio?]
```
hAY 2105 REGISTROS .. PERO HE CREADO DE PRUEBAS CON FECHA DE HOY 
---

## 3️⃣ MODIFICAR TABLA: Ordenes

**Propósito:** Asegurar que la tabla tiene todos los campos necesarios para el portal

### Campos a verificar/crear:

- [X] **Campo: `NumeroOrden`** (**CRÍTICO**)
  - ¿Ya existe?: [X] Sí [ ] No
  - Si NO existe, crear:
    - Tipo: `Autonumber`
    - Descripción: Consecutivo visible - identificador operativo oficial
    - **Este número es el que verán los coordinadores y Bogotá**
  - Si SÍ existe:
    - Verificar que es tipo Autonumber
    - Verificar que tiene valores secuenciales
  - **Notas:**
    ```
    Verificado automuber funcionando 
    ```

- [X] **Campo: `Coordinador`**
  - ¿Ya existe?: [X] Sí [ ] No
  - Si NO existe, crear:
    - Tipo: `Link to another record`
    - Tabla vinculada: `Coordinadores`
    - ¿Permitir múltiples?: ❌ NO (una orden = un coordinador)
    - ¿Requerido?: ✅ Sí
  - Si SÍ existe:
    - Verificar que NO permite múltiples registros
  - **Notas:**
    ```
    Se ha revisado . ya esta correcto
    ```

- [ ] **Campo: `Beneficiario`**
  - ¿Ya existe?: [ ] Sí [ ] No
  - Nombre alternativo posible: `Tercero`, `Proveedor`, `Transportador`
  - Si NO existe, crear:
    - Tipo: `Link to another record`
    - Tabla vinculada: `Terceros`
    - ¿Permitir múltiples?: ❌ NO
    - ¿Requerido?: ✅ Sí
    - Descripción: Entidad que cobra por la orden (transportador/gestor/proveedor)
  - Si existe con otro nombre:
    - Opción A: Renombrarlo a "Beneficiario"
    - Opción B: Dejarlo como está y documentar el nombre real aquí
  - **Nombre final del campo:** Beneficiario
  - **Notas:**
    ```
    Se enlaza a una tabla llamada Terceros Se crea el campo RazonSocial que tiene el nombre del benficiario se puede usar para visualizacion 
    ```

- [X] **Campo: `Estado`**
  - ¿Ya existe?: [ ] Sí [ ] No
  - Si NO existe, crear:
    - Tipo: `Single select`
    - Opciones **EXACTAS**:
      1. `Borrador` (color: gris)
      2. `Enviada` (color: azul claro)
      3. `Aprobada` (color: verde)
      4. `Pagada` (color: verde oscuro)
      5. `Rechazada` (color: rojo)
    - Valor por defecto: `Borrador`
    - ¿Requerido?: ✅ Sí
  - Si SÍ existe:
    - [ ] Verificar que tiene EXACTAMENTE estos 5 valores
    - [ ] Si faltan valores, agregarlos
    - [ ] Si hay valores de más, documentarlos aquí:
      ```
      Valores adicionales encontrados:
      -
      -
      ```
  - **Notas:**
    ```
    Se adapto todo a estas condiciones. 
    ```

### 📝 Validación post-modificación:

- [X] Tabla Ordenes tiene campo `NumeroOrden` (Autonumber)
- [X] Tabla Ordenes tiene campo `Coordinador` (Link a Coordinadores, single)
- [X] Tabla Ordenes tiene campo `Beneficiario` (Link a Terceros, single)
- [X] Tabla Ordenes tiene campo `Estado` (Select con 5 opciones)
- [X] Crear 1 orden de prueba para validar todos los campos

**Notas generales sobre modificación de Ordenes:**
```
Tengio un campo de observaciones. que es texto largo.  Y agrgue la fecha que es muy impornate .  (lo habias olvidado)   Puse un campo llamado NombreCoordinador que es buqeuda de la tabla coordinadores
```

---

## 4️⃣ MODIFICAR TABLA: ItemsOrden

**Propósito:** Asegurar que los items de orden tienen los campos necesarios

### Campos a verificar/crear:

- [X] **Campo: `TipoItem`** (**CRÍTICO**)
  - ¿Ya existe?: [ ] Sí [ ] No
  - Si NO existe, crear:
    - Tipo: `Single select`
    - Opciones **EXACTAS**:
      1. `CON Kardex` (color: azul)
      2. `SIN Kardex` (color: verde)
    - ¿Requerido?: ✅ Sí
    - Descripción: Determina si el item está asociado a un Kardex o a un servicio del catálogo
  - **Notas:**
    ```
    Creado
    ```

- [X] **Campo: `OrdenServicio`**
  - ¿Ya existe?: [X] Sí [ ] No
  - Si NO existe, crear:
    - Tipo: `Link to another record`
    - Tabla vinculada: `CatalogoServicios` ⚠️ (la tabla que creaste en el paso 1)
    - ¿Permitir múltiples?: ❌ NO
    - ¿Requerido?: ❌ NO (solo se usa cuando TipoItem = "SIN Kardex")
    - Descripción: Servicio del catálogo (solo para items SIN Kardex)
  - **Notas:**
    ```
    
    ```

- [X] **Campo: `FormaCobro`**
  - ¿Ya existe?: [ ] Sí [ ] No
  - Si NO existe, crear:
    - Tipo: `Single select`
    - Opciones **EXACTAS**:
      1. `Por Flete`
      2. `Por Kilo`
    - ¿Requerido?: ✅ Sí
    - Descripción: Cómo se cobra este item (precio fijo por viaje o precio por kg)
  - **Notas:**
    ```
    No deberia  ser exactamente las del catalogo? 
    ```

### 📝 Campos que ya deberían existir (solo verificar):

- [x] **Verificar campo: `Kardex`**
  - Tipo: Link to another record → Kardex
  - Solo se usa cuando TipoItem = "CON Kardex"
  - ¿Existe?: [ ] Sí [ ] No
  - Si NO existe: ⚠️ **PROBLEMA - este campo es crítico**

- [x] **Verificar campo: `Cantidad`**
  - Tipo: Number
  - Representa: kg o número de fletes
  - ¿Existe?: [ ] Sí [ ] No

- [x] **Verificar campo: `PrecioUnitario`**
  - Tipo: Currency (o Number)
  - ¿Existe?: [ ] Sí [ ] No

- [X] **Verificar campo: `Subtotal`**
  - Tipo: Formula
  - Fórmula: `{Cantidad} * {Precio Unitario}`
  - ¿Existe?: [ ] Sí [ ] No
  - Si NO existe, crear con esa fórmula

### 📝 Validación post-modificación:

- [X] Tabla ItemsOrden tiene campo `TipoItem` (Select: CON/SIN Kardex)
- [X] Tabla ItemsOrden tiene campo `Servicio` (Link a CatalogoServicios)
- [X] Tabla ItemsOrden tiene campo `FormaCobro` (Select: Por Flete/Por Kilo)
- [X] Crear 1 item de prueba tipo "CON Kardex" y validar campos
- [X] Crear 1 item de prueba tipo "SIN Kardex" y validar campos

**Notas generales sobre modificación de ItemsOrden:**
```
[¿La tabla ItemsOrden ya existía? ¿Tiene items? ¿Algún campo causó problemas?]
```
Todo bien . 
---

## 5️⃣ VERIFICAR TABLA: Terceros

**Propósito:** Asegurar que existe y tiene los campos mínimos

### Campos que deben existir:

- [X] **Verificar campo: `RazonSocial` (o `Nombre`)**
  - Tipo: Single line text
  - ¿Existe?: [ ] Sí [ ] No
  - Nombre real del campo: RazonSocial

- [X] **Verificar campo: `NIT` (o `Identificacion`)**
  - Tipo: Single line text
  - ¿Existe?: [ ] Sí [ ] No
  - Nombre real del campo: ________________________

- [X] **Verificar campo: `Direccion`**
  - Tipo: Single line text
  - ¿Existe?: [ ] Sí [ ] No (opcional, no crítico)

### 📝 Datos de prueba:

- [X] Verificar que hay al menos 2-3 terceros registrados para testing
- [ ] Si no hay, crear 2 terceros de ejemplo:
  - Ejemplo 1: Transportes XYZ (NIT: 123456-7)
  - Ejemplo 2: Gestor ABC S.A.S (NIT: 987654-3)

**Notas generales sobre Terceros:**
```
[¿Cuántos terceros existen? 916 ¿Los nombres de campos son diferentes a los documentados? no]
```

---

## 6️⃣ VERIFICAR RELACIONES ENTRE TABLAS

**Propósito:** Asegurar que los links entre tablas funcionan correctamente

### Relaciones a verificar:

- [X] **Ordenes → Coordinadores**
  - Desde: Campo `Coordinador` en tabla Ordenes
  - Hacia: Tabla Coordinadores
  - [ ] El link funciona correctamente
  - [ ] Al crear una orden, puedo seleccionar un coordinador

- [X] **Ordenes → Terceros**
  - Desde: Campo `Beneficiario` en tabla Ordenes
  - Hacia: Tabla Terceros
  - [ ] El link funciona correctamente
  - [ ] Al crear una orden, puedo seleccionar un tercero

- [X] **Ordenes → ItemsOrden**
  - Desde: Campo `ItemsOrden` en tabla Ordenes
  - Hacia: Tabla ItemsOrden
  - [ ] El link funciona correctamente (bidireccional)
  - [ ] Permite múltiples items por orden

- [X] **ItemsOrden → Kardex**
  - Desde: Campo `Kardex` en tabla ItemsOrden
  - Hacia: Tabla Kardex
  - [ ] El link funciona correctamente
  - [ ] Puedo seleccionar un Kardex al crear un item

- [X] **ItemsOrden → CatalogoServicios**
  - Desde: Campo `Servicio` en tabla ItemsOrden
  - Hacia: Tabla CatalogoServicios
  - [ ] El link funciona correctamente
  - [ ] Puedo seleccionar un servicio al crear un item

**Notas generales sobre relaciones:**
```
[¿Alguna relación no funciona? ¿Tuviste que crearla manualmente?]
```

---

## 7️⃣ PRUEBA INTEGRAL

**Propósito:** Crear registros de prueba completos para validar todo el flujo

### Escenario 1: Orden CON Kardex

- [x] **Paso 1:** Crear un Kardex de prueba
  - Tipo: ENTRADA o SALIDA
  - EstadoPago: `Por Pagar`
  - Fecha: Hoy
  - Coordinador: [Tu usuario de prueba]

- [x] **Paso 2:** Crear una Orden
  - Coordinador: [El mismo del Kardex]
  - Beneficiario: [Un tercero de prueba]
  -   Estado: `Borrador`

- [ ] **Paso 3:** Crear un ItemOrden
  - Orden: [La orden del paso 2]
  - TipoItem: `CON Kardex`
  - Kardex: [El Kardex del paso 1]
  - FormaCobro: `Por Kilo`
  - Cantidad: 1000
  - Precio Unitario: 50

- [ ] **Paso 4:** Validar
  - [ ] El Subtotal se calcula automáticamente (1000 × 50 = 50,000)
  - [ ] La orden muestra el item correctamente
  - [ ] El Kardex está vinculado al item

### Escenario 2: Orden SIN Kardex

- [ ] **Paso 1:** Crear una Orden
  - Coordinador: [Tu usuario de prueba]
  - Beneficiario: [Un tercero de prueba]
  - Estado: `Borrador`

- [ ] **Paso 2:** Crear un ItemOrden
  - Orden: [La orden del paso 1]
  - TipoItem: `SIN Kardex`
  - Servicio: [Un servicio del catálogo]
  - FormaCobro: `Por Flete`
  - Cantidad: 2
  - Precio Unitario: 150000

- [ ] **Paso 3:** Validar
  - [ ] El Subtotal se calcula automáticamente (2 × 150,000 = 300,000)
  - [ ] La orden muestra el item correctamente
  - [ ] El servicio está vinculado al item

### Escenario 3: Orden MIXTA (CON y SIN Kardex)

- [ ] Crear una orden con 2 items:
  - 1 item CON Kardex
  - 1 item SIN Kardex
- [ ] Validar que ambos items conviven en la misma orden

**Notas sobre pruebas integrales:**
```
[¿Todos los escenarios funcionaron? ¿Algún problema encontrado?]
```

---

## 📊 RESUMEN FINAL

### Checklist de completitud:

- [ ] ✅ Tabla CatalogoServicios creada y poblada
- [ ] ✅ Campo EstadoPago agregado a Kardex
- [ ] ✅ Tabla Ordenes tiene todos los campos necesarios
- [ ] ✅ Tabla ItemsOrden tiene todos los campos necesarios
- [ ] ✅ Tabla Terceros verificada
- [ ] ✅ Todas las relaciones funcionan
- [ ] ✅ Pruebas integrales completadas exitosamente

### Nombres de campos finales (para documentar):

**⚠️ IMPORTANTE: Documenta aquí los nombres EXACTOS que usaste en Airtable**

| Campo Documentado | Nombre Real en Airtable | Tabla |
|-------------------|-------------------------|-------|
| EstadoPago | ________________________ | Kardex |
| NumeroOrden | ________________________ | Ordenes |
| Coordinador | ________________________ | Ordenes |
| Beneficiario | ________________________ | Ordenes |
| Estado | ________________________ | Ordenes |
| TipoItem | ________________________ | ItemsOrden |
| Servicio | ________________________ | ItemsOrden |
| FormaCobro | ________________________ | ItemsOrden |
| RazonSocial | ________________________ | Terceros |
| NIT | ________________________ | Terceros |

### IDs de Tablas (para el código):

**Base ID de Airtable:** ________________________
**Tabla CatalogoServicios:** ________________________
**Tabla Ordenes:** ________________________
**Tabla ItemsOrden:** ________________________
**Tabla Kardex:** ________________________
**Tabla Terceros:** ________________________

---

## 🚨 PROBLEMAS ENCONTRADOS

Documenta aquí cualquier problema o bloqueador:

```
[Escribe aquí cualquier dificultad que necesite ayuda]

Ejemplo:
- No encuentro cómo hacer el campo Autonumber
- La tabla ItemsOrden no existe, ¿debo crearla?
- etc.
```

---

## ✅ LISTO PARA DESARROLLO

Cuando hayas completado TODOS los checkboxes anteriores, marca aquí:

- [ ] **🎉 TODO COMPLETADO - Listo para que Claude desarrolle el portal**

**Fecha de completitud:** ________________________
**Tiempo invertido:** ________________________

---

## 📝 NOTAS ADICIONALES

```
[Cualquier otra observación, sugerencia o comentario]
```
