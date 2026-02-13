# Implementación Dashboard Coordinador

**Fecha:** 10 de febrero de 2026
**Estado:** Aprobado, pendiente de implementar

---

## Objetivo

Reemplazar el dashboard actual de coordinadores (que tiene datos dummy) con un dashboard funcional que muestre métricas reales de Kardex, Actividades, Órdenes de Servicio y Caja Menor.

---

## Estructura del Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Bienvenido, [Nombre]!                                      │
│  [email]                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SECCIÓN 1: Barras de Metas Anuales                         │
│  ┌─────────────────────────┐ ┌─────────────────────────────┐│
│  │ 🎯 Meta Recolección 2026│ │ 🎯 Meta Sensibilización 2026││
│  │ ████████░░░ 500/2,200 kg│ │ ██████░░░░ 120/500 personas ││
│  │          23%             │ │          24%                 ││
│  └─────────────────────────┘ └─────────────────────────────┘│
│                                                              │
│  SECCIÓN 2: KPIs del Año (4 tarjetas)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │Movimientos│ │Total KG  │ │Eventos   │ │Personas  │       │
│  │Kardex: 89 │ │Salidas:  │ │Sensib.:  │ │Capacit.: │       │
│  │           │ │1,200 kg  │ │12        │ │320       │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  SECCIÓN 3: Alertas y Pendientes                            │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ⏰ Faltan 18 días para cierre de febrero                 ││
│  │ 📦 3 kardex "Por Pagar" sin orden de servicio            ││
│  │ 📑 2 órdenes pendientes por facturar                     ││
│  │ 💰 1 gasto de caja menor pendiente de aprobación         ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  SECCIÓN 4: Accesos Rápidos (se mantienen los 4 botones)    │
│  [Nueva Actividad] [Mapa] [Certificados] [Kardex]           │
│                                                              │
│  SECCIÓN 5: Notificaciones del Admin                        │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 🔔 Tienes 3 mensajes                                    ││
│  │ ┌────────────────────────────────────────────────────┐   ││
│  │ │ Gasto #45 — Rechazado                              │   ││
│  │ │ Obs: "Falta soporte de la factura original"        │   ││
│  │ └────────────────────────────────────────────────────┘   ││
│  │ ┌────────────────────────────────────────────────────┐   ││
│  │ │ Orden #12 — Rechazada                              │   ││
│  │ │ Obs: "Precio no corresponde al catálogo"           │   ││
│  │ └────────────────────────────────────────────────────┘   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ELIMINAR: Sección "Actividad Reciente" (datos dummy)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Requisito Previo: Tabla Metas en Airtable

**ESTADO: ✅ Ya creada por el cliente.**

La tabla `Metas` debe tener los siguientes campos:

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| Coordinador | Link → Coordinadores | Ana López |
| Año | Number | 2026 |
| MetaRecoleccion | Number (kg) | 2,200 |
| MetaSensibilizacion | Number (personas) | 500 |

Un registro por coordinador por año.

---

## Plan de Implementación

### Paso 1: Función `getMetasCoordinador()` en `lib/airtable.ts`

Crear una nueva función que consulte la tabla Metas:

```typescript
// Nueva interfaz
interface MetaFields {
  Coordinador?: string[];  // Linked record IDs
  Año?: number;
  MetaRecoleccion?: number;
  MetaSensibilizacion?: number;
}

export interface Meta {
  id: string;
  fields: MetaFields;
}

// Nueva función
export async function getMetasCoordinador(
  coordinatorRecordId: string,
  año: number
): Promise<Meta | null> {
  // Consultar tabla "Metas"
  // Filtrar por Coordinador = coordinatorRecordId AND Año = año
  // Retornar el primer registro encontrado (o null)
}
```

**Nota:** Verificar el nombre exacto de la tabla y campos en Airtable antes de implementar.

### Paso 2: Crear endpoint API `/api/dashboard/stats`

