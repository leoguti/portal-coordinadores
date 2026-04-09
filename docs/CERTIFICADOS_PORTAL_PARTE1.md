# Certificados en Portal — Parte 1: Coordinador crea desde el portal

*Documento creado: 2026-04-09*

---

## Objetivo

Permitir que el coordinador genere un certificado de devolución de envases directamente desde el portal web, sin necesidad de usar el chatbot de Telegram. El resultado es el mismo: PDF generado, adjunto en Airtable, backup en R2 + Neon y email enviado.

---

## Contexto

El flujo actual (Telegram / TextIt "09-Certificado v3") tiene estos pasos:
1. Valida coordinador
2. Fecha de devolución
3. Cédula del generador → busca en `ubicaciones` → elige finca
4. Materiales (rígidos, flexibles, metálicos, embalaje)
5. Triple lavado
6. Lugar de devolución
7. Municipio de devolución (subflow "10-Municipio")
8. Observaciones
9. Confirmación → genera PDF → email

El portal replica exactamente este flujo en una página web.

---

## Endpoint existente

`POST /api/certificados/generar` — ya en producción, usado por TextIt.

**Auth:** Bearer `CERTIFICADOS_API_KEY` (variable de entorno).  
**Para el portal:** como el coordinador está autenticado con sesión NextAuth, se puede llamar el mismo endpoint internamente desde una Server Action o API route intermedia que añada el header de autorización, sin exponer la API key al cliente.

**Body que espera:**
```json
{
  "ubicacionId": "recXXXX",
  "coordinadorId": "recXXXX",
  "municipioDevolucionId": "recXXXX",
  "rigidos": 10,
  "flexibles": 5,
  "metalicos": 3,
  "embalaje": 2,
  "triplelavado": "SI",
  "lugardevolucion": "Bodega Municipal",
  "fechadevolucion": "2026-03-27",
  "observaciones": "texto opcional"
}
```

**Respuesta:**
```json
{
  "consecutivo": 12345,
  "pdfUrl": "https://...",
  "airtableId": "recXXXX"
}
```

---

## Flujo de la UI en el portal

### Paso 1 — Buscar generador por cédula
- Campo de texto para cédula del generador
- Botón "Buscar"
- Llama a `GET /api/certificados/generador?cedula=XXXXX`
- Si hay varias fincas → lista para seleccionar (nombre + dirección + municipio)
- Si no existe → mensaje de error (el registro debe existir en `ubicaciones`, no se crea desde aquí en la Parte 1)
- Muestra resumen del generador seleccionado: nombre, cédula, dirección, cultivo, municipio

### Paso 2 — Datos de devolución
- **Fecha de devolución** (date picker)
  - No puede ser futura
  - No más de 120 días de antigüedad
- **Rígidos** (número, kg)
- **Flexibles** (número, kg)
- **Metálicos** (número, kg)
- **Embalaje** (número, kg)
- **Triple lavado** (select: SI / NO / PENDIENTE)
- **Lugar de devolución** (texto libre, obligatorio)
- **Municipio de devolución** (componente `MunicipioSearch` existente)
- **Observaciones** (textarea, opcional)

### Paso 3 — Confirmación
- Resumen completo antes de generar
- Botón "Generar certificado"
- Loading mientras procesa (~5-10s)
- Resultado: número consecutivo + enlace al PDF

---

## Nuevo endpoint necesario

### `GET /api/certificados/generador?cedula=XXXXX`

Busca en tabla `ubicaciones` por `cedulagenerador`.

**Auth:** Sesión NextAuth (coordinador autenticado).

**Respuesta:**
```json
{
  "found": true,
  "ubicaciones": [
    {
      "id": "recXXXX",
      "nombre": "Juan Pérez",
      "cedula": "12345678",
      "direccion": "Vereda El Rosal",
      "municipio": "Villavicencio - Meta",
      "cultivo": "Arroz",
      "email": "juan@example.com",
      "movil": "3001234567"
    }
  ]
}
```

Si `ubicaciones` tiene más de un resultado → el coordinador selecciona cuál finca.

---

## Archivos a crear / modificar

| Archivo | Acción |
|---------|--------|
| `app/certificados/page.tsx` | Reemplazar placeholder con la UI completa |
| `app/api/certificados/generador/route.ts` | Nuevo endpoint búsqueda por cédula |

El `coordinadorId` se toma de `session.user.coordinatorRecordId` (ya disponible en sesión).

---

## Campos de Airtable usados (tabla `ubicaciones`)

| Campo Airtable | Uso |
|----------------|-----|
| `cedulagenerador` | Búsqueda por cédula |
| `nombregenerador` | Mostrar en UI y PDF |
| `direcciongenerador` | Mostrar en UI y PDF |
| `cultivogenerador` | Mostrar en UI y PDF |
| `municipiogenerador` | Mostrar en UI |
| `emailgenerador` | Para envío de email |
| `movilgenerador` | Para PDF |
| `tipogenerador` | Para PDF |
| `CODIGOMUN` | Link a municipio (para PDF) |

---

## Validaciones

- Cédula: solo números, obligatorio
- Fecha devolución: no futura, no más de 120 días atrás
- Al menos un material > 0 (no se puede generar certificado con todos en 0)
- Lugar de devolución: obligatorio
- Municipio de devolución: obligatorio (seleccionado del componente)

---

## Estado

- [ ] `GET /api/certificados/generador` — por construir
- [ ] `app/certificados/page.tsx` — UI completa por construir
- [ ] Pruebas end-to-end con generador real
