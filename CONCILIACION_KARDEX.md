# Regla de Negocio: Conciliación Automática de Kardex

**Fecha de identificación**: 27 de enero de 2026
**Ubicación**: Flujo TextIt "30-Kardex Airtable" (UUID: e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13)

## 📋 Descripción

Cuando se crea una **SALIDA de Kardex** que **NO pasa por un Centro de Acopio** (es decir, SALIDA directamente desde municipio a gestor), el sistema debe crear automáticamente un registro de **ENTRADA de conciliación** con estado "Sin Costo".

## 🎯 Lógica de Negocio

### Condición para activar conciliación:
```
SI (TipoMovimiento === "SALIDA" && origenTipo === "Municipio")
ENTONCES crear_entrada_conciliacion()
```

### Registro de ENTRADA de conciliación:
- **TipoMovimiento**: "ENTRADA"
- **Fecha**: Misma fecha que la SALIDA
- **MunicipioOrigen**: Mismo municipio que la SALIDA
- **Materiales**: Mismos kilos que la SALIDA (Reciclaje, Incineración, Flexibles, Lonas, Cartón, Metal, Plástico Contaminado)
- **Observaciones**: **"Entrada automática de conciliación"**
- **EstadoPago**: **"Sin Costo"**
- **Coordinador**: Mismo coordinador que la SALIDA

## 🔄 Flujo Completo (TextIt)

### 1. Usuario crea SALIDA desde municipio
- Selecciona TipoMovimiento: SALIDA
- Selecciona origen: Municipio (no Centro de Acopio)
- Ingresa gestor destino
- Ingresa materiales y kilos
- Sube foto de báscula

### 2. Sistema crea registro de SALIDA normal
```json
POST /api/airtable/Kardex
{
  "records": [{
    "fields": {
      "Coordinador": ["rec123"],
      "fechakardex": "2026-01-27",
      "TipoMovimiento": "SALIDA",
      "MunicipioOrigen": ["recMUN456"],
      "gestor": ["recGES789"],
      "Reciclaje": 100,
      "Incineracion": 50,
      // ... otros materiales
      "soportebascula": [{"url": "..."}],
      "Observaciones": "Salida a gestor XYZ"
    }
  }]
}
```

### 3. Sistema crea automáticamente ENTRADA de conciliación
```json
POST /api/airtable/Kardex
{
  "records": [{
    "fields": {
      "Coordinador": ["rec123"],
      "fechakardex": "2026-01-27",
      "TipoMovimiento": "ENTRADA",
      "MunicipioOrigen": ["recMUN456"],
      "Reciclaje": 100,
      "Incineracion": 50,
      // ... mismos materiales que la SALIDA
      "Observaciones": "Entrada automática de conciliación",
      "EstadoPago": "Sin Costo"
    }
  }]
}
```

### 4. Sistema informa al usuario
```
Se ha creado un registro de conciliación dado que es una salida 
y no pasa por centro de acopio, el consecutivo del registro de 
conciliación es @results.id_conciliacion

.... [detalles del registro]
```

## 💡 Razón de Negocio

**¿Por qué se crea esta entrada automática?**

Cuando el material sale **directamente del municipio** sin pasar por un centro de acopio:
1. Se registra la SALIDA (material que deja el municipio hacia el gestor)
2. Se crea una ENTRADA "virtual" de conciliación para:
   - ✅ Cuadrar el inventario del municipio
   - ✅ Registrar que ese material fue recolectado previamente
   - ✅ Mantener coherencia contable (no se puede sacar material que no entró)
   - ✅ Marcar como "Sin Costo" porque no genera pago adicional

## 🚫 Cuándo NO se crea conciliación

**NO se crea entrada de conciliación cuando:**
- ❌ La SALIDA es desde un **Centro de Acopio** (el centro ya tiene el inventario)
- ❌ El movimiento es una **ENTRADA** (no aplica)

## 📊 Ejemplo Completo

### Escenario:
Andrea (coordinadora de Cundinamarca) recoge 150 kg de reciclaje en el municipio de Fusagasugá y lo entrega directamente al gestor "EcoResiduos S.A.S."

### Registros creados:

**1. SALIDA (creada por usuario)**
```
Consecutivo: #1234
Tipo: SALIDA
Coordinador: Andrea Villarraga
Fecha: 2026-01-27
Municipio: Fusagasugá
Gestor: EcoResiduos S.A.S.
Reciclaje: 150 kg
Estado Pago: Por Pagar
Observaciones: Entrega directa a gestor
Foto báscula: ✅
```

**2. ENTRADA DE CONCILIACIÓN (creada automáticamente)**
```
Consecutivo: #1235
Tipo: ENTRADA
Coordinador: Andrea Villarraga
Fecha: 2026-01-27
Municipio: Fusagasugá
Reciclaje: 150 kg
Estado Pago: Sin Costo
Observaciones: Entrada automática de conciliación
```

## 🔧 Implementación Pendiente en Portal Web

