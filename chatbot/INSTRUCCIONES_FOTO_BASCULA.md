# 📸 INSTRUCCIONES: Agregar Foto de Báscula Obligatoria en Flujo Kardex

## 📋 Resumen
Necesitas modificar el flujo **30-Kardex Airtable** para que:
- ✅ **SALIDAS**: Foto de báscula sea **OBLIGATORIA**
- ✅ **ENTRADAS**: Foto de báscula sea **OPCIONAL**

---

## 🎯 Identificación del Flujo

**Flujo**: 30-Kardex Airtable  
**UUID**: `e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13`  
**URL Editor**: https://textit.com/flow/editor/e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13/

---

## 🔍 Análisis Actual

El flujo actual tiene dos rutas principales que se bifurcan después de que el usuario selecciona el tipo de movimiento:

### 📥 RUTA ENTRADA (Nodo con UUID: `c7a808db-949d...`)
- El usuario ingresa todos los datos en un solo mensaje con formato específico
- Actualmente **NO solicita foto de báscula**

### 📤 RUTA SALIDA (Nodo con UUID: `e4d9347e-27b3...`)
- El usuario ingresa datos base
- Luego selecciona Centro de Acopio (si aplica)
- Luego selecciona Gestor de disposición final
- Actualmente **NO solicita foto de báscula**

### 🌐 Envío Final a Airtable (Nodo #78)
- UUID: `9f41fdc7-6f99-41f4-97ab-e6de37f7c59f`
- Webhook POST a: `https://api.airtable.com/v0/appniHwKiUMS0imXD/Kardex`
- **Actualmente NO incluye el campo `soportebascula`**

---

## ✏️ MODIFICACIONES REQUERIDAS

### 🔴 PARTE 1: AGREGAR SOLICITUD DE FOTO EN SALIDAS (OBLIGATORIA)

