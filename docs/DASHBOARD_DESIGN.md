# Rediseño Dashboard Administrador

## Objetivo
Dashboard ejecutivo para consulta por directivos de CampoLimpio. Debe responder preguntas clave en segundos.

## Descubrimiento (preguntas al cliente)

### 1. ¿Cuál es la PRIMERA pregunta al abrir el dashboard?
**R:** Metas de recolección y meta de sensibilizaciones. Estas son las dos métricas más importantes y deben ser lo primero que se vea.

### 2. ¿Nivel de detalle de las metas?
**R:** Global primero. Ver el % general de cumplimiento de un vistazo, y luego poder expandir para ver por coordinador.

### 3. ¿Qué es lo SEGUNDO más importante?
**R:** Tendencias y gráficas. Tendencia mensual de recolección, distribución de materiales, gráficas de progreso.

### 4. ¿Qué gráficas aportan valor?
**R:** En las juntas siempre preguntan por el tipo de material. Quieren ver el manejo de material por tipo, tanto global como por coordinador. Entradas y salidas separadas. Esto es clave para las presentaciones a directivos.

### 5. ¿Cómo se consulta el dashboard?
**R:** Consulta individual en PC por ahora. Modo TV/presentación queda para el futuro. Concentrarnos en lo fundamental.

### 6. ¿Qué sobra del dashboard actual?
**R:** Sobran para este dashboard ejecutivo:
- Saldo caja menor por coordinador (operativo, no ejecutivo)
- Tasas de rechazo de gastos/órdenes
- Mapa de Colombia
- Órdenes de servicio (estados, montos)

Estos podrían moverse a vistas separadas o eliminarse del dashboard principal.

### 7. ¿Comparativo año vs año?
**R:** Sería útil pero no prioritario. No lo piden activamente. Puede agregarse después.

### 8. ¿Dashboard nuevo o reemplazar el actual?
**R:** Crear un dashboard NUEVO aparte. No eliminar el actual por ahora.

### 9. ¿Tipos de material correctos?
**R:** Los 7 tipos del kardex son los correctos: Reciclaje, Incineración, Flexibles, Plástico Contaminado, Lonas, Cartón, Metal.

---

## Resumen de hallazgos

### Prioridades del dashboard ejecutivo (en orden)
1. **Metas de recolección y sensibilización** — % global de cumplimiento, expandible por coordinador
2. **Tendencias y gráficas** — Especialmente material por tipo (entradas y salidas separadas), global y por coordinador
3. KPIs secundarios: certificados, eventos, kg totales

### Lo que NO va en este dashboard
- Mapa de Colombia
- Órdenes de servicio (estados, montos)
- Tasas de rechazo
- Saldo caja menor por coordinador
- Alertas operativas (kardex sin orden, gastos pendientes)

### Contexto de uso
- Consulta individual en PC
- Modo TV/presentación: futuro
- Comparativo año vs año: útil pero no prioritario

### Decisiones técnicas
- Dashboard NUEVO (ruta nueva), sin eliminar el actual
- Los 7 tipos de material del kardex son los correctos

## Propuesta de Layout

### Estructura visual (sin scroll para lo esencial)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Dashboard Ejecutivo                              [Año: 2026 ▼]     │
│  Hola, {nombre}                         Actualizado: 12 mar 10:30   │
├─────────────────────────────────┬───────────────────────────────────┤
│                                 │                                   │
│  META RECOLECCIÓN     68%       │  META SENSIBILIZACIÓN    42%      │
│  ████████████░░░░░  170K/250K   │  ██████░░░░░░░░░░░░  8.400/20K    │
│  Entradas: 170.234 kg           │  Sensibilizados: 8.400 personas   │
│  Salidas:  158.100 kg           │  Evaluados: 3.200 personas        │
│  ▸ Ver por coordinador          │  ▸ Ver por coordinador            │
│                                 │                                   │
├─────────────────────────────────┴───────────────────────────────────┤
│                                                                     │
│  KPIs RÁPIDOS                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ 170.234  │ │  158.100 │ │  12.134  │ │   1.892  │                │
│  │ kg entr. │ │ kg sal.  │ │ kg saldo │ │ movim.   │                │
│  │ ↑ 12%    │ │ ↑ 8%     │ │          │ │ ↑ 5%     │                │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘                │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MATERIAL POR TIPO                          [Global ▼] [2026 ▼]     │
│                                                                     │
│  Material          Entradas (kg)    Salidas (kg)    Saldo (kg)      │
│  ─────────────────────────────────────────────────────────────────  │
│  Reciclaje         ████████  45.2K  ██████  38.1K        7.1K       │
│  Incineración      ██████    32.8K  █████   29.4K        3.4K       │
│  Flexibles         █████     28.1K  ████    22.7K        5.4K       │
│  Plást.Contam.     ████      21.5K  ████    20.1K        1.4K       │
│  Lonas             ███       18.3K  ███     17.9K        0.4K       │
│  Cartón            ███       15.2K  ██      12.8K        2.4K       │
│  Metal             ██         9.1K  ██       8.1K        1.0K       │
│  ─────────────────────────────────────────────────────────────────  │
│  TOTAL                      170.2K          149.1K       21.1K      │
│                                                                     │
│  Filtro: [Global ▼] permite seleccionar un coordinador específico   │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TENDENCIA MENSUAL (últimos 12 meses)                               │
│                                                                     │
│  kg                                                                 │
│  40K ┤                                                              │
│  30K ┤    ██                   ██                                   │
│  20K ┤ ██ ██ ██    ██ ██    ██ ██ ██                                │
│  10K ┤ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██ ██                          │
│   0  └──────────────────────────────────────                        │
│       Mar Abr May Jun Jul Ago Sep Oct Nov Dic Ene Feb Mar           │
│                                                                     │
│       ██ Entradas   ░░ Salidas                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Sección 1: Metas (lo primero que se ve)

