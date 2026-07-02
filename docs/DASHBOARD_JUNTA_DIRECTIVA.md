# Dashboard Junta Directiva (nuevo)

**Fecha inicio:** 2026-06-25
**Estado:** ✅ IMPLEMENTADO (2026-06-25) — type-check OK. Pendiente revisión visual del usuario.

## Cómo quedó implementado

- **Ruta nueva:** `/dashboard-junta` → `app/dashboard-junta/page.tsx` (tabs **Resumen** + **Certificados**, sin "Metas por Zona").
- **Menú:** ítem nuevo "🏛️ Junta Directiva" en `Sidebar.tsx` (roles Administrador / Supervisor).
- **Enfoque:** bandera compartida `board` en los componentes existentes (decisión del usuario 2026-06-25). El dashboard ejecutivo actual `/dashboard-ejecutivo` **NO cambia** (board=false por defecto).
  - `components/DashboardEjecutivo.tsx` → prop `board?: boolean`.
  - `components/DashboardCertificados.tsx` → prop `board?: boolean`.

## Rol "Junta" (2026-06-25)

Rol nuevo en Airtable (`Coordinadores.Rol = "Junta"`) que **solo** accede al board de junta.

- **Acceso al board**: helper `canViewJunta(rol)` = Admin · Supervisor · Junta (`lib/roles.ts`). Aplicado en `app/dashboard-junta/page.tsx` y en los endpoints `ejecutivo-stats`, `ejecutivo-stats-mensual`, `actividades-por-municipio` y `certificados-stats` (Junta = "ve todo" como admin).
- **Landing**: login entra por `/dashboard`; ese page redirige `Junta → /dashboard-junta` (igual que Admin/Supervisor → `/dashboard-ejecutivo`).
- **Menú**: el rol Junta ve un único ítem "Dashboard" → `/dashboard-junta` (no ve el resto del menú). Se **eliminó** el ítem separado "Junta Directiva".
- **Acceso para Admin/Supervisor**: botón **"🏛️ Board Junta"** dentro de `/dashboard-ejecutivo` (junto a los tabs) → `/dashboard-junta`. Así no hay un ítem de menú aparte.
- Tipo `rol` ampliado con `"Junta"` en `types/next-auth.d.ts` y `lib/airtable.ts`. Login no bloquea Junta (solo bloquea `Desactivado`).

## Concepto

Dashboard **nuevo y adicional**, basado en el **Dashboard Ejecutivo** actual (`/dashboard-ejecutivo`), orientado a la **Junta Directiva**. Se construye sobre la misma base pero con los cambios que se listan abajo.

## Base de referencia (dashboard ejecutivo actual)

- **Ruta:** `/dashboard-ejecutivo` → `app/dashboard-ejecutivo/page.tsx`
- **Componente principal:** `components/DashboardEjecutivo.tsx`
- **Tabs:** Resumen (`DashboardEjecutivo`) · Metas por Zona (`MetasPorZona`) · Certificados (`DashboardCertificados`)
- **Datos:** `GET /api/dashboard/ejecutivo-stats?year=` (anual) y `ejecutivo-stats-mensual?year=&monthFrom=&monthTo=` (rango)
- **Acceso:** `isAdminOrSupervisor()` (Administrador / Supervisor)
- **Charts:** Recharts
- **Secciones del Resumen:** 3 tarjetas de Meta (Recolección, Sensibilización, Evaluaciones) · KPIs (Entradas/Salidas/Saldo) · Material por Tipo · Tendencia Mensual (12m) · Salidas por Proceso
- **Semáforo metas:** verde ≥70%, amarillo 40–70%, rojo <40%

---

## Cambios solicitados (se van acumulando)