**Ubicación**: Después del nodo que selecciona el Gestor (nodo #65 aprox.), y **ANTES** del nodo de confirmación final.

**Acción**: Agregar **2 nuevos nodos**:

#### NODO NUEVO A: Solicitar Foto de Báscula (SALIDA)
```
Tipo: Send Message + Wait for Response

📸 FOTO DE BÁSCULA REQUERIDA

Para completar el registro de SALIDA, es OBLIGATORIO enviar la foto de la báscula que muestra el peso del material.

📌 Por favor, tome una foto clara de la báscula y envíela ahora.

⚠️ IMPORTANTE: 
- La foto debe mostrar claramente el peso registrado
- Sin esta foto, no se podrá completar el registro
- Solo envíe UNA foto

Envíe la foto ahora:
```

**Configuración del nodo**:
- **Wait for Response**: Yes
- **Result Name**: `foto_bascula_salida`
- **Save as**: Result para el flujo

---

#### NODO NUEVO B: Validar que se recibió la foto (SALIDA)

**Router/Split**:
- Revisar si `@results.foto_bascula_salida` contiene un attachment (imagen)
- Si **SÍ tiene foto**: Continuar al nodo de confirmación
- Si **NO tiene foto**: Volver a solicitar la foto (al NODO A)

**Mensaje si NO se recibió foto**:
```
❌ ERROR: No se recibió ninguna foto

Para SALIDAS, la foto de la báscula es OBLIGATORIA.

Por favor, tome la foto de la báscula y envíela ahora:
```

**Configuración del Router/Split**:
```
Categoría 1 - "Has Photo":
- Nombre: Has Photo
- Condición: @(has_image(results.foto_bascula_salida))
- Exit: Continuar al siguiente nodo (confirmación)

Categoría 2 - "No Photo":
- Nombre: No Photo
- Condición: Other (cualquier otra respuesta)
- Exit: Volver al NODO A (solicitar foto nuevamente - LOOP)
```

**⚠️ IMPORTANTE**: Esto crea un loop infinito hasta que envíe una imagen válida.

---

### 🟢 MENSAJES PARA COPIAR EN EL FLUJO DE ENTRADA

#### 📝 NODO C - Mensaje principal (preguntar si quiere foto):

```
📸 FOTO DE BÁSCULA (OPCIONAL)

¿Desea agregar una foto de la báscula para este registro de ENTRADA?

La foto es OPCIONAL pero recomendada como respaldo visual del peso.

Responda:
1️⃣ Para enviar foto
2️⃣ Para continuar sin foto
```

---

#### ❌ NODO C - Mensaje de error (respuesta inválida):

```
❌ Respuesta no válida

Por favor responda:
• 1 = Enviar foto
• 2 = Continuar sin foto
```

---

#### 📸 NODO D - Mensaje de captura (solicitar foto):

```
📸 Envíe la foto de la báscula

Por favor, tome una foto clara de la báscula mostrando el peso y envíela ahora.
```

---

### 🔧 CONFIGURACIÓN TÉCNICA:

**NODO C - Router/Split:**
- **Result Name**: `quiere_foto_entrada`
- **Categoría 1**: `has only text` = `1` → Exit: NODO D
- **Categoría 2**: `has only text` = `2` → Exit: Confirmación (con Set Result: `foto_bascula = ""`)
- **Categoría 3**: `Other` → Exit: Volver a NODO C (mostrar mensaje de error)

**NODO D - Set Run Result:**
- **Result Name**: `foto_bascula`
- **Value**: `@(replace(replace(replace(input.attachments, "image/jpeg:", ""), "[", ""), "]", ""))`

---

**Ubicación**: Después de que el usuario ingresa todos los datos de ENTRADA (nodo #22), y **ANTES** del nodo de confirmación final.

**Acción**: Agregar **2 nuevos nodos**:

---

#### NODO NUEVO C: Preguntar si quiere enviar foto (ENTRADA - Opcional)

**Tipo**: Send Message + Wait for Response

**Texto del mensaje:**
```
📸 FOTO DE BÁSCULA (OPCIONAL)

¿Desea agregar una foto de la báscula para este registro de ENTRADA?

Esta foto es OPCIONAL pero recomendada para tener un respaldo visual del peso registrado.

📌 Opciones:
1️⃣ Enviar foto ahora
2️⃣ Continuar sin foto

Responda "1" para enviar la foto, o "2" para continuar sin foto:
```

**Configuración del nodo**:
- **Wait for Response**: Yes
- **Result Name**: `quiere_foto_entrada`
- **Split by**: Switch

**Router/Split - Configurar 3 categorías:**

**Categoría 1 - "Quiere Foto":**
- Nombre: `Quiere Foto`
- Rules: `has only text` = `1`
- Exit: → Ir al **NODO D** (capturar foto)

**Categoría 2 - "No Quiere Foto":**
- Nombre: `No Quiere Foto`
- Rules: `has only text` = `2`
- Exit: → Ir directamente al **nodo de confirmación final**
- **IMPORTANTE**: En este exit, agregar una acción **"Set Run Result"**:
  - Result Name: `foto_bascula`
  - Value: (dejar vacío o escribir `""`)
  - Esto asegura que la variable exista pero esté vacía

**Categoría 3 - "Respuesta Inválida" (Other):**
- Nombre: `Respuesta Inválida`
- Rules: `Other` (cualquier otra respuesta)
- Exit: → Volver al mismo **NODO C** (loop)
- Agregar mensaje de error:

```
❌ Respuesta no válida. 

Por favor responda:
• "1" para enviar foto
• "2" para continuar sin foto
```

---

#### NODO NUEVO D: Capturar Foto de Báscula (ENTRADA)

**Tipo**: Send Message + Wait for Response

**Texto del mensaje:**
```
📸 Envíe la foto de la báscula ahora

Por favor, tome una foto clara de la báscula que muestra el peso del material y envíela.

Puede enviar la foto directamente desde su cámara o galería.
```

**Configuración**:
- **Wait for Response**: Yes
- **No validar** si es foto o no (es opcional, cualquier respuesta es válida)

**Acción inmediata después de recibir la respuesta** - Agregar **"Set Run Result"**:
- **Result Name**: `foto_bascula`
- **Value**: `@(replace(replace(replace(input.attachments, "image/jpeg:", ""), "[", ""), "]", ""))`
- **Category**: (dejar vacío)

**Exit**: Continuar al nodo de confirmación final

---

#### DIAGRAMA DE FLUJO PARA ENTRADA:

```
[Ingresa datos ENTRADA]
         ↓
[¿Quiere enviar foto?] ← NODO C
         ↓
    ┌────┴────┐
    |         |
   "1"       "2"
    |         |
    ↓         ↓
[Captura   [Set foto_bascula = ""]
  foto]         ↓
    ↓         [Confirmación] → [Webhook]
[Set foto_bascula]
    ↓
[Confirmación] → [Webhook]
```

---

#### NOTAS IMPORTANTES:

1. **El webhook ya está preparado**: La línea `@(if(results.foto_bascula, ...))` maneja ambos casos:
   - Si hay foto → la envía
   - Si está vacío → no agrega el campo

2. **No hace falta modificar el webhook**: Ya funciona para SALIDA (obligatoria) y ENTRADA (opcional)

3. **La validación de foto opcional es diferente**: No verificamos si es imagen, aceptamos cualquier input

4. **Si responde algo diferente a "1" o "2"**: Loop infinito hasta respuesta válida

---

### 🔴 PARTE 3: MODIFICAR WEBHOOK A AIRTABLE

**Nodo a modificar**: Nodo #78 (UUID: `9f41fdc7-6f99...`)

#### PASO PREVIO - GUARDAR LA FOTO EN UNA VARIABLE

**CRÍTICO**: En el nodo que captura la foto, debes agregar inmediatamente una acción **"Set Run Result"**:

- **Result Name**: `foto_bascula`
- **Value**: `@(replace(replace(replace(input.attachments, "image/jpeg:", ""), "[", ""), "]", ""))`
- **Category**: (dejar vacío)

**¿Por qué?** La variable `@input.attachments` se borra al avanzar de nodo. Debemos guardarla en `@results.foto_bascula` para usarla después en el webhook.

**¿Qué hace el Value?**
- Elimina el prefijo `image/jpeg:`
- Elimina los corchetes `[` y `]` que TextIt agrega
- Resultado: URL limpia como `https://dl-textit.s3.us-east-1.amazonaws.com/attachments/...`

---

#### Body del Webhook - VERSIÓN FINAL FUNCIONAL:

```json
{
  "records": [
    {
      "fields": {
        "Coordinador": ["@results.id_coordinador"],
        "fechakardex": "@results.fechakardex",
        "TipoMovimiento": "@results.tipomovimiento",
        "MunicipioOrigen": ["@results.idmunicipioorigen"],
        "Reciclaje": @results.reciclaje,
        "Incineracion": @results.incineracion,
        "PlasticoContaminado": @results.plasticocontaminado,
        "Flexibles": @results.flexibles,
        "Lonas": @results.lonas,
        "Carton": @results.carton,
        "Metal": @results.metal,
        "Observaciones": "@results.observaciones"
        @(if(results.id_acopio, ", \"CentrodeAcopio\": [\"" & results.id_acopio & "\"]", ""))
        @(if(results.id_gestor, ", \"gestor\": [\"" & results.id_gestor & "\"]", ""))
        @(if(results.foto_bascula, ", \"soportebascula\": [{\"url\": \"" & results.foto_bascula & "\"}]", ""))
      }
    }
  ]
}
```

**Línea agregada (última línea antes del cierre):**
```
@(if(results.foto_bascula, ", \"soportebascula\": [{\"url\": \"" & results.foto_bascula & "\"}]", ""))
```

**Explicación**:
- Usa `@results.foto_bascula` que contiene la URL limpia guardada previamente
- El `if()` verifica que la variable exista (para soportar entradas opcionales)
- Si hay foto, agrega el campo `soportebascula` con formato Airtable: `[{"url": "..."}]`
- Si no hay foto, no agrega nada (string vacío)

---

#### RESUMEN DE LA ESTRATEGIA QUE FUNCIONA:

1. **Nodo de captura de foto** → Pide foto al usuario
2. **Set Run Result** (mismo nodo o siguiente) → Guarda URL limpia en `foto_bascula`
   - Value: `@(replace(replace(replace(input.attachments, "image/jpeg:", ""), "[", ""), "]", ""))`
3. **Nodos intermedios** → Confirmación, selecciones, etc.
4. **Webhook a Airtable** → Usa `@results.foto_bascula` en el body

**Problema resuelto**: `@input.attachments` se pierde entre nodos. La solución es guardarla en una variable `@results` que persiste durante todo el flujo.

---

## ⚠️ ADVERTENCIAS IMPORTANTES

### Para SALIDAS:
1. La foto es **OBLIGATORIA** - el flujo NO debe continuar sin foto
2. Debes validar que se recibió una imagen antes de continuar
3. Si el usuario no envía foto, volver a pedirla

### Para ENTRADAS:
1. La foto es **OPCIONAL** - dar opción de omitir
2. Si el usuario elige no enviar foto, continuar normalmente
3. No bloquear el flujo si no hay foto

### Para el Webhook:
1. El formato de Airtable para attachments es: `[{ "url": "url_de_la_imagen" }]`
2. TextIt guarda las imágenes en `results.nombre_variable.attachments[0].url`
3. Usar condicional `@(if(...))` para solo incluir el campo si existe la foto

---

## 🎯 DIAGRAMA DE FLUJO SIMPLIFICADO

```
[Tipo Movimiento?]
        |
        ├─── ENTRADA ──> [Ingresa datos] ──> [¿Quiere foto?]
        |                                           |
        |                                           ├─ Sí ──> [Captura foto opcional]
        |                                           |                 |
        |                                           └─ No ─────────┐  |
        |                                                           ↓  ↓
        |                                                    [Confirmación] ──> [Webhook a Airtable]
        |
        └─── SALIDA ──> [Ingresa datos] ──> [Selecciona CA] ──> [Selecciona Gestor] 
                                                                        |
                                                                        ↓
                                                              [FOTO OBLIGATORIA] ──> [Valida foto]
                                                                                            |
                                                                                    ¿Tiene foto?
                                                                                            |
                                                                                    ├─ Sí ──> [Confirmación]
                                                                                    |                  |
                                                                                    └─ No ──> [Volver a pedir foto]
                                                                                                       |
                                                                                            [Webhook a Airtable]
```

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN

- [ ] **Paso 1**: Ubicar el nodo donde se selecciona el Gestor (en ruta SALIDA)
- [ ] **Paso 2**: Agregar NODO A (solicitar foto obligatoria para SALIDA)
- [ ] **Paso 3**: Agregar NODO B (validar foto recibida para SALIDA)
- [ ] **Paso 4**: Conectar los nodos correctamente (con loop si no hay foto)
- [ ] **Paso 5**: Ubicar el nodo después de ingresar datos de ENTRADA
- [ ] **Paso 6**: Agregar NODO C (preguntar si quiere foto para ENTRADA)
- [ ] **Paso 7**: Agregar NODO D (capturar foto opcional para ENTRADA)
- [ ] **Paso 8**: Modificar el webhook (Nodo #78) para incluir campo `soportebascula`
- [ ] **Paso 9**: Probar flujo con SALIDA (verificar que pide foto obligatoria)
- [ ] **Paso 10**: Probar flujo con ENTRADA (verificar que foto es opcional)
- [ ] **Paso 11**: Verificar en Airtable que la foto se guarda correctamente

---

## 🧪 CASOS DE PRUEBA

### Prueba 1: SALIDA con foto
1. Iniciar flujo
2. Seleccionar SALIDA
3. Ingresar datos
4. Seleccionar Centro de Acopio (si aplica)
5. Seleccionar Gestor
6. **Debe pedir foto de báscula**
7. Enviar foto
8. **Debe continuar a confirmación**
9. Confirmar
10. **Verificar en Airtable que el registro tiene la foto en campo `soportebascula`**

### Prueba 2: SALIDA sin foto (debe fallar)
1. Iniciar flujo
2. Seleccionar SALIDA
3. Ingresar datos
4. Seleccionar Gestor
5. **Debe pedir foto de báscula**
6. Enviar texto en lugar de foto
7. **Debe rechazar y pedir foto nuevamente**
8. No debe permitir continuar sin foto

### Prueba 3: ENTRADA con foto
1. Iniciar flujo
2. Seleccionar ENTRADA
3. Ingresar datos
4. **Debe preguntar si quiere enviar foto**
5. Responder "1" (quiero enviar foto)
6. Enviar foto
7. **Debe continuar a confirmación**
8. Confirmar
9. **Verificar en Airtable que el registro tiene la foto**

### Prueba 4: ENTRADA sin foto
1. Iniciar flujo
2. Seleccionar ENTRADA
3. Ingresar datos
4. **Debe preguntar si quiere enviar foto**
5. Responder "2" (no quiero enviar foto)
6. **Debe continuar a confirmación sin pedir foto**
7. Confirmar
8. **Verificar en Airtable que el registro NO tiene foto (campo vacío)**

---

## ✅ DECISIONES CONFIRMADAS

### 1. ¿Validar que sea realmente una imagen en SALIDA?
**✅ SÍ** - Usar `has_image()` en el router de validación.

### 2. ¿Cuántas veces reintentar si no envía foto en SALIDA?
**✅ OPCIÓN A**: Loop infinito hasta que envíe foto correcta (es obligatorio para SALIDA).

### 3. ¿Qué hacer si responde algo diferente a "1" o "2" en ENTRADA?
**✅ OPCIÓN B**: Volver a preguntar hasta que responda "1" o "2" válidos.

### 4. ¿Formato del attachment en Airtable?
**✅ CONFIRMADO**: `"soportebascula": [{ "url": "url_de_la_imagen" }]`
- Se probará antes de implementar en producción

---

## 📞 CONTACTO SI NECESITAS AYUDA

Si durante la implementación tienes dudas o encuentras problemas:
1. Exporta el flujo modificado
2. Compártelo para revisión
3. Indica qué nodo específico está causando problema

---

**Fecha de creación**: 22 de enero de 2026  
**Fecha de solución exitosa**: 23 de enero de 2026  
**Autor**: Leonardo Gutiérrez + Claude  
**Flujo**: 30-Kardex Airtable  
**Campo en Airtable**: `soportebascula` (tipo Attachment)

**Estado**: ✅ SOLUCIONADO - Foto de báscula guardándose correctamente en Airtable
