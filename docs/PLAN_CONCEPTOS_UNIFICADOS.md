# Plan: Migrar a tabla Conceptos unificada (reemplazar CatalogoServicios)

**Estado**: PENDIENTE - No implementar hasta tener tiempo dedicado
**Fecha de creacion**: 2026-02-19
**Riesgo**: Medio-alto (sistema en produccion, afecta Ordenes y Caja Menor)

---

## Contexto

El sistema tiene 3 mecanismos distintos para manejar "conceptos":
1. **ItemsOrden KARDEX**: Campo texto `Concepto` con 4 valores hardcoded de transporte (`CONCEPTOS_KARDEX` en PasoRevision.tsx)
2. **ItemsOrden CATALOGO**: Linked record a tabla `CatalogoServicios` (Nombre, Precio Unitario, RequiereDocumentos, etc.)
3. **GastoCajaMenor**: Campo texto libre `Concepto` (ahora dropdown hardcoded con 12 valores)

Esto impide cruzar datos entre Ordenes y Caja Menor para estadisticas. La solucion es crear una tabla unificada `Conceptos` con los 12 conceptos y usarla como linked record en ambas entidades.

---

## Fase 0: Schema en Airtable (manual - lo hace el usuario)

### Crear tabla `Conceptos`
| Campo | Tipo | Valores |
|-------|------|---------|
| Nombre | Single line text | (nombre del concepto) |
| Tipo | Single select | "Transporte", "Servicio" |
| RequiereDocumentos | Checkbox | (para items que requieren soporte bascula) |
| Activo | Checkbox | (default true) |

### Poblar 12 registros
**Transporte** (RequiereDocumentos = false):
1. Transporte JR - CA
2. Transporte CA - DF
3. Transporte Municipio - DF
4. Transporte JR - DF

**Servicio** (RequiereDocumentos segun necesidad):
5. Disposicion Final
6. Clasificacion y Compactacion
7. Arriendo
8. Servicio de Bascula (RequiereDocumentos = true)
9. Cargue y Descargue
10. Materiales
11. Papeleria, Publicidad, Perifoneo
12. Servicio de Aseo

### Agregar campos linked en tablas existentes
- **ItemsOrden**: Nuevo campo `ConceptoLink` (linked to Conceptos, allow single)
- **GastoCajaMenor**: Nuevo campo `ConceptoLink` (linked to Conceptos, allow single)

**NO eliminar campos viejos aun** (Concepto texto, CatalogoServicio linked).

---

## Fase 1: Backend — funciones en `lib/airtable.ts`

### Nuevas funciones
```ts
getConceptos(): Concepto[]
  // Fetch tabla Conceptos con filterByFormula={Activo}=1
  // Retorna id, Nombre, Tipo, RequiereDocumentos, Activo

getConceptosByIds(ids: string[]): Concepto[]
  // Batch fetch por record IDs (similar a getCatalogoByIds)
```

### Nuevos tipos
```ts
interface ConceptoFields {
  Nombre?: string;
  Tipo?: "Transporte" | "Servicio";
  RequiereDocumentos?: boolean;
  Activo?: boolean;
}

export interface Concepto {
  id: string;
  fields: ConceptoFields;
}
```

### Nueva env var
- `AIRTABLE_TABLE_ID_CONCEPTOS` (con fallback al table ID real)

### Modificar `createOrdenServicio()`
- Cada item recibe `conceptoRecordId` (ID del Concepto)
- Al crear ItemOrden, setear `ConceptoLink: [conceptoRecordId]`
- Mantener escritura dual: `Concepto` (texto) para Kardex y `CatalogoServicio` para catalogo (compatibilidad temporal)

### Modificar `createGastoCajaMenor()` y `updateGastoCajaMenor()`
- Recibir `conceptoRecordId` en lugar de texto
- Setear `ConceptoLink: [conceptoRecordId]`
- Escritura dual: tambien setear `Concepto` (texto) con el nombre del concepto

### Archivos afectados
- `lib/airtable.ts`

---

## Fase 2: Migrar Caja Menor

### `app/caja-menor/nuevo/page.tsx`
- Revertir cambios uncommitted (dropdown hardcoded)
- Cargar conceptos dinamicamente: `fetch("/api/conceptos")` al montar
- Dropdown agrupado por Tipo (Transporte / Servicio)
- El value del select es el **record ID** del concepto
- Enviar `conceptoRecordId` al crear gasto

### `app/caja-menor/[id]/page.tsx`
- Revertir cambios uncommitted
- Cargar conceptos dinamicamente
- En modo edicion: dropdown con conceptos, pre-seleccionar el concepto actual
- En modo vista: mostrar nombre del concepto (desde ConceptoLink o Concepto texto como fallback)

