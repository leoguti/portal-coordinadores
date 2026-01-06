# Reglas de Negocio - Kardex

## Cálculo de Saldos (Método Acumulado Histórico)

### Concepto Principal
El **saldo** funciona como un **estado de cuenta bancario**: muestra el balance acumulado desde el inicio de los tiempos hasta la fecha del corte.

### Regla de Cálculo
```
SALDO = SUMA(TODAS las ENTRADAS históricas) - SUMA(TODAS las SALIDAS históricas)
```

**Importante**: El saldo NO se calcula solo con los movimientos del periodo actual, sino con TODO el histórico hasta ese momento.

### Estructura de Datos en Airtable
- **Campo `Total`** en registros de ENTRADA: valor **POSITIVO** (ej: +1000)
- **Campo `Total`** en registros de SALIDA: valor **NEGATIVO** (ej: -500)
- Para visualización: usar `Math.abs(Total)` para mostrar valores positivos en columnas

### Resúmenes Mensuales y Anuales

#### Columnas de Entradas/Salidas (Específicas del Periodo)
Muestran **solo los movimientos de ese periodo**:
- **Entradas del mes**: `SUM(Total WHERE TipoMovimiento="ENTRADA" AND MES="YYYY-MM")`
- **Salidas del mes**: `SUM(Total WHERE TipoMovimiento="SALIDA" AND MES="YYYY-MM")`

#### Columna de Saldo (Acumulado Histórico)
Muestra el **balance acumulado hasta el final del periodo**:
- **Saldo a fin de mes**: `SUM(Total WHERE fechakardex <= "YYYY-MM-31")`

### Ejemplo Diciembre 2025

Supongamos:
- **Histórico hasta Nov 2025**: 3,000,000 kg entradas - 2,800,000 kg salidas = 200,000 kg saldo
- **Movimientos Dic 2025**: 150,000 kg entradas - 120,000 kg salidas

**La tabla mostraría:**
| Mes | Entradas | Salidas | Saldo |
|-----|----------|---------|-------|
| 2025-12 | 150,000 kg | 120,000 kg | **230,000 kg** |

**Nota**: El saldo (230,000) NO es 150,000 - 120,000 = 30,000, sino el acumulado histórico total.

### Verificación de Cálculos
Scripts de referencia que implementan correctamente esta lógica:
- `scripts/calcular-saldo-kardex.ts` - Cálculo para un coordinador
- `scripts/calcular-saldos-todos-coordinadores.ts` - Cálculo para todos

**Resultado esperado (datos reales hasta 2025-12-31)**:
```
Total global: 3,258,659 kg entradas - 2,913,761 kg salidas = 344,898 kg saldo
```

### Implementación en el Portal
Ver `app/kardex/page.tsx` líneas 385-450:
- Líneas 385-408: Resumen mensual (entradas/salidas del mes, saldo acumulado)
- Líneas 410-449: Resumen anual (entradas/salidas del año, saldo acumulado)

## Período de Cierre (Gracia de 7 días)

### Regla Principal
Un periodo (mes o año) se considera **CERRADO** solo después de **7 días** de haber terminado.

### Ejemplos
- **Diciembre 2025** termina el 31/12/2025
  - Se cierra el **07/01/2026** (31 + 7 días)
  - Si hoy es 06/01/2026 → **ABIERTO** ✅
  - Si hoy es 08/01/2026 → **CERRADO** ✅

- **Año 2025** se cierra cuando su último mes (diciembre) se cierra
  - Diciembre 2025 cierra el 07/01/2026
  - Por lo tanto, el año 2025 cierra el 07/01/2026

### Implementación
Ver `app/kardex/page.tsx` líneas 364-383:
- `esMesCerrado(mesStr)`: Verifica si un mes está cerrado
- `esAñoCerrado(añoStr)`: Verifica si un año está cerrado (basándose en diciembre)

### Visualización en la UI
- **Periodos ABIERTOS**: Badge amarillo 🔓 + fondo amarillo
- **Periodos CERRADOS**: Badge verde ✅ + fondo blanco

### Justificación
Este período de gracia permite a los coordinadores hacer correcciones o agregar movimientos tardíos después del fin del mes, sin necesidad de reabrir periodos manualmente.
