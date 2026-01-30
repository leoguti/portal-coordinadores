# Auditoría Técnica y Plan de Mejoras — Portal Coordinadores CampoLimpio

**Fecha:** 29 de enero de 2026
**Auditor:** Claude (Opus 4.5)
**Alcance:** Revisión completa de arquitectura, seguridad, diseño, UX, performance, testing y preparación para producción.
**Estado del proyecto al momento de la auditoría:** Aplicación funcional en desarrollo activo.

---

## Tabla de Contenido

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Hallazgos Positivos](#2-hallazgos-positivos)
3. [Hallazgos Críticos](#3-hallazgos-críticos)
4. [Plan de Mejoras Priorizado](#4-plan-de-mejoras-priorizado)
5. [Detalle por Área](#5-detalle-por-área)
   - 5.1 Seguridad
   - 5.2 Responsive y Móvil
   - 5.3 Sistema de Diseño
   - 5.4 Accesibilidad
   - 5.5 Testing
   - 5.6 Performance
   - 5.7 Arquitectura y Código
   - 5.8 Preparación para Producción
6. [Scorecard Final](#6-scorecard-final)
7. [Checklist de Implementación](#7-checklist-de-implementación)

---

## 1. Resumen Ejecutivo

**Portal Coordinadores** es una aplicación Next.js 16 con 16 rutas, 18 componentes, 16 endpoints API, autenticación passwordless, mapa interactivo de Colombia, y Airtable como backend. Gestiona actividades de campo, kardex logístico, órdenes de servicio y certificados.

### Veredicto

| Aspecto | Nota |
|---------|------|
| Arquitectura | 7/10 |
| Funcionalidad | 8/10 |
| Diseño visual | 6/10 |
| Responsive/Móvil | 3/10 |
| Seguridad | 3/10 |
| Accesibilidad | 6/10 |
| Testing | 2/10 |
| UX/Interacción | 7/10 |
| Producción | 3/10 |
| Calidad de código | 7/10 |
| **Global** | **5.2/10** |

**Conclusión:** Base funcional sólida con decisiones arquitectónicas correctas. Requiere fase de hardening en seguridad, responsive, y testing antes de considerarse listo para producción.

---

## 2. Hallazgos Positivos

### 2.1 Arquitectura bien fundamentada
- Next.js 16 App Router con separación clara Server/Client Components
- Autenticación passwordless con magic links — excelente UX para coordinadores en campo
- JWT sessions sin necesidad de base de datos para auth
- Control de roles (Coordinador / Administrador / Desactivado)
- Adapter in-memory para tokens de verificación (`lib/memory-adapter.ts`)

### 2.2 Capa de datos tipada
- TypeScript estricto sin tipos `any` detectados
- Interfaces completas para todos los schemas de Airtable
- Funciones server-side con directiva `"use server"`
- Retry con exponential backoff en `getCoordinatorByEmail()`

### 2.3 UX funcional
- Búsqueda de municipios con debounce (300ms), navegación por teclado, insensibilidad a acentos
- Estados vacíos con CTAs claros en todas las vistas principales
- Upload de imágenes con drag-and-drop, preview, y validación de tamaño
- Mapa coroplético de Colombia con Leaflet (correctamente sin react-leaflet por problemas SSR)
- Estados de carga (spinners) presentes en todas las páginas
- Paginación implementada en Kardex

### 2.4 Lógica de negocio encapsulada
- Período de gracia de 7 días centralizado en `lib/dateValidations.ts`
- Conciliación de Kardex con borrado en cascada
- Validaciones de fecha reutilizables entre API routes y componentes

### 2.5 Documentación
- CLAUDE.md completo y bien estructurado
- Documentación de schema Airtable, reglas de negocio Kardex, branding
- Convenciones claras para mapas, municipios, y componentes

---

## 3. Hallazgos Críticos

### CRÍTICO-01: El portal no funciona en dispositivos móviles
- **Archivo:** `components/Sidebar.tsx`, `components/AuthenticatedLayout.tsx`
- **Problema:** Sidebar fijo con `w-64` y contenido con `ml-64` hardcodeado
- **Impacto:** Coordinadores en campo probablemente acceden desde celular. Layout roto en pantallas < 800px.

### CRÍTICO-02: Sin protección CSRF
- **Archivos:** Todos los endpoints en `app/api/`
- **Problema:** Ningún endpoint POST/PATCH/DELETE tiene token CSRF
- **Impacto:** Requests maliciosas pueden ejecutar acciones en nombre de usuarios autenticados

### CRÍTICO-03: Sin validación de inputs en API
- **Archivos:** Todos los endpoints en `app/api/`
- **Problema:** Se acepta `request.json()` sin validación de schema
- **Impacto:** Datos malformados, inyección de campos no esperados, valores fuera de rango

### CRÍTICO-04: Vulnerabilidad SSRF en image-proxy
- **Archivo:** `app/api/image-proxy/route.ts`
- **Problema:** Acepta URLs arbitrarias sin validar que sean de Airtable
- **Impacto:** Un atacante podría hacer que el servidor haga requests a red interna o servicios externos

### CRÍTICO-05: Sin middleware de autenticación global
- **Problema:** No existe `middleware.ts`. Cada página verifica sesión individualmente con `useSession()`
- **Impacto:** Rutas protegidas dependen de que cada desarrollador recuerde agregar la verificación. API routes podrían quedar expuestas.

---

## 4. Plan de Mejoras Priorizado

### Prioridad 1 — Bloqueadores (resolver antes de ir a producción)

| ID | Mejora | Área | Archivos afectados |
|----|--------|------|-------------------|
| M-01 | Implementar navegación responsive (sidebar móvil) | Responsive | `Sidebar.tsx`, `AuthenticatedLayout.tsx` |
| M-02 | Agregar middleware.ts para protección global de rutas | Seguridad | Nuevo: `middleware.ts` |
| M-03 | Implementar validación de inputs con Zod en API routes | Seguridad | Todos los `app/api/*/route.ts` |
| M-04 | Corregir SSRF en image-proxy (whitelist de dominios) | Seguridad | `app/api/image-proxy/route.ts` |
| M-05 | Agregar protección CSRF en endpoints mutantes | Seguridad | Todos los POST/PATCH/DELETE |
| M-06 | Rate limiting en endpoint de magic links | Seguridad | `app/api/auth/[...nextauth]/route.ts` |

### Prioridad 2 — Importantes (resolver en corto plazo)

| ID | Mejora | Área | Archivos afectados |
|----|--------|------|-------------------|
| M-07 | Crear sistema de diseño mínimo (Button, Input, Badge, Toast) | Diseño | Nuevos en `components/ui/` |
| M-08 | Reemplazar `alert()` con sistema de notificaciones toast | UX | Páginas de Kardex, Órdenes |
| M-09 | Agregar validación inline por campo en formularios | UX | `ActividadForm.tsx`, `KardexFormModal.tsx` |
| M-10 | Implementar breadcrumbs en navegación | UX | Layout y páginas de detalle |
| M-11 | Desactivar EMAIL_TO_OVERRIDE en producción | Seguridad | `app/api/auth/[...nextauth]/route.ts` |
| M-12 | Agregar tests para API routes críticos | Testing | Nuevos en `app/api/__tests__/` |
| M-13 | Agregar tests para reglas de negocio | Testing | Nuevos en `lib/__tests__/` |

### Prioridad 3 — Mejoras de calidad (mediano plazo)

| ID | Mejora | Área | Archivos afectados |
|----|--------|------|-------------------|
| M-14 | Dividir `lib/airtable.ts` en módulos por dominio | Código | `lib/airtable.ts` → múltiples archivos |
| M-15 | Extraer magic strings a constantes | Código | `lib/constants/` nuevo |
| M-16 | Usar `filterByFormula` en queries ineficientes | Performance | `lib/airtable.ts` (getOrdenesCoordinador, getItemsOrden) |
| M-17 | Implementar lazy loading de imágenes | Performance | Componentes con imágenes |
| M-18 | Agregar TTL al cache de municipios/terceros | Performance | `app/api/municipios/route.ts`, `app/api/terceros/route.ts` |
| M-19 | Configurar logging estructurado (pino/winston) | Producción | Todo el proyecto |
| M-20 | Agregar monitoreo de errores (Sentry) | Producción | Configuración global |
| M-21 | Crear configuración de despliegue (Dockerfile o vercel.json) | Producción | Nuevos archivos raíz |
| M-22 | Agregar health check endpoint | Producción | Nuevo: `app/api/health/route.ts` |
| M-23 | Validación de env vars al arrancar | Producción | Nuevo: `lib/env.ts` |
| M-24 | Reemplazar emojis por sistema de íconos (lucide-react) | Diseño | Sidebar, páginas, estados vacíos |
| M-25 | Mejorar accesibilidad (aria-expanded, anuncio de resultados) | Accesibilidad | Componentes interactivos |
| M-26 | Vista de tarjetas en tablas para móvil | Responsive | Páginas de listado |
| M-27 | Agregar soporte para dark mode | Diseño | `globals.css`, componentes |

---

## 5. Detalle por Área

### 5.1 Seguridad

#### M-02: Middleware de autenticación global

**Estado actual:** No existe `middleware.ts`. Cada página y API route verifica sesión individualmente.

**Problema:** Si un desarrollador olvida agregar `useSession()` o `getServerSession()` en una nueva página o endpoint, queda expuesta sin autenticación.

**Solución recomendada:** Crear `middleware.ts` en la raíz del proyecto que intercepte todas las rutas protegidas.

**Rutas a proteger:**
- `/dashboard`
- `/actividades` y subrutas
- `/kardex` y subrutas
- `/ordenes-servicio` y subrutas
- `/certificados`
- `/saldos-centros`
- `/mapa`
- `/api/*` (excepto `/api/auth`)

**Rutas públicas (no proteger):**
- `/login`
- `/verify-request`
- `/api/auth/*`
- `/_next/*` (assets estáticos)

---

#### M-03: Validación de inputs con Zod

**Estado actual:** Los API routes aceptan `await request.json()` sin validación.

**Ejemplo del problema** (en `app/api/kardex/route.ts`):
```
const body = await request.json();
// Se usa body.fechakardex, body.TipoMovimiento, etc. sin validar tipo ni rango
```

**Solución recomendada:** Instalar `zod` y crear schemas para cada endpoint.

**Schemas necesarios:**
- `createActividadSchema` — para POST `/api/actividades`
- `updateActividadSchema` — para PATCH `/api/actividades/[id]`
- `createKardexSchema` — para POST `/api/kardex`
- `updateKardexSchema` — para PATCH `/api/kardex/[id]`
- `createOrdenSchema` — para POST `/api/ordenes-servicio`
- `updateOrdenSchema` — para PATCH `/api/ordenes-servicio/[id]`
- `uploadSchema` — para POST `/api/upload`

**Ubicación sugerida:** `lib/schemas/` con un archivo por dominio.

**Campos críticos a validar:**
- `fechakardex`: string con formato fecha válido, dentro del período de gracia
- `TipoMovimiento`: enum `['ENTRADA', 'SALIDA']`
- Campos numéricos de materiales: `number >= 0`
- `email`: formato email válido
- `municipioId`: string no vacío
- Archivos: content-type permitido, tamaño máximo

---

#### M-04: Corrección SSRF en image-proxy

**Archivo:** `app/api/image-proxy/route.ts`

**Estado actual:** Acepta cualquier URL sin validación:
```
const url = searchParams.get('url');
const response = await fetch(url); // Peligroso: URL arbitraria
```

**Solución recomendada:** Validar que la URL pertenezca a dominios de Airtable.

**Dominios permitidos:**
- `dl.airtable.com`
- `v5.airtableusercontent.com`
- `*.airtable.com`

**Validación adicional:**
- Rechazar URLs con esquema que no sea `https://`
- Rechazar URLs con IPs privadas (127.0.0.1, 10.x.x.x, 192.168.x.x, etc.)
- Limitar tamaño de respuesta

---

#### M-05: Protección CSRF

**Estado actual:** Ningún endpoint tiene protección CSRF.

**Endpoints afectados (todos los mutantes):**
- `POST /api/actividades`
- `PATCH /api/actividades/[id]`
- `DELETE /api/actividades/[id]`
- `POST /api/kardex`
- `PATCH /api/kardex/[id]`
- `DELETE /api/kardex/[id]`
- `PATCH /api/ordenes-servicio/[id]`
- `POST /api/upload`
- `POST /api/download-pdf`

**Opciones de implementación:**
1. **next-csrf** — librería específica para Next.js
2. **Token manual** — generar token en sesión, validar en cada POST
3. **SameSite cookies** — asegurar que las cookies de sesión tengan `SameSite=Strict`

---

#### M-06: Rate limiting en magic links

**Archivo:** `app/api/auth/[...nextauth]/route.ts`

**Problema:** Sin límite, un atacante puede enviar miles de magic links agotando cuota SMTP o haciendo email bombing.

**Solución recomendada:**
- Máximo 3 solicitudes por email por hora
- Máximo 10 solicitudes por IP por hora
- Delay progresivo después del segundo intento

---

#### M-11: EMAIL_TO_OVERRIDE en producción

**Archivo:** `app/api/auth/[...nextauth]/route.ts` (líneas 129-160)

**Problema:** La variable `EMAIL_TO_OVERRIDE` redirige todos los emails a un destinatario alternativo. Si queda configurada en producción por error, los magic links llegarían al destinatario incorrecto.

**Solución recomendada:**
- Condicionar a `NODE_ENV !== 'production'`
- O eliminarlo del flujo de auth y usarlo solo en scripts de testing

---

### 5.2 Responsive y Móvil

#### M-01: Navegación responsive

**Archivos afectados:**
- `components/Sidebar.tsx`
- `components/AuthenticatedLayout.tsx`

**Estado actual:**
```
// AuthenticatedLayout.tsx
<aside className="w-64 ... fixed left-0 top-0">   // Siempre visible, 256px
<main className="flex-1 p-8 ml-64">                // Siempre con margen izquierdo
```

**Comportamiento deseado:**
- **Desktop (>= 1024px):** Sidebar fijo visible, contenido con margin-left
- **Tablet (768-1023px):** Sidebar colapsable (solo íconos) o drawer
- **Móvil (< 768px):** Sidebar oculto, botón hamburguesa en header, sidebar aparece como overlay

**Componentes a crear/modificar:**
1. `MobileHeader.tsx` — Barra superior con hamburguesa + logo (solo visible en móvil)
2. Modificar `Sidebar.tsx` — Agregar estados abierto/cerrado, overlay para móvil
3. Modificar `AuthenticatedLayout.tsx` — Quitar `ml-64` fijo, hacerlo responsive

**Breakpoints sugeridos:**
- `lg:ml-64 lg:block` para sidebar fijo en desktop
- `hidden lg:block` para ocultar sidebar en móvil
- Overlay con `fixed inset-0 z-50` para sidebar móvil abierto

---

#### M-26: Vista de tarjetas en tablas para móvil

**Archivos afectados:**
- `app/actividades/page.tsx`
- `app/kardex/page.tsx`
- `app/ordenes-servicio/page.tsx`
- `app/saldos-centros/page.tsx`

**Estado actual:** Tablas con `overflow-x-auto` — funcional pero mala experiencia en móvil (scroll horizontal).

**Solución recomendada:**
- En móvil (`< md`): Mostrar cada registro como tarjeta vertical con campos apilados
- En desktop (`>= md`): Mantener tabla actual
- Patrón: `hidden md:table` para tabla + `md:hidden` para vista de tarjetas

**Campos prioritarios por vista:**
- **Actividades:** Nombre, Fecha, Municipio, Estado
- **Kardex:** Fecha, Tipo, Origen/Destino, Total kg
- **Órdenes:** Número, Fecha, Gestor, Estado

---

### 5.3 Sistema de Diseño

#### M-07: Componentes base reutilizables

**Estado actual:** No existe sistema de diseño. Cada componente define sus propios estilos inline con clases Tailwind. Ejemplos de inconsistencia encontrados:

- Botones primarios: algunos usan `bg-blue-600 hover:bg-blue-700`, otros `bg-green-600 hover:bg-green-700`
- Labels: mezcla de `font-medium` y `font-semibold`
- Bordes de inputs: algunos `border-gray-300`, otros `border-gray-200`
- Padding de cards: algunos `p-4`, otros `p-6`

**Componentes a crear en `components/ui/`:**

| Componente | Variantes | Uso |
|-----------|-----------|-----|
| `Button.tsx` | primary, secondary, danger, ghost, loading, disabled | Todas las acciones |
| `Input.tsx` | text, number, date, textarea, error state | Todos los formularios |
| `Select.tsx` | default, error state | Dropdowns |
| `Badge.tsx` | success, warning, danger, info, neutral | Estados y etiquetas |
| `Card.tsx` | default, interactive (hover) | Contenedores de contenido |
| `Toast.tsx` | success, error, warning, info | Notificaciones (reemplaza alert()) |
| `Modal.tsx` | default (basado en ConfirmModal existente) | Diálogos |
| `Spinner.tsx` | sm, md, lg | Estados de carga |
| `EmptyState.tsx` | con ícono, título, descripción, CTA | Vistas vacías |

**Tokens de diseño sugeridos (constantes):**

Ubicación: `lib/design-tokens.ts` o en Tailwind config.

```
Colores principales:
- brand-dark: #042726 (sidebar, headers)
- brand-accent: #00d084 (acciones activas, CTA)
- primary: blue-600 (botones principales)
- danger: red-600 (acciones destructivas)
- warning: amber-500 (alertas)
- success: green-600 (confirmaciones)

Espaciado estándar:
- card-padding: p-6 (24px)
- section-gap: space-y-6 (24px)
- field-gap: space-y-4 (16px)
- inline-gap: gap-2 (8px)

Bordes:
- input: border-gray-300 rounded-md
- card: border-gray-200 rounded-lg shadow-sm
- focus: ring-2 ring-blue-500

Tipografía:
- page-title: text-2xl font-bold text-gray-900
- section-title: text-xl font-semibold text-gray-900
- label: text-sm font-medium text-gray-700
- help-text: text-sm text-gray-500
- error-text: text-sm text-red-600
```

---

#### M-08: Sistema de notificaciones toast

**Archivos donde se usa `alert()`:**
- `app/kardex/page.tsx` — confirmación de borrado
- `app/ordenes-servicio/page.tsx` — errores de envío

**Implementación recomendada:**
- Crear `components/ui/Toast.tsx` y un contexto `ToastProvider`
- Posición: esquina superior derecha
- Auto-dismiss después de 5 segundos
- Variantes: success (verde), error (rojo), warning (amarillo), info (azul)
- Alternativa: usar librería `sonner` (ligera, compatible con Next.js)

---

#### M-24: Sistema de íconos

**Estado actual:** Usa emojis como íconos:
- Sidebar: `📊 📋 📦 📄 🏭` etc.
- Estados vacíos: `📋 📦`
- Indicadores: `📷 🔒 🔓`

**Problema:** Los emojis tienen rendering inconsistente entre OS/navegadores, no tienen tamaño preciso, y dan apariencia informal.

**Solución recomendada:** Instalar `lucide-react` (mismo sistema que shadcn/ui).

**Mapeo de reemplazo:**
| Emoji actual | Ícono lucide |
|-------------|-------------|
| 📊 Dashboard | `LayoutDashboard` |
| 📋 Actividades | `ClipboardList` |
| 📦 Kardex | `Package` |
| 📄 Órdenes | `FileText` |
| 🏭 Saldos Centros | `Warehouse` |
| 🗺️ Mapa | `Map` |
| 📷 Fotos | `Camera` |
| 🔒 Cerrado | `Lock` |
| 🔓 Abierto | `LockOpen` |
| ➕ Crear | `Plus` |
| ✏️ Editar | `Pencil` |
| 🗑️ Eliminar | `Trash2` |

---

### 5.4 Accesibilidad

#### M-25: Mejoras de accesibilidad

**Hallazgos positivos existentes:**
- Labels vinculados a inputs con `htmlFor`
- `role="dialog"` y `aria-modal="true"` en ConfirmModal
- `aria-labelledby` para títulos de modal
- Cierre con Escape en modales
- Campos requeridos marcados con asterisco rojo
- Focus rings con `ring-2 ring-blue-500`

**Mejoras necesarias:**

| Problema | Archivo | Solución |
|----------|---------|----------|
| Botones expandir/colapsar sin `aria-expanded` | `app/kardex/page.tsx`, `app/actividades/page.tsx` | Agregar `aria-expanded={isOpen}` |
| Búsqueda no anuncia cantidad de resultados | `MunicipioSearch.tsx`, `CentroAcopioSearch.tsx`, etc. | Agregar `aria-live="polite"` con conteo |
| Dropdown de búsqueda sin role listbox | Componentes de búsqueda | Agregar `role="listbox"` al dropdown, `role="option"` a items |
| Tablas con filas expandibles sin indicador | Páginas de listado | Agregar `aria-label="Expandir detalles"` |
| Contraste de badges puede ser insuficiente | Badges de estado | Verificar con herramienta de contraste WCAG 2.1 AA |
| Sin skip-to-content link | `app/layout.tsx` | Agregar enlace oculto al inicio del body |
| Dark mode forzado desactivado | `globals.css` | Considerar respetar preferencia del sistema |

**Herramientas recomendadas para auditoría:**
- axe DevTools (extensión de navegador)
- Lighthouse accessibility audit
- WAVE Web Accessibility Evaluator

---

### 5.5 Testing

#### Estado actual

Solo 2 archivos de test:
1. `components/__tests__/MunicipioSearch.test.tsx` (364 líneas)
2. `lib/__tests__/airtable.test.ts` (~100 líneas)

**Cobertura estimada: ~5%**

#### M-12: Tests de API routes

**Endpoints críticos a testear:**

| Endpoint | Tests necesarios |
|----------|-----------------|
| `POST /api/actividades` | Auth requerida, validación de campos, creación exitosa, período de gracia |
| `PATCH /api/actividades/[id]` | Auth + ownership, campos opcionales, actividad no encontrada |
| `DELETE /api/actividades/[id]` | Auth + ownership, período de gracia, eliminación exitosa |
| `POST /api/kardex` | Auth, validación materiales >= 0, tipo movimiento válido, conciliación |
| `DELETE /api/kardex/[id]` | Auth + ownership, borrado en cascada, conciliación |
| `PATCH /api/ordenes-servicio/[id]` | Auth, transición de estados válida |
| `POST /api/upload` | Auth, tipo de archivo, tamaño máximo |
| `GET /api/image-proxy` | URL válida, dominio permitido (post-fix SSRF) |

**Patrón de test sugerido:**
```
Para cada endpoint:
1. Test sin sesión → 401
2. Test con sesión inválida → 403
3. Test con datos inválidos → 400 con mensaje descriptivo
4. Test con datos válidos → 200/201 con respuesta correcta
5. Test de edge cases específicos del dominio
```

#### M-13: Tests de reglas de negocio

**Funciones críticas a testear en `lib/dateValidations.ts`:**
- `puedeModificarActividad()` — Diferentes escenarios de fecha:
  - Día 1-7 del mes: puede modificar mes anterior y actual
  - Día 8+ del mes: solo puede modificar mes actual
  - Actividad de hace 2 meses: no puede modificar
- `puedeModificarFecha()` — Restricciones de rango de fecha
- `getFechaCorteMesesCerrados()` — Cálculo correcto del corte

**Funciones críticas a testear en `lib/airtable.ts`:**
- `createKardexWithConciliacion()` — Creación + conciliación atómica
- `deleteKardexWithConciliacion()` — Borrado en cascada correcto
- `getCoordinatorByEmail()` — Manejo de roles desactivados, retry logic
- Conversión de código DIVIPOLA (decimal a string con padding)

**Cobertura objetivo:** 60-70% en paths críticos.

---

### 5.6 Performance

#### M-16: Queries ineficientes a Airtable

**Problema 1:** `getOrdenesCoordinador()` en `lib/airtable.ts`
- Trae TODOS los registros de órdenes y filtra en JavaScript
- Debería usar `filterByFormula` de Airtable con el ID del coordinador

**Problema 2:** `getItemsOrden()` en `lib/airtable.ts`
- Mismo patrón: trae todos los ítems y filtra en cliente
- Debería filtrar por ID de orden en la query a Airtable

**Impacto:** A medida que crezcan los datos, estas queries serán cada vez más lentas y consumirán más cuota de API de Airtable.

**Solución:** Reemplazar el patrón de "fetch all + filter" con `filterByFormula`:
```
filterByFormula: FIND("RECORD_ID", {Coordinador})
```

#### M-17: Lazy loading de imágenes

**Archivos afectados:** Páginas que muestran fotos de actividades y kardex.

**Estado actual:** Las imágenes se cargan todas al renderizar el componente.

**Solución:**
- Usar atributo `loading="lazy"` en etiquetas `<img>`
- O migrar a `next/image` con su lazy loading nativo
- Priorizar imágenes above-the-fold con `loading="eager"`

#### M-18: Cache con TTL

**Archivos afectados:**
- `app/api/municipios/route.ts`
- `app/api/terceros/route.ts`

**Estado actual:** Cache in-memory que se carga una vez y nunca se refresca (hasta restart del servidor).

**Problema:** Si se agregan nuevos municipios o terceros en Airtable, el portal no los verá hasta el próximo despliegue.

**Solución:** Agregar TTL (Time To Live) de 24 horas. Después del TTL, la siguiente request recarga el cache en background.

**Race condition existente:** El flag `cacheLoading` podría causar problemas si dos requests llegan simultáneamente al iniciar. Usar patrón de Promise singleton.

---

### 5.7 Arquitectura y Código

#### M-14: Dividir lib/airtable.ts

**Estado actual:** Un solo archivo de 2,108 líneas con 50+ funciones exportadas.

**División sugerida:**

```
lib/
├── airtable/
│   ├── index.ts              # Re-exports públicos
│   ├── client.ts             # Configuración base del cliente Airtable
│   ├── types.ts              # Interfaces y tipos compartidos
│   ├── coordinadores.ts      # getCoordinatorByEmail, listCoordinadores
│   ├── actividades.ts        # CRUD de actividades
│   ├── kardex.ts             # CRUD de kardex + conciliación
│   ├── ordenes.ts            # CRUD de órdenes de servicio
│   ├── terceros.ts           # Búsqueda y CRUD de terceros
│   ├── gestores.ts           # Búsqueda y listado de gestores
│   ├── centros-acopio.ts     # Búsqueda y listado de centros
│   └── municipios.ts         # Funciones de municipios
```

**Beneficios:**
- Archivos más pequeños y fáciles de navegar
- Más fácil de testear por módulo
- Mejor code review en PRs
- Menor riesgo de conflictos en merges

**Precaución:** Mantener los re-exports en `lib/airtable/index.ts` para no romper imports existentes.

---

#### M-15: Extraer magic strings a constantes

**Archivos afectados:** Principalmente `lib/airtable.ts` y API routes.

**Strings hardcodeadas encontradas:**

```
Tablas:
- 'Coordinadores'
- 'Actividades'
- 'Kardex'
- 'tblIrrr5gmebTtMH8' (Catálogo de Servicios)
- 'Puntos Logisticos'
- 'Ordenes'
- 'Terceros'
- 'Gestores'
- 'Centros de Acopio'
- 'MUNICIPIOS'
- 'RegistroConciliacion'

Estados:
- 'Por Pagar'
- 'En Orden'
- 'Sin Costo'
- 'Caja Menor'
- 'Borrador'
- 'Abierta'
- 'Cerrada'

Tipos de movimiento:
- 'ENTRADA'
- 'SALIDA'

Roles:
- 'Coordinador'
- 'Administrador'
- 'Desactivado'
```

**Ubicación sugerida:** `lib/constants.ts` o `lib/constants/` con archivos por dominio.

---

### 5.8 Preparación para Producción

#### M-19: Logging estructurado

**Estado actual:** `console.log` y `console.error` en todo el código.

**Problema:**
- No hay niveles de log (info, warn, error, debug)
- No hay contexto estructurado (request ID, user ID, etc.)
- No hay destino configurable (stdout vs archivo vs servicio)
- Difícil de filtrar y buscar en producción

**Solución recomendada:** Instalar `pino` (ligero, JSON output, compatible con Next.js).

**Campos estándar por log:**
- `level`: info/warn/error
- `message`: descripción legible
- `userId`: ID del coordinador (si autenticado)
- `endpoint`: ruta del API
- `duration`: tiempo de ejecución
- `error`: stack trace (solo en errores)

---

#### M-20: Monitoreo de errores

**Solución recomendada:** Sentry (tiene SDK oficial para Next.js).

**Eventos a capturar:**
- Errores no manejados en API routes
- Errores de React (Error Boundaries)
- Timeouts de Airtable
- Fallos de envío de email
- Fallos de autenticación

---

#### M-21: Configuración de despliegue

**Estado actual:** No hay configuración de despliegue.

**Opciones y lo que cada una necesita:**

**Opción A: Vercel (recomendada para Next.js)**
- Crear `vercel.json` con configuración de dominio y env vars
- Configurar variables de entorno en dashboard de Vercel
- Build command: `npm run build`
- Output: automático

**Opción B: Docker**
- Crear `Dockerfile` multi-stage (build + run)
- Crear `.dockerignore`
- Crear `docker-compose.yml` con variables de entorno
- Configurar health check en Docker

**Opción C: VPS con PM2**
- Crear `ecosystem.config.js` para PM2
- Script de despliegue con zero-downtime restart

---

#### M-22: Health check endpoint

**Crear:** `app/api/health/route.ts`

**Checks a incluir:**
- Servidor respondiendo (básico)
- Conexión a Airtable (ping con timeout)
- Variables de entorno presentes
- Uptime del servidor

**Uso:** Monitoreo externo, load balancers, Docker health checks.

---

#### M-23: Validación de variables de entorno

**Crear:** `lib/env.ts`

**Variables requeridas a validar al arrancar:**
- `NEXTAUTH_URL` — URL válida
- `NEXTAUTH_SECRET` — mínimo 32 caracteres
- `AIRTABLE_API_KEY` — no vacío
- `AIRTABLE_BASE_ID` — formato `app*`
- `EMAIL_SERVER_HOST` — no vacío
- `EMAIL_SERVER_PORT` — número válido
- `EMAIL_SERVER_USER` — no vacío
- `EMAIL_SERVER_PASSWORD` — no vacío
- `EMAIL_FROM` — formato email válido

**Comportamiento:** Si falta alguna variable requerida, fallar al arrancar con mensaje claro indicando cuál falta.

---

## 6. Scorecard Final

| Categoría | Nota Actual | Nota Objetivo | Mejoras Relacionadas |
|-----------|-------------|---------------|---------------------|
| Arquitectura | 7/10 | 9/10 | M-02, M-14, M-15 |
| Funcionalidad | 8/10 | 9/10 | M-09, M-10 |
| Diseño visual | 6/10 | 8/10 | M-07, M-24, M-27 |
| Responsive | 3/10 | 8/10 | M-01, M-26 |
| Seguridad | 3/10 | 8/10 | M-02, M-03, M-04, M-05, M-06, M-11 |
| Accesibilidad | 6/10 | 8/10 | M-25 |
| Testing | 2/10 | 7/10 | M-12, M-13 |
| UX/Interacción | 7/10 | 9/10 | M-08, M-09, M-10 |
| Producción | 3/10 | 8/10 | M-19, M-20, M-21, M-22, M-23 |
| Calidad de código | 7/10 | 9/10 | M-14, M-15, M-16 |

---

## 7. Checklist de Implementación

### Fase 1 — Bloqueadores (antes de producción)

- [ ] **M-01** Sidebar responsive con menú hamburguesa en móvil
- [ ] **M-02** Crear `middleware.ts` para protección global de rutas
- [ ] **M-03** Instalar `zod` e implementar schemas de validación en API routes
- [ ] **M-04** Whitelist de dominios Airtable en image-proxy
- [ ] **M-05** Agregar protección CSRF en endpoints mutantes
- [ ] **M-06** Rate limiting en generación de magic links

### Fase 2 — Corto plazo (primeras 2 semanas post-producción)

- [ ] **M-07** Crear componentes base en `components/ui/`
- [ ] **M-08** Sistema de notificaciones toast (reemplazar alert())
- [ ] **M-09** Validación inline por campo en formularios
- [ ] **M-10** Breadcrumbs en páginas de detalle y edición
- [ ] **M-11** Desactivar EMAIL_TO_OVERRIDE en producción
- [ ] **M-12** Tests para API routes críticos (auth, kardex, actividades)
- [ ] **M-13** Tests para reglas de negocio (dateValidations, conciliación)

### Fase 3 — Mediano plazo

- [ ] **M-14** Dividir `lib/airtable.ts` en módulos por dominio
- [ ] **M-15** Extraer magic strings a `lib/constants.ts`
- [ ] **M-16** Optimizar queries con `filterByFormula`
- [ ] **M-17** Lazy loading de imágenes
- [ ] **M-18** TTL de 24h en cache de municipios/terceros
- [ ] **M-19** Logging estructurado con pino
- [ ] **M-20** Integrar Sentry para monitoreo de errores
- [ ] **M-21** Configuración de despliegue (Vercel/Docker)
- [ ] **M-22** Health check endpoint
- [ ] **M-23** Validación de env vars al arrancar

### Fase 4 — Mejoras continuas

- [ ] **M-24** Migrar emojis a lucide-react
- [ ] **M-25** Mejoras de accesibilidad (aria-expanded, live regions)
- [ ] **M-26** Vista de tarjetas en tablas para móvil
- [ ] **M-27** Soporte para dark mode

---

*Documento generado por auditoría automatizada con Claude Opus 4.5. Revisión basada en análisis estático del código fuente, sin ejecución del servidor ni pruebas en navegador.*
