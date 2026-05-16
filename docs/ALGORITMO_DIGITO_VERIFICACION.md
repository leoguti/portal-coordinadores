# Algoritmo Oficial: Dígito de Verificación (DV)

## Resumen Ejecutivo

Este documento especifica el algoritmo oficial para calcular el **Dígito de Verificación (DV)** de documentos de identificación colombianos (CC, NIT, etc.), confirmado mediante:
- Documentos legales oficiales
- Calculadora tiendana.com
- Verificador DV de la DIAN (archivo Excel proporcionado por usuario)

**Importante:** Existe **UN ÚNICO ALGORITMO** que aplica a todos los tipos de documentos, independientemente de si es Cédula de Ciudadanía (CC) o Número de Identificación Tributaria (NIT).

---

## Algoritmo Oficial

### Pesos Utilizados

Los pesos son números primos aplicados de izquierda a derecha:

```
Posición:  1   2   3   4   5   6   7   8   9   10  11  12  13  14  15
Peso:     71  67  59  53  47  43  41  37  29  23  19  17  13   7   3
```

### Procedimiento

1. **Formato:** Convertir el número de identificación a 15 dígitos rellenando con ceros a la izquierda
   - Ejemplo: `6525231` → `000000006525231`

2. **Multiplicación:** Multiplicar cada dígito por su peso correspondiente
   ```
   dígito[1]  × 71  +
   dígito[2]  × 67  +
   dígito[3]  × 59  +
   dígito[4]  × 53  +
   dígito[5]  × 47  +
   dígito[6]  × 43  +
   dígito[7]  × 41  +
   dígito[8]  × 37  +
   dígito[9]  × 29  +
   dígito[10] × 23  +
   dígito[11] × 19  +
   dígito[12] × 17  +
   dígito[13] × 13  +
   dígito[14] × 7   +
   dígito[15] × 3
   ```

3. **Módulo 11:** Calcular el residuo de la suma entre 11
   ```
   residuo = suma % 11
   ```

4. **Dígito Verificación:** Aplicar regla de conversión
   ```
   Si residuo = 0:  DV = 0
   Si residuo = 1:  DV = 1
   Si residuo > 1:  DV = 11 - residuo
   ```

---

## Ejemplos Verificados

### Ejemplo 1: NIT 891410828 (Casa del Bombillo)

**Entrada:** `891410828`

**Paso 1 - Formato a 15 dígitos:**
```
000000891410828
```

**Paso 2 - Multiplicación por pesos:**
```
Pos  1: 0 × 71 =      0
Pos  2: 0 × 67 =      0
Pos  3: 0 × 59 =      0
Pos  4: 0 × 53 =      0
Pos  5: 0 × 47 =      0
Pos  6: 0 × 43 =      0
Pos  7: 8 × 41 =    328
Pos  8: 9 × 37 =    333
Pos  9: 1 × 29 =     29
Pos 10: 4 × 23 =     92
Pos 11: 1 × 19 =     19
Pos 12: 0 × 17 =      0
Pos 13: 8 × 13 =    104
Pos 14: 2 × 7  =     14
Pos 15: 8 × 3  =     24
       ─────────────────
       SUMA = 943
```

**Paso 3 - Módulo 11:**
```
943 % 11 = 8
```

**Paso 4 - Cálculo DV:**
```
residuo = 8 (> 1)
DV = 11 - 8 = 3 ✓
```

**Resultado:** `891410828-3` ✅ VALIDADO

---

### Ejemplo 2: NIT 6525231 (Documento Legal Verificado)

**Entrada:** `6525231`

**Paso 1 - Formato a 15 dígitos:**
```
000000006525231
```

**Paso 2 - Multiplicación por pesos:**
```
Pos  1-8:  0 × (71, 67, 59, 53, 47, 43, 41, 37) =    0
Pos  9: 6 × 29 =    174
Pos 10: 5 × 23 =    115
Pos 11: 2 × 19 =     38
Pos 12: 5 × 17 =     85
Pos 13: 2 × 13 =     26
Pos 14: 3 × 7  =     21
Pos 15: 1 × 3  =      3
       ──────────────────
       SUMA = 462
```

**Paso 3 - Módulo 11:**
```
462 % 11 = 0
```

**Paso 4 - Cálculo DV:**
```
residuo = 0
DV = 0 ✓
```

**Resultado:** `6525231-0` ✅ VALIDADO

---

### Ejemplo 3: CC 1052397182 (Persona Natural — 10 dígitos)

**Entrada:** `1052397182` (Daniel Alfonso Dallos Nuñez)

**Paso 1 - Formato a 15 dígitos:**
```
000001052397182
```

**Paso 2 - Multiplicación por pesos:**
```
Pos  1-5:  0 × (71, 67, 59, 53, 47) =    0
Pos  6: 1 × 43 =     43
Pos  7: 0 × 41 =      0
Pos  8: 5 × 37 =    185
Pos  9: 2 × 29 =     58
Pos 10: 3 × 23 =     69
Pos 11: 9 × 19 =    171
Pos 12: 7 × 17 =    119
Pos 13: 1 × 13 =     13
Pos 14: 8 × 7  =     56
Pos 15: 2 × 3  =      6
       ──────────────────
       SUMA = 720
```

