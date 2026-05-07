---
fecha: 2026-05-07
estado: pendiente de implementación
autor: análisis Claude
---

# Notas de Caché — Plan para `use cache` + `cacheTag`

> **TL;DR**: Los dashboards y `/resumen-gastos` son lentos porque cada request pagina tablas enteras de Airtable. La solución estándar en Next.js 16 (Cache Components) es envolver los fetchers compartidos de `lib/airtable.ts` con `'use cache'` + `cacheTag` y revalidar en los endpoints de escritura. **No implementado todavía** — este documento es la guía cuando haya tiempo.

---

## 1. Pre-requisito (decisión ya tomada)

Hoy no está activado. Hay que activarlo:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,             // ← AGREGAR
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  outputFileTracingIncludes: {
    "/api/certificados/*": ["./lib/email-assets/**/*"],
  },
};

export default nextConfig;
```

**Decisión**: lo activamos a nivel proyecto (no por ruta). Riesgo: si alguna página depende implícitamente de SSR full-dynamic, puede fallar el build. Mitigación: probar en preview deployment antes de merge a `main`.

---

## 2. Por qué hoy es lento

Cada endpoint de dashboard llama varias funciones de `lib/airtable.ts` que paginan **toda** una tabla en cada request, con `cache: "no-store"`:

| Función                          | Tabla         | Llamada desde                                                                                                                  |
|----------------------------------|---------------|---------------------------------------------------------------------------------------------------------------------------------|
| `getAllKardex` (`lib/airtable.ts:2174`)            | `Kardex`      | `admin-stats:51`, `ejecutivo-stats:58`, `ejecutivo-stats-mensual:96`, `coordinador-stats:32`, `coordinador-stats-mensual:71` |
| `listAllActividades` (`lib/airtable.ts:627`)       | `Actividades` | `admin-stats:53`, `ejecutivo-stats:59`, `ejecutivo-stats-mensual:97`, `app/mapa/page.tsx`                                       |
| `getAllOrdenes` (`lib/airtable.ts:3133`)           | `Ordenes`     | `admin-stats:52`, `resumen-gastos:49`, `getOrdenesCoordinador` (línea 883)                                                      |
| `getAllGastosCajaMenor` (`lib/airtable.ts:3204`)   | `Gastos`      | `admin-stats:54`, `resumen-gastos:48`                                                                                            |
| `getAllItemsOrden` (`lib/airtable.ts:1778`)        | `ItemsOrden`  | `resumen-gastos:50` — **lo más caro**: sin filtro, sin sort, miles de items                                                     |
| `getRubros` (`lib/airtable.ts:2029`)               | `Rubros`      | varios                                                                                                                          |
| `getCentrosAcopio` (`lib/airtable.ts:2109`)        | `CentrosAcopio` | varios                                                                                                                        |

Cinco endpoints abren los dashboards → 5× la misma paginación a Airtable, sin reuso entre requests ni entre usuarios.

---

## 3. Top 3 lugares (en orden de impacto)

### 3.1. `getAllKardex()` — `lib/airtable.ts:2174-2217`

Reutilizada por **5 endpoints**. Paginación completa de la tabla más grande del sistema.

**Cambio propuesto** (no implementado):

```ts
import { cacheLife, cacheTag } from "next/cache";