Endpoint que consolida todas las métricas en una sola llamada:

```typescript
// GET /api/dashboard/stats
// Requiere: session con coordinatorRecordId

// Respuesta:
{
  metas: {
    recoleccion: { meta: 2200, actual: 500 },       // Meta vs suma ENTRADAS del año
    sensibilizacion: { meta: 500, actual: 120 }      // Meta vs suma participantes Sensibilización del año
  },
  kpis: {
    movimientosKardex: 89,        // Total entradas + salidas del año
    totalKgSalidas: 1200,         // Suma kg solo SALIDA del año
    eventosSensibilizacion: 12,   // Actividades tipo "Sensibilización" del año
    personasCapacitadas: 320      // Suma "Cantidad de Participantes" de Sensibilización del año
  },
  alertas: {
    diasParaCierre: 18,           // Días restantes del mes actual
    kardexPorPagar: 3,            // Kardex con EstadoPago = "Por Pagar"
    ordenesSinFacturar: 2,        // Órdenes con Estado = "Enviada"
    gastosPendientes: 1           // Gastos caja menor con Estado = "Pendiente"
  },
  notificaciones: [               // Últimos 5 mensajes del admin
    {
      tipo: "gasto",              // "gasto" | "orden"
      id: "recXXX",
      numero: 45,
      estado: "Rechazado",
      observacion: "Falta soporte...",
      fecha: "2026-02-08"
    }
  ]
}
```

**Funciones existentes a usar:**

| Dato | Función | Filtro adicional |
|------|---------|------------------|
| Meta recolección/sensibilización | `getMetasCoordinador()` (NUEVA) | Año actual |
| Kg entradas (progreso meta) | `listKardexForCoordinator(id)` | TipoMovimiento="ENTRADA", AÑO=actual |
| Participantes sensibilización | `listActividadesForCoordinator(id)` | Tipo="Sensibilización", Año=actual |
| Movimientos kardex | `listKardexForCoordinator(id)` | AÑO=actual, contar todos |
| Kg salidas | `listKardexForCoordinator(id)` | TipoMovimiento="SALIDA", sumar Total |
| Kardex por pagar | `getKardexPorPagar(id)` | Ya filtrada |
| Órdenes sin facturar | `getOrdenesCoordinador(id)` | Estado="Enviada" |
| Gastos pendientes | `getGastosCajaMenorCoordinador(id)` | Estado="Pendiente" |
| Notificaciones admin | `getGastosCajaMenorCoordinador(id)` + `getOrdenesCoordinador(id)` | Con ObservacionesAdmin o Estado="Rechazado/Rechazada" |

### Paso 3: Modificar `app/dashboard/page.tsx`

**Eliminar:**
- Los 3 `<KpiCard>` con datos dummy (líneas 151-172)
- La sección "Actividad Reciente" con `<RecentList>` y el array `recentItems` (líneas 91-134, 300-304)

**Agregar:**
1. **Estado de carga:** `useState` para `dashboardData` + loading
2. **useEffect** que llama a `/api/dashboard/stats`
3. **Sección Metas:** Dos barras de progreso lado a lado
4. **Sección KPIs:** 4 tarjetas con datos reales (reutilizar `<KpiCard>`)
5. **Sección Alertas:** Lista de items con iconos y contadores
6. **Accesos Rápidos:** Se mantienen igual (líneas 174-218)
7. **Notificaciones Admin:** Expandir la sección existente de caja menor para incluir también órdenes rechazadas

**Mantener sin cambios:**
- Welcome section
- Accesos rápidos
- Lógica de autenticación y redirect

### Paso 4: Componente `ProgressBar` (nuevo)

Componente reutilizable para las barras de meta:

```tsx
// components/ProgressBar.tsx
interface ProgressBarProps {
  label: string;         // "Meta Recolección 2026"
  actual: number;        // 500
  meta: number;          // 2200
  unit: string;          // "kg" | "personas"
  color?: string;        // Color de la barra
}
```