### Estado Actual
- ✅ **TextIt Bot**: Implementado y funcionando
- ❌ **Portal Web**: NO implementado

### Tareas Requeridas

#### 1. Backend - API Route
**Archivo**: `app/api/kardex/route.ts`

Modificar el endpoint POST para detectar y crear conciliación:

```typescript
export async function POST(request: Request) {
  // ... código existente para crear SALIDA ...
  
  // Después de crear SALIDA exitosamente:
  if (tipoMovimiento === "SALIDA" && origenTipo === "Municipio") {
    // Crear ENTRADA de conciliación
    const conciliacion = await createKardex({
      coordinatorRecordId: coordinatorRecordId,
      fechakardex: fechakardex, // Misma fecha
      tipoMovimiento: "ENTRADA",
      municipioOrigenId: municipioOrigenId, // Mismo municipio
      reciclaje: reciclaje,
      incineracion: incineracion,
      flexibles: flexibles,
      lonas: lonas,
      carton: carton,
      metal: metal,
      plasticoContaminado: plasticoContaminado,
      observaciones: "Entrada automática de conciliación",
      estadoPago: "Sin Costo"
    });
    
    // Retornar ambos registros
    return NextResponse.json({
      success: true,
      kardex: salidaCreada,
      conciliacion: conciliacion,
      message: "SALIDA creada. Se generó ENTRADA de conciliación automática."
    });
  }
  
  // ... resto del código ...
}
```

#### 2. Frontend - Modal de Confirmación
**Archivo**: `app/kardex/page.tsx` y `components/KardexFormModal.tsx`

Modificar para mostrar AMBOS registros cuando se crea conciliación:

```tsx
// En el modal de confirmación
{createdConciliacion && (
  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <h4 className="font-bold text-blue-900 mb-2">
      ✨ Registro de Conciliación Automática
    </h4>
    <p className="text-sm text-blue-800 mb-2">
      Se creó una ENTRADA de conciliación porque esta salida no pasó por centro de acopio.
    </p>
    <div className="text-sm">
      <p><strong>Consecutivo:</strong> #{createdConciliacion.Autonumber}</p>
      <p><strong>Tipo:</strong> ENTRADA</p>
      <p><strong>Estado:</strong> Sin Costo</p>
      <p><strong>Total:</strong> {totalKg} kg</p>
    </div>
  </div>
)}
```

#### 3. Validación y Pruebas

**Casos de prueba:**
1. ✅ Crear SALIDA desde municipio → Debe crear conciliación
2. ✅ Crear SALIDA desde centro de acopio → NO debe crear conciliación
3. ✅ Crear ENTRADA → NO debe crear conciliación
4. ✅ Verificar que ambos registros tienen mismo coordinador, fecha, municipio y materiales
5. ✅ Verificar que conciliación tiene EstadoPago = "Sin Costo"
6. ✅ Verificar que ambos consecutivos son diferentes

## 📝 Consideraciones Adicionales

### Campos que difieren entre SALIDA y CONCILIACIÓN:
- **TipoMovimiento**: SALIDA vs ENTRADA
- **Gestor**: Solo la SALIDA tiene gestor
- **Foto báscula**: Solo la SALIDA tiene foto
- **EstadoPago**: SALIDA = "Por Pagar", ENTRADA = "Sin Costo"
- **Observaciones**: SALIDA = texto del usuario, ENTRADA = "Entrada automática de conciliación"
- **Consecutivo**: Cada uno genera su propio autonumber

### Campos que son iguales:
- **Coordinador**: Mismo
- **Fecha**: Misma
- **MunicipioOrigen**: Mismo
- **Materiales**: Mismos kilos

## 🎯 Impacto en Saldos

La conciliación afecta el cálculo de saldos:

```
Saldo Municipio = 
  SUMA(ENTRADAS normales) + 
  SUMA(ENTRADAS de conciliación) - 
  SUMA(SALIDAS)
```

Esto asegura que el saldo del municipio refleje correctamente que el material que salió, también entró (aunque sea virtualmente).

## ✅ Criterios de Aceptación

1. ✅ Al crear SALIDA desde municipio (no centro), se crea automáticamente ENTRADA de conciliación
2. ✅ La conciliación tiene todos los campos correctos
3. ✅ El usuario ve ambos consecutivos en el modal de confirmación
4. ✅ Los saldos se calculan correctamente incluyendo las conciliaciones
5. ✅ La conciliación NO se cuenta en reportes de pago (es "Sin Costo")
6. ✅ Ambos registros aparecen en el listado de Kardex con su tipo correcto

## 🚀 Prioridad

**ALTA** - Esta es una regla de negocio crítica que ya existe en el bot y debe replicarse en el portal para mantener consistencia en los datos.

## 📅 Estimación

- Backend (API route): 1-2 horas
- Frontend (modal): 1 hora
- Pruebas: 1 hora
- **Total: 3-4 horas**

---

**Documentado por**: Claude + Leonardo
**Fecha**: 27 de enero de 2026
**Fuente**: Análisis del flujo TextIt "30-Kardex Airtable"