export async function getAllKardex(): Promise<Kardex[]> {
  "use cache";
  cacheTag("kardex");
  cacheLife("minutes");          // 5 min stale / 15 min revalidate

  // ...resto del cuerpo igual, NO tocar el `cache: "no-store"` interno
}
```

**Invalidación** desde escritura:
- `app/api/kardex/route.ts:76` (POST) → `revalidateTag("kardex")` antes de `NextResponse.json(...)`.
- `app/api/kardex/[id]/route.ts` (DELETE/PATCH) → `revalidateTag("kardex")`.

**Decisión**: `cacheLife('minutes')`. Razón: el coordinador necesita ver su movimiento al volver a la lista, pero las métricas globales pueden tolerar 5 minutos. Si alguien reporta "creé un kardex y no aparece", el `revalidateTag` en el POST ya lo cubre.

---

### 3.2. `listAllActividades()` — `lib/airtable.ts:627-668`

Reutilizada por **3 endpoints + el mapa**.

**Cambio propuesto**:

```ts
export async function listAllActividades(): Promise<Actividad[]> {
  "use cache";
  cacheTag("actividades");
  cacheLife("minutes");
  // ...resto igual
}
```

**Invalidación**:
- `app/api/actividades/route.ts` (POST) → `revalidateTag("actividades")`.
- `app/api/actividades/[id]/route.ts` (PATCH/DELETE) → idem.

**Bonus que queda pendiente**: una vez activado Cache Components, `app/mapa/page.tsx` se puede convertir a Server Component con shell estático y `<Suspense>` solo para el bloque que depende de actividades. No urgente.

---

### 3.3. Fetchers de `/resumen-gastos` — bloque en `lib/airtable.ts`

La ruta `app/api/resumen-gastos/route.ts:36` ya tiene `maxDuration = 60` porque hace 5 paginaciones en paralelo. **Decisión**: cachear los **fetchers individuales**, no el route handler. Así el cache se reutiliza también en `admin-stats` y otras rutas que consumen Órdenes/Gastos.

Funciones a envolver con `'use cache'` + `cacheTag`:

| Función                  | Tag             | `cacheLife`       |
|--------------------------|-----------------|--------------------|
| `getAllOrdenes`          | `'ordenes'`     | `'minutes'`        |
| `getAllGastosCajaMenor`  | `'gastos-cm'`   | `'minutes'`        |
| `getAllItemsOrden`       | `'items-orden'` | `'minutes'`        |
| `getRubros`              | `'rubros'`      | `'hours'` (casi estático) |
| `getCentrosAcopio`       | `'centros'`     | `'hours'`          |

**Invalidación** (puntos de escritura conocidos):
- `app/api/caja-menor/...` (crear/aprobar/rechazar gasto) → `revalidateTag("gastos-cm")`.
- `app/api/ordenes-servicio/...` (POST/PATCH/cambio de estado) → `revalidateTag("ordenes")` **y** `revalidateTag("items-orden")` (los items van junto con la orden).
- Cuando se modifique un rubro o centro de acopio (poco frecuente) → tag respectivo.

---

## 4. Notas técnicas (no perder de vista)

- **Las funciones no usan `cookies()` / `headers()`**: son candidatos limpios para `'use cache'`. No necesitamos `'use cache: private'`.
- **El `cache: "no-store"` interno de cada `fetch` a Airtable se queda como está.** `use cache` cachea la salida de la función, no el `fetch` subyacente.
- **La autorización sigue por fuera**: `getServerSession`, `isAdminOrSupervisor`, etc. ocurren en el route handler antes de llamar al fetcher. No se mezcla con el cache.
- **Sin argumentos = un solo cache key.** `getAllKardex()` no recibe nada, así que toda la app comparte un único entry. Eso es justamente lo que queremos.
- **Las funciones que sí reciben argumento** (p.ej. `countAllCertificados(año)`, `getMetasAnualesDesdeMensuales(año)`) se cachean por valor de argumento automáticamente — el argumento entra en la cache key.
- **No cachear funciones con `coordinatorId`** como argumento si la cardinalidad puede explotar (se generaría un entry por coordinador). Para eso, cachear la función "global" (`getAllKardex`) y filtrar en memoria en el route, que es justo lo que ya hace el código.

---

## 5. Decisiones tomadas en este documento

1. **Activar `cacheComponents: true` a nivel proyecto** (no por ruta). Probar en preview antes del merge.
2. **Cachear fetchers, no route handlers.** Mejor reuso entre endpoints.
3. **Default `cacheLife('minutes')`** para datos transaccionales (kardex, actividades, órdenes, gastos, items). **`cacheLife('hours')`** para `getRubros` y `getCentrosAcopio` (casi estáticos).
4. **No usar `'use cache: private'`**: ningún fetcher candidato necesita `cookies()`/`headers()`.
5. **Invalidar con `revalidateTag` (background)**, no `updateTag` (immediate). Razón: las escrituras de kardex/actividad no necesitan que el dashboard refleje el cambio en el mismo request. Stale-while-revalidate es suficiente y más barato.
6. **No cachear `getOrdenesCoordinador` ni `getGastosCajaMenorCoordinador`** directamente. Ya internamente llaman a `getAllOrdenes` / `getAllGastosCajaMenor`, así que cuando esas se cachean, estas heredan el beneficio sin generar un cache entry por coordinador.

---

## 6. Decisiones pendientes (cuando se implemente)

- [ ] ¿`cacheLife('minutes')` realmente es suficiente, o el cliente se va a quejar de retraso? Si pasa, bajar a `{ stale: 30, revalidate: 120 }` solo para `kardex` y `actividades`.
- [ ] ¿Vale la pena migrar `app/mapa/page.tsx` a Server Component + Suspense aprovechando el cache de actividades? (Defer hasta que el resto esté en producción.)
- [ ] Definir contrato: cuando algún endpoint de escritura nuevo se cree (futuro), QUE NO SE OLVIDE el `revalidateTag(...)`. Sugerencia: agregar comentario en cabecera de cada tabla en `lib/airtable.ts` con el tag asociado, para que el siguiente que toque ese código lo vea.
- [ ] Evaluar si `getAllItemsOrden` debería en realidad filtrarse por orden en Airtable en vez de traer todo. Cachearlo es un parche; lo correcto sería paginar/filtrar. Pero como parche tapa el problema mientras tanto.

---

## 7. Orden de implementación sugerido

1. PR#1: activar `cacheComponents: true` y verificar que todo el build pasa en preview. Sin tocar fetchers todavía.
2. PR#2: envolver `getAllKardex` + `revalidateTag` en POST/DELETE de kardex. Medir.
3. PR#3: igual para `listAllActividades`.
4. PR#4: envolver los 5 fetchers de `/resumen-gastos` y agregar `revalidateTag` en sus puntos de escritura.
5. PR#5 (opcional): `getRubros` + `getCentrosAcopio` con `cacheLife('hours')`.

Razón del orden: PRs chicos, fáciles de revertir si algo se rompe en producción.
