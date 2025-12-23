# Implementación Airtable - Órdenes de Servicio

**Fecha de inicio:** 23 de diciembre de 2024
**Responsable:** Leonardo Gutiérrez

---

## 📋 PROGRESO GENERAL

- [x] 1. Tabla CatalogoServicios
- [x] 2. Tabla Kardex - Campo EstadoPago
- [x] 3. Tabla Ordenes - Campos necesarios
- [ ] 4. Tabla ItemsOrden - Falta campo "Servicio"
- [x] 5. Verificar tabla Terceros
- [ ] 6. Pruebas integrales

---

## 1️⃣ TABLA: CatalogoServicios ✅

### Campos creados:

- [x] **`Nombre`** (Single line text, requerido)
- [x] **`Descripcion`** (Long text, opcional)
- [x] **`Categoria`** (Single select, opcional) - No necesaria por ahora
- [x] **`UnidadMedida`** (Single select, requerido)
  - Opciones: Por Flete, Por Kilo, Por Hora, Por Mes, Precio Fijo, Otro
- [x] **`Activo`** (Checkbox)

### Servicios de prueba:

- [ ] Servicio 1: _____________________ (UnidadMedida: _______)
- [ ] Servicio 2: _____________________ (UnidadMedida: _______)
- [ ] Servicio 3: _____________________ (UnidadMedida: _______)

**Notas:**
```
✅ UnidadMedida ajustada: Por Flete, Por Kilo (coincide con FormaCobro)
Relación: ItemsOrden.Servicio enlaza aquí cuando TipoItem = "SIN Kardex"
```

---

## 2️⃣ TABLA: Kardex ✅

- [x] **`EstadoPago`** (Single select)
  - Opciones: Caja Menor, Sin Costo, Por Pagar, En Orden
  - ✅ EXISTE EN AIRTABLE

**Validación:**
- [x] Campo creado y visible
- [ ] Crear 1 registro de prueba por estado

**Notas:**
```
✅ Campo verificado en schema de Airtable
Total de campos en Kardex: 29
```

---

## 3️⃣ TABLA: Ordenes ✅

- [x] **`NumeroOrden`** (Autonumber) - ✅ SÍ EXISTE
- [x] **`Coordinador`** (Link → Coordinadores) - ✅ SÍ EXISTE
- [x] **`Beneficiario`** (Link → Terceros) - ✅ SÍ EXISTE
- [x] **`Estado`** (Single select) - ✅ SÍ EXISTE
  - Opciones: Borrador, Enviada, Aprobada, Pagada, Rechazada
- [x] **`Fecha de pedido`** (Date) - ✅ SÍ EXISTE
- [x] **`ItemsOrden`** (Link → ItemsOrden) - ✅ SÍ EXISTE

**Campos adicionales encontrados:**
- NombreCoordinador (Lookup)
- RazonSocial (Lookup)
- Observaciones

**Validación:**
- [ ] Crear 1 orden de prueba

**Notas:**
```
✅ TABLA COMPLETA - Todos los campos necesarios existen
Total de campos: 9
ID Tabla: tblw1iNr7HBhKnZZR
```

---

## 4️⃣ TABLA: ItemsOrden ⚠️

### Campos que EXISTEN:
- [x] **`TipoItem`** (Single select): CON Kardex, SIN Kardex ✅
- [x] **`FormaCobro`** (Single select): Por Flete, Por Kilo ✅
- [x] **`Kardex`** (Link) ✅
- [x] **`Cantidad`** (Number) ✅
- [x] **`OrdenServicio`** (Link → Ordenes) ✅ (nombre real del campo "Orden")
- [x] **`PrecioUnitario`** (sin espacio) ✅
- [x] **`Cálculo`** (Formula) ✅ (probablemente el Subtotal)

### Campo FALTANTE:
- [ ] **`Servicio`** (Link → CatalogoServicios) ❌ **DEBE CREARSE**

**Validación:**
- [ ] Crear campo "Servicio" como Link to CatalogoServicios
- [ ] Item tipo "CON Kardex"
- [ ] Item tipo "SIN Kardex"

**Notas:**
```
⚠️ FALTA 1 CAMPO: Servicio (Link to CatalogoServicios)
Total de campos actuales: 8
ID Tabla: tbl0Wq9uybWVzWij3

Nombres reales vs esperados:
- "OrdenServicio" = campo "Orden" en nuestra documentación
- "PrecioUnitario" = campo "Precio Unitario" (sin espacio)
- "Cálculo" = campo "Subtotal" (verificar fórmula)
```

---

## 5️⃣ TABLA: Terceros ✅

- [x] Verificar campos: RazonSocial ✅, NIT ✅, Direccion ✅
- [ ] Al menos 2-3 terceros de prueba existen

**Campos adicionales encontrados:**
- Movil, Correo Electrónico, Tipo, Observaciones
- Puntos logisticos (Link)
- Ordenes (Link)
- Archivos Licencias, convenios, Prefactura

**Notas:**
```
✅ TABLA COMPLETA - Todos los campos necesarios existen
Total de campos: 16
ID Tabla: tblBNwRaF7iq4IAHG
```

---

## 6️⃣ RELACIONES

- [x] Ordenes → Coordinadores ✅
- [x] Ordenes → Terceros ✅
- [x] Ordenes ↔ ItemsOrden ✅
- [x] ItemsOrden → Kardex ✅
- [ ] ItemsOrden → CatalogoServicios ❌ (falta crear campo "Servicio")

---

## 7️⃣ PRUEBAS

- [ ] Orden CON Kardex (completa)
- [ ] Orden SIN Kardex (completa)
- [ ] Orden MIXTA (ambos tipos)

---

## 📊 NOMBRES REALES DE CAMPOS

| Campo Documentación | Nombre en Airtable | Tabla | Estado |
|-------|-------------------|-------|--------|
| EstadoPago | EstadoPago | Kardex | ✅ |
| NumeroOrden | NumeroOrden | Ordenes | ✅ |
| Coordinador | Coordinador | Ordenes | ✅ |
| Beneficiario | Beneficiario | Ordenes | ✅ |
| Estado | Estado | Ordenes | ✅ |
| Fecha de pedido | Fecha de pedido | Ordenes | ✅ |
| TipoItem | TipoItem | ItemsOrden | ✅ |
| Orden | OrdenServicio | ItemsOrden | ✅ |
| Servicio | **FALTA CREAR** | ItemsOrden | ❌ |
| FormaCobro | FormaCobro | ItemsOrden | ✅ |
| Kardex | Kardex | ItemsOrden | ✅ |
| Precio Unitario | PrecioUnitario | ItemsOrden | ✅ |
| Subtotal | Cálculo | ItemsOrden | ✅ |

## 🔑 IDs DE TABLAS

- Base ID: **appniHwKiUMS0imXD**
- CatalogoServicios: **tblIrrr5gmebTtMH8**
- Ordenes: **tblw1iNr7HBhKnZZR**
- ItemsOrden: **tbl0Wq9uybWVzWij3**
- Kardex: **tblBUx4wF0xVjmpgh**
- Terceros: **tblBNwRaF7iq4IAHG**

---

## ✅ COMPLETADO

- [ ] **TODO LISTO - Avisar a Claude**

Fecha: _____ | Tiempo: _____

---

## 📝 NOTAS

```

```