**Paso 3 - Módulo 11:**
```
720 % 11 = 5
```

**Paso 4 - Cálculo DV:**
```
residuo = 5 (> 1)
DV = 11 - 5 = 6 ✓
```

**Resultado:** `1052397182-6` ✅ VALIDADO

> ⚠️ **Lección crítica de este ejemplo:** Es **imprescindible contar correctamente
> los dígitos** y aplicar el padding a 15. Una transcripción errónea (leer
> `105239718` de 9 dígitos en vez de `1052397182` de 10) produce un DV
> completamente distinto (8 en vez de 6) y puede hacer parecer fraudulento un
> documento legítimo. **El padding a 15 dígitos es lo que permite que el MISMO
> algoritmo funcione tanto para CC como para NIT** — no existen dos algoritmos.

---

## Implementación en Código

### JavaScript

```javascript
function calcularDV(numero) {
  const pesos = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
  const digitos = String(numero).replace(/[^\d]/g, '').padStart(15, '0');

  let suma = 0;
  for (let i = 0; i < 15; i++) {
    suma += parseInt(digitos[i], 10) * pesos[i];
  }

  const residuo = suma % 11;
  
  if (residuo === 0) return 0;
  if (residuo === 1) return 1;
  return 11 - residuo;
}
```

### SQL / Excel

```excel
=IF(MOD(
  VALUE(MID(TEXT(A1,"000000000000000"),1,1))*71 +
  VALUE(MID(TEXT(A1,"000000000000000"),2,1))*67 +
  VALUE(MID(TEXT(A1,"000000000000000"),3,1))*59 +
  VALUE(MID(TEXT(A1,"000000000000000"),4,1))*53 +
  VALUE(MID(TEXT(A1,"000000000000000"),5,1))*47 +
  VALUE(MID(TEXT(A1,"000000000000000"),6,1))*43 +
  VALUE(MID(TEXT(A1,"000000000000000"),7,1))*41 +
  VALUE(MID(TEXT(A1,"000000000000000"),8,1))*37 +
  VALUE(MID(TEXT(A1,"000000000000000"),9,1))*29 +
  VALUE(MID(TEXT(A1,"000000000000000"),10,1))*23 +
  VALUE(MID(TEXT(A1,"000000000000000"),11,1))*19 +
  VALUE(MID(TEXT(A1,"000000000000000"),12,1))*17 +
  VALUE(MID(TEXT(A1,"000000000000000"),13,1))*13 +
  VALUE(MID(TEXT(A1,"000000000000000"),14,1))*7 +
  VALUE(MID(TEXT(A1,"000000000000000"),15,1))*3
, 11) = 0, 0, IF(MOD(..., 11) = 1, 1, 11 - MOD(..., 11)))
```

---

## Fuentes Oficiales

1. **tiendana.com** - Calculadora DV oficial (https://www.tiendana.com/calcular-digito-verificacion-nit)
2. **DIAN** - Verificador DV (archivo Excel de William Dussán Salazar)
3. **Documentos legales** - RUTs y certificados de identificación validados

---

## Precisión Confirmada

Diagnóstico sobre base de datos exógena 2025 (679 registros):

| Categoría | Cantidad |
|-----------|----------|
| ✅ Válidos (DV correcto) | 629 |
| 🚨 Fraudulentos (DV incorrecto) | 2 |
| ⚠️ Sin DV | 43 |
| ❌ Datos corruptos | 5 |

- **CC (Tipo 13):** 0 documentos fraudulentos — el algoritmo único funciona perfectamente
- **NIT (Tipo 31):** solo 2 documentos con DV incorrecto:
  - `900339719-4` (debe ser `900339719-8`)
  - `900638691-7` (debe ser `900638691-3`)

> El alto índice de validación (629/679) se logró únicamente al aplicar el
> **padding a 15 dígitos**. Sin ese paso, las cédulas (números cortos) fallaban
> masivamente porque los pesos se desalineaban.

---

## Notas Importantes

⚠️ **Un único algoritmo:** No hay algoritmos diferentes para CC vs NIT. El mismo algoritmo aplica a todos, **siempre que se aplique el padding a 15 dígitos**.

⚠️ **Formato OBLIGATORIO:** Siempre rellenar el número a 15 dígitos con ceros a la izquierda ANTES de aplicar los pesos. Este es el paso más crítico y la causa #1 de cálculos erróneos. Tomar solo los primeros 9 dígitos (error común) desalínea los pesos y produce DVs incorrectos para números cortos como las cédulas.

⚠️ **Contar bien los dígitos:** Una transcripción con un dígito de más o de menos cambia completamente el resultado. Verificar la longitud del número antes de calcular.

⚠️ **Detección de fraude:** Si un documento produce un DV diferente al calculado con este algoritmo (y el número fue transcrito correctamente), el documento es potencialmente fraudulento.

---

**Documento oficial:** CampoLimpio Portal  
**Fecha:** 2026-05-16  
**Confirmado por:** Leonardo Gutiérrez, análisis de tiendana.com y DIAN
