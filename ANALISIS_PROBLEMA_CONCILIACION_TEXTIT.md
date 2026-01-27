# Análisis: Problema con Variable de Conciliación en TextIt

**Fecha**: 27 de enero de 2026
**Problema**: La variable del segundo webhook (conciliación) no se puede acceder con la misma ruta que el primero

## 🔍 Diagnóstico

### Webhook #1 - SALIDA (funciona ✅)

**Request:**
```json
POST /v0/appniHwKiUMS0imXD/Kardex
{
  "records": [{
    "fields": {
      "TipoMovimiento": "SALIDA",
      "Reciclaje": 111,
      "gestor": ["recb90R2pVwpCKeA7"],
      "soportebascula": [{"url": "..."}]
    }
  }]
}
```

**Response:**
```json
{
  "records": [{
    "id": "reckEQdXvKCd9LB7l",
    "fields": {
      "idkardex": 22332,  ← Este valor SÍ se puede leer
      "Pre-ID": 2398,
      "TipoMovimiento": "SALIDA",
      ...
    }
  }]
}
```

**Variable que funciona:**
```
@run.results.webhook_response.extra.records.0.fields.idkardex
→ Devuelve: 22332 ✅
```

---

### Webhook #2 - ENTRADA de conciliación (NO funciona ❌)

**Request:**
```json
POST /v0/appniHwKiUMS0imXD/Kardex
{
  "records": [{
    "fields": {
      "TipoMovimiento": "ENTRADA",
      "Reciclaje": 111,
      "Observaciones": "Entrada automática de conciliación",
      "EstadoPago": "Sin Costo"
    }
  }]
}
```

**Response:**
```json
{
  "records": [{
    "id": "recUMHsjM4kCJ9i5N",
    "fields": {
      "idkardex": 22333,  ← Este valor NO se puede leer con la misma variable
      "Pre-ID": 2399,
      "TipoMovimiento": "ENTRADA",
      ...
    }
  }]
}
```

**Variable que NO funciona:**
```
@run.results.webhook_response.extra.records.0.fields.idkardex
→ Devuelve: null o error ❌
```

---

## 🎯 Causa Raíz

Cada webhook en TextIt guarda su resultado en una **variable diferente** definida por el campo `result_name`.

### Configuración de los webhooks:

**Webhook #1 (SALIDA):**
```json
{
  "type": "call_webhook",
  "method": "POST",
  "url": "https://api.airtable.com/v0/.../Kardex",
  "result_name": "webhook_response"  ← Guarda aquí
}
```
✅ **Acceso correcto:** `@run.results.webhook_response.extra.records.0.fields.idkardex`

---

**Webhook #2 (CONCILIACIÓN):**
```json
{
  "type": "call_webhook",
  "method": "POST",
  "url": "https://api.airtable.com/v0/.../Kardex",
  "result_name": "conciliacion"  ← Guarda en OTRA variable
}
```
❌ **Acceso incorrecto:** `@run.results.webhook_response.extra.records.0.fields.idkardex`
✅ **Acceso correcto:** `@run.results.conciliacion.extra.records.0.fields.idkardex`

---

## 💡 Solución

Usar la variable correcta para cada webhook:

### Para el webhook de SALIDA:
```
Consecutivo: @run.results.webhook_response.extra.records.0.fields.idkardex
ID Airtable: @run.results.webhook_response.extra.records.0.id
```

### Para el webhook de CONCILIACIÓN:
```
Consecutivo: @run.results.conciliacion.extra.records.0.fields.idkardex
ID Airtable: @run.results.conciliacion.extra.records.0.id
```

---

## 🔧 Cómo Verificar en TextIt

1. **Abrir el flujo** "30-Kardex Airtable"
2. **Encontrar el nodo** del segundo webhook (POST de conciliación)
3. **Verificar el campo `result_name`** en la configuración del webhook
4. **Usar ese nombre** para acceder a los datos:
   ```
   @run.results.[RESULT_NAME_AQUÍ].extra.records.0.fields.idkardex
   ```

---

## 📊 Comparación de Respuestas

| Campo | SALIDA (22332) | CONCILIACIÓN (22333) | Diferencia |
|-------|----------------|----------------------|------------|
| `id` | reckEQdXvKCd9LB7l | recUMHsjM4kCJ9i5N | ✅ Diferentes IDs |
| `idkardex` | 22332 | 22333 | ✅ Consecutivos |
| `Pre-ID` | 2398 | 2399 | ✅ Consecutivos |
| `TipoMovimiento` | SALIDA | ENTRADA | ✅ Diferentes |
| `Total` | -111 | 111 | ✅ Opuestos |
| `gestor` | Tiene | NO tiene | ✅ Solo SALIDA |
| `soportebascula` | Tiene | NO tiene | ✅ Solo SALIDA |
| `EstadoPago` | Por Pagar | Sin Costo | ✅ Diferentes |
| `Observaciones` | Vacío | "Entrada automática de conciliación" | ✅ Automático |

---

## 🎬 Flujo Correcto de Variables

```
1. Usuario completa formulario de SALIDA
   ↓
2. Call Webhook #1 (SALIDA)
   result_name: "webhook_response"
   ↓
3. Guardar en variable:
   id_salida = @run.results.webhook_response.extra.records.0.fields.idkardex
   ↓
4. Verificar: ¿Es SALIDA desde municipio?
   SI: continuar
   NO: terminar
   ↓
5. Call Webhook #2 (CONCILIACIÓN)
   result_name: "conciliacion"
   ↓
6. Guardar en variable:
   id_conciliacion = @run.results.conciliacion.extra.records.0.fields.idkardex
   ↓
7. Mostrar mensaje al usuario:
   "Se creó SALIDA #@results.id_salida
    y ENTRADA de conciliación #@results.id_conciliacion"
```

---

## 🐛 Error Común

**Intentar reutilizar la variable del primer webhook:**
```
❌ Consecutivo conciliación: @run.results.webhook_response.extra.records.0.fields.idkardex
```

Esto devuelve el consecutivo de la SALIDA (22332) en lugar del de la conciliación (22333).

**Solución: usar la variable correcta del segundo webhook:**
```
✅ Consecutivo conciliación: @run.results.conciliacion.extra.records.0.fields.idkardex
```

---

## 🔍 Debug en TextIt

Para verificar qué variables están disponibles, agregar un nodo de prueba:

```
Send Message:
📊 Debug Variables

SALIDA:
- ID: @run.results.webhook_response.extra.records.0.id
- Consecutivo: @run.results.webhook_response.extra.records.0.fields.idkardex

CONCILIACIÓN:
- ID: @run.results.conciliacion.extra.records.0.id
- Consecutivo: @run.results.conciliacion.extra.records.0.fields.idkardex
```

---

## 📝 Resumen

| Problema | El segundo webhook usa diferente `result_name` |
|----------|-----------------------------------------------|
| Causa | Cada webhook guarda en su propia variable |
| Solución | Usar `@run.results.conciliacion.*` para el segundo webhook |
| Verificar | Revisar campo `result_name` en configuración del webhook |

---

## ✅ Acción Inmediata

1. **Verificar** en el flujo TextIt cuál es el `result_name` del segundo webhook
2. **Actualizar** todas las referencias a usar la variable correcta
3. **Probar** creando una SALIDA desde municipio
4. **Confirmar** que ambos consecutivos se muestran correctamente

---

**Documentado por**: Claude + Leonardo  
**Fuente**: Logs de webhooks de TextIt  
**Estado**: Diagnóstico completo - pendiente de implementar fix