**Dos cards grandes, lado a lado, ocupando todo el ancho.**

- **Meta Recolección (izquierda)**
  - Porcentaje grande y prominente (68%)
  - Barra de progreso con color según estado:
    - >= 70%: verde
    - 40-69%: ámbar
    - < 40%: rojo
  - Números de entradas y salidas debajo
  - Link "Ver por coordinador" que expande tabla con semáforo (ya existe)

- **Meta Sensibilización (derecha)**
  - Porcentaje grande
  - Barra de progreso
  - Personas sensibilizadas y evaluadas debajo
  - Link "Ver por coordinador" expandible

**Principio aplicado:** Responde la pregunta #1 del cliente en 2 segundos.

### Sección 2: KPIs rápidos

**4 cards compactas en una fila.**

| KPI | Qué muestra | Contexto |
|-----|-------------|----------|
| Entradas kg | Total kg entrada del año | Delta % vs mismo periodo año anterior |
| Salidas kg | Total kg salida del año | Delta % vs mismo periodo año anterior |
| Saldo kg | Entradas - Salidas del año | Inventario neto actual |
| Movimientos | Total registros kardex del año | Delta % vs año anterior |

- Números redondeados: "170K" no "170.234"
- Flecha verde (↑) o roja (↓) indicando si va mejor o peor que el año anterior
- Sin colores de fondo llamativos — fondo blanco, número grande en negro

**Principio aplicado:** Contexto con delta. Un número solo no dice nada.

### Sección 3: Material por tipo

**Tabla con barras horizontales inline. Es EL dato que piden en juntas.**

- 7 filas (uno por tipo de material)
- Columnas: Material | Entradas (kg) con barra | Salidas (kg) con barra | Saldo
- Fila TOTAL al final
- **Filtro dropdown:** "Global" (todos) o seleccionar un coordinador específico
- Barras proporcionales al máximo para comparación visual rápida

**Principio aplicado:** Entradas y salidas separadas. Global y por coordinador (filtro).
Barras horizontales en lugar de pie chart (mejor percepción según la investigación).

### Sección 4: Tendencia mensual

**Gráfica de barras agrupadas (entradas vs salidas) por mes.**

- Últimos 12 meses
- Dos colores: verde para entradas, azul para salidas
- Eje Y en kg (redondeado: 10K, 20K, etc.)
- Mes actual resaltado o con borde diferente

**Principio aplicado:** Tendencia visual que muestra estacionalidad y dirección.

---

## Especificaciones de diseño

### Paleta de colores
- **Fondo página:** #f9fafb (gris muy claro)
- **Cards:** blanco con border sutil (#e5e7eb) y sombra suave
- **Texto principal:** #111827 (casi negro)
- **Texto secundario:** #6b7280 (gris)
- **Verde marca:** #00d084 (solo para progreso positivo)
- **Rojo alerta:** #dc2626 (solo para items fuera de meta)
- **Ámbar precaución:** #f59e0b (solo para progreso medio)
- **Barras entradas:** #10b981 (verde)
- **Barras salidas:** #3b82f6 (azul)

### Tipografía
- KPI números grandes: 2rem+ bold
- Porcentajes de meta: 3rem bold
- Labels: 0.75rem uppercase gris
- Números en tablas: font-mono para alineación

### Números
- Redondear a enteros o 1 decimal max
- Usar sufijos: K (miles), M (millones) en KPIs
- Tablas de material: sin sufijo, formato es-CO con separador de miles

### Responsive
- Desktop: 2 columnas para metas, 4 columnas para KPIs
- Tablet: 2 columnas metas, 2x2 KPIs
- Móvil: todo en 1 columna, KPIs en 2x2

---

## Ruta técnica

- **URL:** `/dashboard-ejecutivo` (nueva página)
- **API:** Reutilizar `/api/dashboard/admin-stats` (ya tiene todos los datos necesarios)
- **Componente:** `components/DashboardEjecutivo.tsx` (nuevo)
- **Acceso:** Solo admin/supervisor (mismo control que el dashboard actual)
- **Sidebar:** Agregar link "Dashboard Ejecutivo" en la navegación
