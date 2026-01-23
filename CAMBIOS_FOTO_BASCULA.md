# 📸 Cambios Implementados - Foto de Báscula en Portal Web

**Fecha**: 23 de enero de 2026  
**Estado**: ✅ Implementado - Pendiente de pruebas

---

## 🎯 Objetivo

Permitir subir foto de báscula desde el portal web con las siguientes reglas:
- **SALIDA**: Foto **OBLIGATORIA**
- **ENTRADA**: Foto **OPCIONAL**

---

## 📝 Archivos Modificados

### 1. `/lib/airtable.ts` - Función `createKardex`

**Líneas modificadas**: 1624-1755

#### Cambios:
1. **Interface actualizado** - Agregado campo `fotoBascula`:
```typescript
fotoBascula?: { url: string; name: string }; // Photo from web upload
```

2. **Lógica de subida implementada** después de crear el registro:
   - Upload a Vercel Blob (storage temporal público)
   - Enviar URL a Airtable en campo `soportebascula`
   - Esperar 3 segundos (Airtable descarga la foto)
   - Eliminar de Vercel Blob

#### Formato enviado a Airtable:
```typescript
{
  fields: {
    soportebascula: [{ url: "https://vercel-blob-url.com/..." }]
  }
}
```

---

### 2. `/app/api/kardex/route.ts` - POST endpoint

**Líneas modificadas**: 137-151

#### Cambio:
Agregada línea para pasar foto al backend:
```typescript
const newKardex = await createKardex(session.user.coordinatorRecordId, {
  // ... otros campos
  fotoBascula: body.fotoBascula, // ⭐ NUEVO
});
```

---

### 3. `/components/KardexFormModal.tsx` - Frontend

**Estado**: ✅ Ya estaba implementado correctamente

- Línea 51: Estado `fotoBascula`
- Líneas 191-194: Validación obligatoria para SALIDAS
- Líneas 601-630: Componente `ImageUpload` con alertas diferenciadas
- Línea 222: Envío de foto al API

---

## 🔧 Estrategia Técnica

### Flujo de subida:

```
1. Usuario sube foto en navegador
   ↓
2. Frontend envía data URL en POST /api/kardex
   ↓
3. Backend crea registro Kardex en Airtable
   ↓
4. Si hay foto:
   - Fetch data URL → Buffer
   - Upload a Vercel Blob → URL pública
   - PATCH Airtable con URL
   - Esperar 3s (Airtable descarga)
   - Delete de Vercel Blob
   ↓
5. Retorna registro con foto en Airtable
```

### Por qué este método:
- ✅ Airtable NO acepta base64 directo (muy pesado)
- ✅ Airtable SÍ descarga archivos desde URLs públicas
- ✅ Vercel Blob es storage temporal ideal
- ✅ Patrón probado en Orden de Servicio (funciona perfecto)

---

## 🧪 Casos de Prueba

### Prueba 1: SALIDA con foto ✅
1. Crear movimiento tipo SALIDA
2. Intentar guardar sin foto → **Debe mostrar error**
3. Subir foto
4. Guardar
5. **Verificar**: Campo `soportebascula` en Airtable tiene la foto

### Prueba 2: ENTRADA con foto ✅
1. Crear movimiento tipo ENTRADA
2. Subir foto (opcional)
3. Guardar
4. **Verificar**: Campo `soportebascula` en Airtable tiene la foto

### Prueba 3: ENTRADA sin foto ✅
1. Crear movimiento tipo ENTRADA
2. NO subir foto
3. Guardar
4. **Verificar**: Registro creado sin error, campo `soportebascula` vacío

---

## 📋 Próximos Pasos

### Backend - Visualización:
- [ ] Agregar campo `soportebascula` a interface `KardexFields` si no existe
- [ ] Modificar página `/app/kardex/page.tsx` para mostrar la foto
- [ ] Agregar badge 📸 en tabla indicando si tiene foto
- [ ] Permitir ver/descargar foto en detalles expandidos

### Testing:
- [ ] Probar en desarrollo local
- [ ] Verificar token `BLOB_READ_WRITE_TOKEN` en Vercel (ya confirmado)
- [ ] Deploy a producción
- [ ] Pruebas end-to-end

---

## 🔑 Variables de Entorno Requeridas

### Vercel (Producción):
- ✅ `BLOB_READ_WRITE_TOKEN` - Ya configurado

### Local (Desarrollo):
- ⚠️ `BLOB_READ_WRITE_TOKEN` - Agregar a `.env.local` si se prueba localmente

---

## 📚 Documentación Adicional

- **`chatbot/ESTRATEGIA_SUBIDA_FOTOS_PORTAL.md`**: Estrategia completa documentada
- **`chatbot/INSTRUCCIONES_FOTO_BASCULA.md`**: Implementación en TextIt (chatbot)

---

## ✅ Reglas de Negocio Confirmadas

| Tipo Movimiento | Foto de Báscula | Validación |
|-----------------|-----------------|------------|
| **SALIDA** | OBLIGATORIA ✅ | Frontend bloquea submit sin foto |
| **ENTRADA** | OPCIONAL ⚪ | Permite guardar con o sin foto |

---

**Implementado por**: Leonardo Gutiérrez + Claude  
**Patrón basado en**: Orden de Servicio PDF upload (exitoso)
