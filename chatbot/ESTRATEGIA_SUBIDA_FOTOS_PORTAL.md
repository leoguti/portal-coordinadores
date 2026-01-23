# 📸 Estrategia para Subir Fotos de Báscula al Portal (Web)

## 🎯 Problema Resuelto en Orden de Servicio

Al implementar la subida de PDF para órdenes de servicio, enfrentamos el problema de **cómo subir archivos a Airtable desde el portal web**.

## ✅ Solución que FUNCIONA (Orden de Servicio)

**Archivo**: `/lib/airtable.ts` - Función `createOrdenServicio` (líneas 922-990)

### Estrategia en 3 pasos:

#### 1. Subir archivo a Vercel Blob (storage temporal)
```typescript
// Upload PDF to Vercel Blob
const { put, del } = await import("@vercel/blob");

const filename = `Orden_${ordenData.fields.NumeroOrden}.pdf`;
const blob = await put(filename, pdfBuffer, {
  access: "public",
  contentType: "application/pdf",
});

console.log(`PDF uploaded to Vercel Blob: ${blob.url}`);
```

**Resultado**: URL pública del archivo (ej: `https://vercel-blob.com/abc123.pdf`)

---

#### 2. Enviar URL a Airtable como attachment
```typescript
// Update Airtable with PDF URL
const pdfAttachment = [{ url: blob.url }];

const updateResponse = await fetch(`${ordenUrl}/${ordenData.id}`, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    fields: {
      PDF: pdfAttachment,
    },
  }),
});
```

**Formato crítico**: `[{ url: "https://..." }]`

---

#### 3. Esperar que Airtable descargue + eliminar de Vercel Blob
```typescript
// Wait for Airtable to download the file
await new Promise(resolve => setTimeout(resolve, 3000));

// Delete from Vercel Blob (Airtable has it now)
await del(blob.url);
console.log(`PDF deleted from Vercel Blob: ${filename}`);
```

**Por qué**: 
- Airtable descarga el archivo desde la URL pública
- Una vez descargado, lo aloja en sus propios servidores
- Podemos eliminar de Vercel Blob para no consumir storage

---

## 🚀 Aplicación para Fotos de Báscula

### Paso 1: Instalar @vercel/blob
```bash
npm install @vercel/blob
```

### Paso 2: Configurar variables de entorno
```env
BLOB_READ_WRITE_TOKEN=<token desde Vercel dashboard>
```

### Paso 3: Modificar función `createKardex` en `/lib/airtable.ts`

```typescript
export async function createKardex(
  coordinatorRecordId: string,
  kardexData: {
    // ... campos existentes
    fotoBascula?: { url: string; name: string }; // ⭐ NUEVO
  }
): Promise<AirtableRecord<KardexFields> | null> {
  // ... código existente de creación del kardex

  // Si hay foto, subirla después de crear el registro
  if (kardexData.fotoBascula && kardexRecord) {
    try {
      const { put, del } = await import("@vercel/blob");
      
      // 1. Subir foto a Vercel Blob
      const response = await fetch(kardexData.fotoBascula.url);
      const buffer = await response.arrayBuffer();
      
      const filename = `kardex_${kardexRecord.id}_${Date.now()}.jpg`;
      const blob = await put(filename, buffer, {
        access: "public",
        contentType: "image/jpeg",
      });
      
      console.log(`Foto uploaded to Vercel Blob: ${blob.url}`);
      
      // 2. Actualizar Airtable con la URL
      const fotoAttachment = [{ url: blob.url }];
      
      const updateResponse = await fetch(
        `https://api.airtable.com/v0/${baseId}/Kardex/${kardexRecord.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              soportebascula: fotoAttachment,
            },
          }),
        }
      );
      
      if (updateResponse.ok) {
        console.log(`Foto URL sent to Airtable for Kardex ${kardexRecord.id}`);
        
        // 3. Esperar y eliminar de Vercel Blob
        await new Promise(resolve => setTimeout(resolve, 3000));
        await del(blob.url);
        console.log(`Foto deleted from Vercel Blob: ${filename}`);
      } else {
        console.error("Failed to upload foto to Airtable");
        await del(blob.url); // Limpiar incluso si falla
      }
    } catch (fotoError) {
      console.error("Error uploading foto:", fotoError);
      // Continuar - el kardex ya fue creado
    }
  }
  
  return kardexRecord;
}
```

---

## 🔑 Puntos Clave

### ✅ Por qué funciona:
1. **Vercel Blob** es storage público temporal (como S3)
2. **Airtable descarga** el archivo desde la URL pública
3. Una vez descargado, **Airtable lo aloja** en sus servidores permanentemente
4. Eliminamos de Vercel Blob para **no consumir storage innecesariamente**

### ⚠️ Problemas que se evitan:
- ❌ **NO** enviar base64 directamente a Airtable (muy pesado, timeout)
- ❌ **NO** intentar upload directo multipart/form-data (API de Airtable no lo soporta bien)
- ❌ **NO** usar storage permanente (costo innecesario)

### 📝 Formato del attachment en Airtable:
```json
[{ "url": "https://public-url-here.com/file.jpg" }]
```

**Crítico**: 
- Debe ser un **array** de objetos
- Cada objeto tiene una propiedad `url`
- La URL debe ser **pública y accesible**

---

## 🎯 Diferencias con TextIt (Chatbot)

| Aspecto | TextIt (Chatbot) | Portal Web |
|---------|------------------|------------|
| **Origen foto** | Usuario envía por WhatsApp | Usuario sube desde navegador |
| **Storage inicial** | TextIt S3 (automático) | Vercel Blob (manual) |
| **URL disponible** | Inmediata (`@input.attachments`) | Después de upload a Blob |
| **Formato entrada** | `image/jpeg:https://dl-textit...` | Base64 o File object |
| **Limpieza prefijo** | Sí (`replace("image/jpeg:", "")`) | No necesario |
| **Storage intermedio** | No necesario (ya está en S3) | **Sí necesario** (Vercel Blob) |

---

## 📋 Checklist de Implementación

### Backend:
- [ ] Instalar `@vercel/blob`
- [ ] Configurar `BLOB_READ_WRITE_TOKEN` en `.env.local`
- [ ] Modificar interface de `createKardex` para aceptar `fotoBascula`
- [ ] Implementar lógica de upload a Vercel Blob → Airtable → Delete
- [ ] Manejar errores (continuar si falla la foto, el kardex ya existe)

### Frontend:
- [x] Ya implementado en `KardexFormModal.tsx`
- [ ] Asegurar que `ImageUpload` retorna URL/base64 válido
- [ ] Enviar `fotoBascula` en el body del POST a `/api/kardex`

### API Route:
- [ ] Recibir `fotoBascula` del body
- [ ] Pasar a función `createKardex`

### Visualización:
- [ ] Mostrar foto en la tabla de Kardex (badge "📸")
- [ ] Permitir ver/descargar foto en detalles expandidos

---

**Fecha de documentación**: 23 de enero de 2026  
**Basado en**: Implementación exitosa de PDF en Orden de Servicio  
**Próximo paso**: Implementar en `createKardex` siguiendo este patrón