1. **Tarjeta "Meta Recolección": mostrar SOLO el porcentaje.** Quitar los datos en kg (Entradas, Salidas, Meta). En el dashboard ejecutivo actual la tarjeta muestra `Entradas: 984.356 kg / Salidas: 971.514 kg / Meta: 2.356.001 kg`; en el de junta directiva esa tarjeta debe mostrar únicamente el `%` (sin cifras en kg). **Aplica tanto en vista Anual como Mensual** (en mensual hoy muestra `Entradas/Salidas/Meta` del mes, p. ej. `Entradas: 106.959 kg / Meta: 170.047 kg`). *(Pendiente confirmar si las metas de Sensibilización y Evaluaciones también ocultan sus cifras o solo Recolección.)*

2. **Eliminar la sección de KPIs Entradas / Salidas / Saldo.** Quitar por completo las tres tarjetas (ENTRADAS `984.356 kg`, SALIDAS `971.514 kg`, SALDO `162.499 kg neto / saldo inicial`). En `DashboardEjecutivo.tsx` es la SECCIÓN 2 de KPIs rápidos (aprox. líneas 562-588).

3. **Tabla "Material por Tipo": mostrar porcentajes del total, no cifras en kg.** Mantener la tabla (Reciclaje, Incineración, Flexibles, Plást. Contaminado, Lonas, Cartón, Metal) pero cada material expresado como **% del total**, sin kg. *(Interpretación a confirmar: Entradas = % que ese material representa del total de entradas; Salidas = % del total de salidas. Definir qué pasa con la columna Saldo y con la fila TOTAL.)* En `DashboardEjecutivo.tsx` es la SECCIÓN 3 (aprox. líneas 590-669).

4. **Eliminar el gráfico "Tendencia Mensual (últimos 12 meses)".** Quitar por completo el BarChart de Entradas vs Salidas por mes. En `DashboardEjecutivo.tsx` es la SECCIÓN 4 (aprox. líneas 671-707).

5. **Sección "Salidas por Proceso": mostrar solo porcentajes, sin kg.** Mantener la lista por proceso (Reciclaje, Coprocesamiento, Aprovechamiento Energético, Celda de Seguridad, Otros) con su barra y el `%`, pero quitar las cifras en kg (p. ej. `504.668 kg`). La fila TOTAL queda en `100%` sin kg. En `DashboardEjecutivo.tsx` es la SECCIÓN 5 (aprox. líneas 709-786).

6. **Eliminar la pestaña "Metas por Zona".** No va en el dashboard de junta directiva. Es el tab que renderiza `components/MetasPorZona.tsx` (matriz Zonas × Meses real/meta/%). El dashboard nuevo no incluye este tab.

### Pestaña "Certificados" (`components/DashboardCertificados.tsx`)
Se MANTIENE la pestaña, pero con estos ajustes:

7. **Eliminar el gráfico "Tendencia mensual de certificados (2026 vs 2025)"** (line chart 2025 vs 2026).

8. **Eliminar la tarjeta KPI "Kilos totales"** (la que muestra `587.918 kg` + `% vs período anterior`).

9. **Dejar TAL CUAL** (no tocar, conservan kilos): "Top cultivos por kilos", "Top departamentos por kilos", "Top municipios de devolución" y "Composición de materiales (kg)" (pie). Este bloque de 4 gráficos queda igual.

10. **Eliminar la tabla "Cultivo × Departamento (kilos)"** (matriz cultivo × departamento).

11. **Tabla "Por coordinador": eliminar la columna KILOS.** Dejar `COORDINADOR | CERTIFICADOS | % DEL TOTAL`, sin la columna de kilos.

12. **Eliminar la tabla "Top 20 generadores por kilos"** (ranking de generadores con `# | GENERADOR | CÉDULA/NIT | CERTIFICADOS | KILOS`).

> Nota: la indicación general "quitar los kilos de certificados" se concreta en los puntos 7–12; el bloque del punto 9 explícitamente se conserva con kilos.

### Ajustes post-revisión (2026-06-25)

13. **Tarjetas de Meta: quitar el "Ver por coordinador".** En las tres tarjetas (Recolección, Sensibilización, Evaluaciones) se oculta el botón "▸ Ver por coordinador" y su tabla de desglose. Las tarjetas conservan sus cifras de cabecera (Sensibilizados/Meta, WhatsApp/Presenciales/Total/Meta), pero sin el detalle por coordinador. → **Confirma supuesto #1: Sensibilización y Evaluaciones se quedan con cifras.**

