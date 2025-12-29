# 📋 INSTRUCCIONES: Agregar Estado de Pago al Flujo de Kardex

## 🎯 Objetivo
Agregar una pregunta de "Estado de Pago" ANTES del mensaje de resumen final en el flujo 30-Kardex Airtable.

---

## 📍 UBICACIÓN
Ir a: https://textit.com/flow/editor/e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13/

Buscar el nodo que dice:
> "🎉 ¡Buen trabajo! Estamos listos para registrar esta información..."

**Agregar ANTES de ese nodo.**

---

## ✏️ PASO 1: Crear nuevo nodo "Send Message"

**Texto del mensaje:**
```
💰 FORMA DE PAGO 💰

¿Cómo se pagará este movimiento?

Seleccione una opción:

1️⃣ Caja Menor
2️⃣ Sin Costo
3️⃣ Por Pagar

📝 Escriba el número de la opción (1, 2 o 3):
```

**Quick Replies (opcional):**
- 1
- 2  
- 3

---

## ✏️ PASO 2: Crear nodo "Wait for Response"

**Configuración:**
- Guardar resultado como: `estadopago_num`
- Tipo de espera: Mensaje de texto

**Crear 3 categorías (Split by):**

### Categoría 1: "Caja Menor"
- Condición: `has a number equal to 1`
- Nombre: "Caja Menor"

### Categoría 2: "Sin Costo"
- Condición: `has a number equal to 2`
- Nombre: "Sin Costo"

### Categoría 3: "Por Pagar"
- Condición: `has a number equal to 3`
- Nombre: "Por Pagar"

### Categoría 4: "Other" (error)
- Para cualquier otra respuesta

---

## ✏️ PASO 3: Crear 3 nodos intermedios "Set Run Result"

Cada categoría (1, 2, 3) debe ir a un nodo que guarde el valor en texto:

### Para categoría "Caja Menor" (opción 1):
- **Action:** Set Run Result
- **Name:** `estadopago`
- **Value:** `Caja Menor`
- **Conectar a:** Nodo del resumen (🎉 ¡Buen trabajo!...)

### Para categoría "Sin Costo" (opción 2):
- **Action:** Set Run Result
- **Name:** `estadopago`
- **Value:** `Sin Costo`
- **Conectar a:** Nodo del resumen

### Para categoría "Por Pagar" (opción 3):
- **Action:** Set Run Result
- **Name:** `estadopago`
- **Value:** `Por Pagar`
- **Conectar a:** Nodo del resumen

---

## ✏️ PASO 4: Crear nodo de error

Para la categoría "Other":

**Send Message:**
```
❌ Opción no válida. Por favor ingrese 1, 2 o 3.
```

**Conectar a:** Volver al nodo de la pregunta (💰 FORMA DE PAGO 💰)

---

## ✏️ PASO 5: Conectar el flujo

**Encontrar el nodo anterior** que calculaba el total:
- Busca el nodo que tiene: `Save result 'total'`
- Ese nodo actualmente apunta al resumen
- **Cambia su conexión** para que apunte a la nueva pregunta de Estado de Pago

**Flujo resultante:**
```
... (cálculo de total)
    ↓
💰 Pregunta Estado de Pago
    ↓
⏳ Espera respuesta (1, 2 o 3)
    ↓
💾 Guarda "Caja Menor" / "Sin Costo" / "Por Pagar"
    ↓
🎉 ¡Buen trabajo! (mensaje de resumen)
```

---

## ✏️ PASO 6: Actualizar mensaje de resumen

**Buscar el nodo:** "🎉 ¡Buen trabajo! Estamos listos..."

**Modificar el texto, agregar DESPUÉS de Observaciones:**

```
📝 Observaciones: @results.observaciones
💰 Estado de Pago: @results.estadopago

📊 TOTAL: @results.total Kg
```

---

## ✏️ PASO 7: Actualizar el Webhook POST

**Buscar el nodo:** Call Webhook (POST a Airtable/Kardex)

**En el Body (JSON), agregar DESPUÉS de "Observaciones":**

```json
"Observaciones": "@results.observaciones",
"EstadoPago": "@results.estadopago"
```

**El body completo debe verse así:**
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
        "Observaciones": "@results.observaciones",
        "EstadoPago": "@results.estadopago"
        @(if(results.id_acopio, ", \"CentrodeAcopio\": [\"" & results.id_acopio & "\"]", ""))
        @(if(results.id_gestor, ", \"gestor\": [\"" & results.id_gestor & "\"]", ""))
      }
    }
  ]
}
```

---

## ✅ CHECKLIST FINAL

- [ ] Nodo de pregunta creado con texto correcto
- [ ] Wait for Response configurado con 3 categorías + Other
- [ ] 3 nodos intermedios que guardan el valor en `@results.estadopago`
- [ ] Nodo de error para respuestas inválidas
- [ ] Conexión del flujo redirigida correctamente
- [ ] Mensaje de resumen actualizado
- [ ] Webhook POST actualizado con campo `EstadoPago`
- [ ] Probar el flujo completo

---

## 🧪 PRUEBA

Envía un mensaje al chatbot para probar:
1. Ingresa todos los datos del kardex
2. Verifica que aparezca la pregunta de Estado de Pago
3. Responde con 1, 2 o 3
4. Verifica que el resumen muestre el Estado de Pago
5. Confirma y verifica en Airtable que el campo `EstadoPago` se guardó correctamente

---

## 📞 SOPORTE

Si algo no funciona, revisar:
- Que todos los nodos estén conectados correctamente
- Que el nombre del resultado sea exactamente `estadopago` (minúsculas)
- Que el webhook tenga la sintaxis JSON correcta