### Nuevo endpoint `app/api/conceptos/route.ts`
- GET: retorna `getConceptos()` — lista de conceptos activos
- Cacheable, simple

### Archivos afectados
- `app/caja-menor/nuevo/page.tsx`
- `app/caja-menor/[id]/page.tsx`
- `app/api/conceptos/route.ts` (nuevo)

---

## Fase 3: Migrar Ordenes de Servicio (wizard)

### `app/ordenes-servicio-v2/nueva/page.tsx`
- Cambiar `getCatalogoServicios()` -> `getConceptos()`
- Pasar solo conceptos tipo "Servicio" a PasoCatalogo
- Pasar solo conceptos tipo "Transporte" a PasoRevision

### `components/wizard-orden/PasoCatalogo.tsx`
- Recibir `conceptosServicio: Concepto[]` en vez de `catalogoDisponibles: CatalogoServicio[]`
- El usuario selecciona un Concepto, ingresa cantidad y precio unitario
- Ya no hay `Descripcion`, `UnidadMedida`, ni `Precio Unitario` pre-cargado del catalogo
- Cada item seleccionado: `{ concepto: Concepto, cantidad: number, precioUnitario: number }`

### `components/wizard-orden/PasoRevision.tsx`
- Eliminar `CONCEPTOS_KARDEX` hardcoded
- Recibir `conceptosTransporte: Concepto[]` como prop
- El dropdown de concepto para Kardex usa los conceptos de tipo Transporte
- El value del select es el **record ID**
- `RequiereDocumentos`: leer del concepto seleccionado

### `app/ordenes-servicio/[id]/page.tsx` (detalle de orden)
- Cambiar `getCatalogoByIds()` -> `getConceptosByIds()`
- Leer concepto desde `ConceptoLink` (con fallback a CatalogoServicio/Concepto viejo)

### Archivos afectados
- `app/ordenes-servicio-v2/nueva/page.tsx`
- `components/wizard-orden/PasoCatalogo.tsx`
- `components/wizard-orden/PasoRevision.tsx`
- `app/ordenes-servicio/[id]/page.tsx`

---

## Fase 4: Simplificar `computeConceptosOrdenes()`

### Antes (actual)
- Fetch todos los ItemsOrden
- Para items con `Concepto` texto que empieza con "TRANSPORTE" -> tag "Transporte"
- Para items con `CatalogoServicio` linked -> fetch nombre del catalogo -> tag

### Despues
- Fetch todos los ItemsOrden
- Leer `ConceptoLink` (linked to Conceptos) -> fetch nombres
- Fallback a logica vieja para ordenes creadas antes de la migracion
- Resultado: tags mas precisos ("Transporte JR - CA" en vez de solo "Transporte")

### Archivos afectados
- `lib/airtable.ts` — `computeConceptosOrdenes()`
- `components/pdf/ReporteOrdenesPDF.tsx` (si muestra conceptos)

---

## Fase 5: Limpieza (posterior, no inmediata)

Una vez verificado que todo funciona con los nuevos campos:
- Eliminar `getCatalogoServicios()` y `getCatalogoByIds()` de `lib/airtable.ts`
- Eliminar interfaz `CatalogoServicioFields` y tipo `CatalogoServicio`
- Eliminar env var `AIRTABLE_TABLE_ID_CATALOGOSERVICIOS`
- En Airtable (manual): eliminar campos viejos
- Eventualmente: eliminar tabla CatalogoServicios de Airtable

---

## Orden de ejecucion

1. **Usuario crea tabla en Airtable** (Fase 0) — prerequisito manual
2. Implementar Fase 1 (backend)
3. Implementar Fase 2 (caja menor) — se puede verificar inmediatamente
4. Implementar Fase 3 (ordenes wizard)
5. Implementar Fase 4 (computeConceptos)
6. Fase 5 se hace despues de un periodo de prueba

---

## Verificacion

1. **Caja Menor**: Crear gasto con concepto del dropdown -> verificar que ConceptoLink se guarda en Airtable
2. **Caja Menor editar**: Editar gasto -> concepto pre-seleccionado, cambiar -> verificar actualizacion
3. **Orden nueva con Kardex**: Crear orden con items Kardex -> concepto transporte seleccionado -> verificar ConceptoLink en ItemsOrden
4. **Orden nueva con Servicio**: Crear orden con items de servicio -> concepto servicio seleccionado -> verificar ConceptoLink
5. **Vista ordenes**: Conceptos se muestran correctamente en el listado y detalle
6. **Reporte PDF**: Conceptos aparecen bien en el PDF exportado
7. **Cross-reference**: En Airtable, verificar que ConceptoLink en ItemsOrden y GastoCajaMenor apuntan a los mismos registros de Conceptos