14. **Salidas por Proceso — fila TOTAL: quitar el kg.** Faltaba envolver el `kg` de la fila TOTAL (mostraba `971.514 kg 100%`); ahora en modo board solo muestra `100%`.

15. **Certificados — ajuste sobre el punto 9 (ya NO se deja tal cual).** En modo board:
    - **Retirar el pie "Composición de materiales (kg)"**.
    - **Top cultivos / Top departamentos / Top municipios**: graficar **% del total** en vez de kg (eje, tooltip y título "(% del total)"). El % es sobre la suma de la categoría. `TopBarBlock` ahora acepta `asPercent`.

16. **Certificados — retirar tarjeta "Triple lavado"** (KPI). En board la fila de KPIs queda solo con "Certificados".

17. **Certificados — retirar tabla "Por coordinador"** completa en modo board.

18. **Mapa de actividades por municipio (NUEVO)** — al fondo del tab Resumen (solo board). Decisión 2026-06-25: coloreado por **volumen + filtro de Tipo** (reusa `MapaColombia.tsx`).
    - **Endpoint:** `GET /api/dashboard/actividades-por-municipio?year=&monthFrom=&monthTo=` (Admin/Supervisor). Agrega por DIVIPOLA: `{codigo, municipio, departamento, total, porTipo}` + lista de `tipos` + totals. Normaliza Tipo (trim; "Recoleccion"→"Recolección").
    - **Wrapper:** `components/MapaActividadesResumen.tsx` — filtro Tipo (Todos + tipos), 3 KPIs (Municipios con presencia · Total actividades · Departamentos cubiertos), recolorea por volumen del tipo elegido.
    - **MapaColombia.tsx:** extendido con props OPCIONALES `porTipo` (desglose en popup) y `leyendaTitulo`. `/mapa` sin cambios.
    - **Respeta el filtro año/mes del Resumen** (anual ⇒ meses 1–12).
    - Conversión DIVIPOLA decimal→5 dígitos igual que `/mapa` (limitación conocida con códigos de municipio terminados en 0; se mantiene por consistencia).
    - **Modo ejecutivo `focusColombia`** (prop nueva en `MapaColombia`, solo el mapa de junta): **basemap suave en escala de grises (CartoDB Positron)** en vez de las tiles verdes de OpenStreetMap → da contexto geográfico sin verdes, para que resalten los datos. Municipios sin datos transparentes (con borde leve), datos en verde. **Encuadre fijo a Colombia incluyendo San Andrés** (`COLOMBIA_BOUNDS` + `maxBounds`); ya no hace re-zoom al cambiar el filtro. `/mapa` queda sin cambios (focusColombia=false por defecto).
    - **Modo `binario`** (prop nueva): se retira el degradado por volumen (choropleth). Solo distingue municipios CON actividades (un verde) vs SIN; el detalle (conteo + desglose por tipo) se ve en el popup al pasar el mouse. Leyenda "Con / Sin actividades".
    - **Visible para TODOS los usuarios** (2026-06-25): el mapa va al final del dashboard de **todos** — junta, ejecutivo (`DashboardEjecutivo`, ya no solo en board) y coordinador (`DashboardCoordinador`). El endpoint `actividades-por-municipio` se abrió a **cualquier usuario autenticado** (quitado el guard `canViewJunta`); muestra **cobertura nacional** (todas las actividades) para todos. Props del wrapper ahora opcionales (default año actual, anual) para usarlo suelto.

