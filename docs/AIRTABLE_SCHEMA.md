# Airtable Schema - Campolimpia

## Base Information
- **Base ID**: `appniHwKiUMS0imXD`
- **Base URL**: `https://api.airtable.com/v0/appniHwKiUMS0imXD`

## Tables

### 1. Coordinadores

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `Name` | Text | Nombre del coordinador |
| `Email` | Email | Email del coordinador |
| `Certificados` | Link | Relación con certificados |
| `Kardex` | Link | Relación con kardex |
| `Actividades` | Link | Relación con actividades |

### 2. Actividades

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `Nombre de la Actividad` | Text | Título de la actividad |
| `Fecha` | Date | Fecha de realización |
| `Fotografias` | Attachment | Fotos de la actividad |
| `Municipio` | Link | Municipio donde se realizó |
| `mundep (from Municipio)` | Lookup | "Municipio - Departamento" |
| `Descripcion` | Long Text | Descripción detallada |
| `Tipo` | Select | Sensibilización/Capacitación/Taller |
| `Coordinador` | Link | Coordinador responsable |
| `Name (from Coordinador)` | Lookup | Nombre del coordinador |
| `Documentos Actividad` | Attachment | Documentos PDF/archivos |
| `Cantidad de Participantes` | Number | Número de asistentes |
| `Modalidad` | Multiple Select | Presencial/Virtual/Híbrida |
| `Consecutivo` | Number | Número consecutivo |
| `Cultivo` | Text | Tipo de cultivo (PALMA, CAFÉ, etc) |
| `Perfil de Asistentes` | Text | Tipo de participantes |
| `Departamento` | Multiple Select | Departamento(s) |
| `Creado por` | Created by | Usuario creador (auto) |
| `Fecha Creación` | Created time | Timestamp (auto) |

### 3. Municipios

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `mundep` | Text | "Municipio - Departamento" |
| (otros campos a definir) |

## Relaciones

```
Coordinadores (1) ──< (N) Actividades
                           │
                           └─< (N) Municipios
```

## API Authentication

```http
Authorization: Bearer {AIRTABLE_API_KEY}
Content-Type: application/json
```

## Example Endpoints

### Get All Coordinadores
```
GET https://api.airtable.com/v0/appniHwKiUMS0imXD/Coordinadores
```

### Get Actividades with Filter
```
GET https://api.airtable.com/v0/appniHwKiUMS0imXD/Actividades?filterByFormula=FIND('Juan', {Name (from Coordinador)})
```

### Create Activity
```
POST https://api.airtable.com/v0/appniHwKiUMS0imXD/Actividades
{
  "fields": {
    "Nombre de la Actividad": "Nueva sensibilización",
    "Fecha": "2025-12-20",
    "Coordinador": ["recXXXXXXXXXX"],
    "Tipo": "Sensibilización",
    "Cantidad de Participantes": 25
  }
}
```

## Important Notes

1. **Field Names**: Use brackets for spaces: `fields['Nombre de la Actividad']`
2. **Lookups**: Are arrays, use `?.[0]` to get first value
3. **Links**: Are arrays of record IDs: `["recXXXX"]`
4. **Attachments**: Arrays of objects with `id`, `url`, `filename`

---
Last updated: December 17, 2025