Muestra: etiqueta, barra visual, `actual / meta unit (XX%)`.

### Paso 5: Componente `AlertItem` (nuevo, opcional)

Componente simple para cada alerta:

```tsx
// Se puede hacer inline en el dashboard, no requiere archivo separado
<div className="flex items-center gap-3 p-3 ...">
  <span>{icon}</span>
  <span>{mensaje}</span>
  <Link href={link}>Ver →</Link>
</div>
```

---

## Campos y Tipos de Datos — Referencia Rápida

### Kardex (para KPIs y meta recolección)
```typescript
// De lib/airtable.ts → KardexFields
TipoMovimiento: "ENTRADA" | "SALIDA"
EstadoPago: "Caja Menor" | "Sin Costo" | "Por Pagar" | "En Orden"
AÑO: string           // "2026"
Total: number          // kg totales del movimiento
// Materiales individuales:
Reciclaje, Incineracion, Flexibles, PlasticoContaminado, Lonas, Carton, Metal: number
```

### Actividades (para KPIs y meta sensibilización)
```typescript
// De lib/airtable.ts → ActividadFields
Tipo: string                      // "Sensibilización" | "Capacitación" | "Taller"
"Cantidad de Participantes": number
Año: string                       // "2026"
Fecha: string                     // "2026-02-10"
```

### Órdenes (para alertas)
```typescript
// De lib/airtable.ts → OrdenFields
Estado: "Borrador" | "Enviada" | "Facturada" | "Pagada" | "Rechazada"
Observaciones: string
```

### Gastos Caja Menor (para alertas y notificaciones)
```typescript
// De lib/airtable.ts → GastoCajaMenorFields
Estado: "Pendiente" | "Aprobado" | "Rechazado" | "Reembolsado"
ObservacionesAdmin: string
```

---

## Cálculos Clave

### Meta Recolección
```
progreso = suma de kardex.fields.Total
           WHERE TipoMovimiento = "ENTRADA"
           AND AÑO = "2026"
porcentaje = (progreso / meta.MetaRecoleccion) * 100
```

### Meta Sensibilización
```
progreso = suma de actividad.fields["Cantidad de Participantes"]
           WHERE Tipo = "Sensibilización"
           AND Año = "2026"
porcentaje = (progreso / meta.MetaSensibilizacion) * 100
```

### Días para cierre del mes
```typescript
const hoy = new Date();
const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
const diasRestantes = ultimoDia.getDate() - hoy.getDate();
```

---

## Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `lib/airtable.ts` | Agregar interfaz `Meta` y función `getMetasCoordinador()` |
| `app/api/dashboard/stats/route.ts` | **CREAR** — Endpoint que consolida todas las métricas |
| `app/dashboard/page.tsx` | Reescribir secciones: metas, KPIs, alertas, notificaciones |
| `components/ProgressBar.tsx` | **CREAR** — Componente de barra de progreso |
| `components/KpiCard.tsx` | Sin cambios (se reutiliza tal cual) |
| `components/RecentList.tsx` | Se puede eliminar si no se usa en otro lugar |

---

## Notas Importantes

1. **El mapa de actividades** se queda en el menú lateral como feature demo, NO se incluye en el dashboard.
2. **El dashboard del admin** no se modifica — este documento es solo para coordinadores. Si `isAdmin`, el dashboard se mantiene como está o se adapta después.
3. **Si no hay meta creada** para el coordinador/año, mostrar mensaje: "Meta no configurada — contacta al administrador" en lugar de la barra.
4. **Performance:** El endpoint `/api/dashboard/stats` hace varias llamadas a Airtable en paralelo con `Promise.all()` para minimizar tiempo de carga.
5. **Verificar nombre exacto** de la tabla Metas y sus campos en Airtable antes de implementar la función.