19. **Capa de Recolección en el mapa (% del total nacional)** — decisión 2026-07-02 ("opción 1"): mostrar recolección **sin kilos**, como **participación % del total nacional**, en degradado de verdes.
    - **Endpoint nuevo:** `GET /api/dashboard/recoleccion-por-municipio?year=&monthFrom=&monthTo=` — agrega kardex **ENTRADAS** por `MunicipioOrigen` (record ID → código DIVIPOLA vía campo `CODIGOMUN` de MUNICIPIOS). Los kg se usan solo internamente; la respuesta expone **solo `sharePct`** (1 decimal) + totals (`municipios`, `departamentos`, `top10Pct`). Cualquier usuario autenticado.
    - **Wrapper:** toggle **"Actividades | Recolección"** en `MapaActividadesResumen`. En recolección: choropleth verde por % share, sin filtro de Tipo, KPIs = Municipios con recolección · Top 10 concentran X% · Departamentos con recolección.
    - **MapaColombia:** prop nueva `esPorcentaje` (popup "X% del total nacional", leyenda con decimales). El velo blanco + no-hover de municipios sin datos ahora aplica a todo modo `focusColombia` (no solo binario). `/mapa` sin cambios.
    - Validado con datos reales 2026: 163 municipios, top Madrid-Cundinamarca 6,0%, top10 = 35%, 18 deptos.

20bis. **Top 5 municipios clickeable** (2026-07-02): en modo Recolección, panel con los 5 municipios principales (puesto, municipio–departamento, % del total). Click → el mapa **vuela al municipio**, lo resalta y muestra su tarjeta (prop `municipioFoco` en `MapaColombia`; `flyToBounds` + highlight; re-click o cambiar dataset/periodo limpia el foco y vuelve a la vista general vía `initialBoundsRef`).

21. **Nivel Departamento en el mapa de recolección** (2026-07-02): los KPIs "Municipios con recolección" y "Departamentos con recolección" son ahora **switch de nivel** (click cambia el mapa). Sin GeoJSON nuevo: en nivel depto todos los municipios de un departamento se pintan con el % departamental y **borde del color del relleno** (se leen como bloque); cruce por prefijo de 2 dígitos del `PRECIND_ID`. Hover resalta el departamento completo (tarjeta: nombre, % del total, # municipios). Endpoint devuelve `porDepartamento` (agregado por `CODIGODEPTO` sobre kg reales; solo %). Top 5 departamentos clickeable (vuela a bounds combinados). KPI central cambia a "Top 5 departamentos concentran". `key={nivel}` remonta el mapa al alternar. Validado 2026: Cundinamarca 29,7%, Antioquia 23,4%, Valle 11,9%; top5 = 77,9%.

20. **Leyenda interactiva + quintiles** (2026-07-02, idea del usuario + mejora): en el choropleth la leyenda es **clickeable** — click en un rango "enciende" solo los municipios de ese rango (los demás se apagan con velo), click de nuevo o "✕ Ver todos" lo quita; muestra el conteo de municipios por rango. Además, en modo % la escala pasa de rangos lineales a **quintiles** (cada rango ≈ mismo número de municipios) porque la distribución sesgada dejaba casi todo en el primer verde pálido. Etiquetas con el min–max real de cada rango. Técnica: `styleFnRef` + `layer.setStyle()` re-estila sin recrear el mapa; `mouseout` restaura el estilo vigente (no `resetStyle`). `/mapa` conserva rangos lineales.

---

## Decisiones tomadas + supuestos aplicados (revisar)

- ✅ Ruta aparte `/dashboard-junta` con bandera compartida `board` (no duplicar componentes).
- ✅ Acceso: mismo `isAdminOrSupervisor` (Administrador / Supervisor).
- ✅ Tabs: Resumen + Certificados (sin Metas por Zona).
- **Supuesto (confirmar):** las tarjetas **Meta Sensibilización** y **Meta Evaluaciones** se dejaron **con sus cifras** (solo se pidió explícitamente quitar kg en Recolección). Si la junta también las quiere solo en %, se ajusta.
- **Supuesto (confirmar):** en "Material por Tipo" el % de Entradas es sobre el **total de entradas** y el de Salidas sobre el **total de salidas**; se **quitó la columna Saldo** (un % de saldo no es significativo). Fila TOTAL = 100% / 100%.
