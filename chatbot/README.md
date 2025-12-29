# 🤖 Chatbot Management - Portal CampoLimpio

## 📋 Descripción General

Sistema de gestión de flujos de chatbot integrado con TextIt/RapidPro. Permite descargar, **modificar y actualizar** flujos de chatbot directamente desde el portal, facilitando la gestión de conversaciones automatizadas con coordinadores y gestores.

## 🎉 ¡DESCUBRIMIENTO MAYOR! (25 Dic 2024)

**¡SÍ ES POSIBLE EDITAR FLUJOS PROGRAMÁTICAMENTE!**

Después de extensas pruebas, descubrimos que:
- ❌ El formato API (`get_definitions`) NO funciona para import
- ✅ El formato "Organization Export" SÍ funciona
- ✅ Podemos hacer cambios masivos automatizados
- ✅ Los cambios se aplican correctamente en TextIt

**Ver**: `BREAKTHROUGH_EXITO.md` para detalles completos del descubrimiento.

---

## 🏗️ Arquitectura

### Plataforma Base
- **TextIt/RapidPro**: Plataforma de chatbot (https://textit.com)
- **API Version**: v2
- **Cliente Python**: `rapidpro-python` (oficial)

### Integración con Proyecto
- **Ubicación**: `/chatbot/` (directorio separado dentro del portal)
- **Lenguaje**: Python 3.12+
- **Entorno Virtual**: `/chatbot/venv/`

---

## 🔑 Autenticación

### API Token
```
Token: bfe6fe930e078ddfeac32f8ebccbf2428d0f43e0
API URL: https://textit.com/api/v2
```

**Archivo de configuración**: `chatbot/.env`
```env
TEXTIT_API_TOKEN=bfe6fe930e078ddfeac32f8ebccbf2428d0f43e0
TEXTIT_API_URL=https://textit.com/api/v2
```

⚠️ **Nota**: El token está guardado localmente. NO commitear a Git.

---

## 📦 Estructura de Archivos

```
chatbot/
├── venv/                          # Entorno virtual Python
├── flows/                         # Flujos descargados (JSON)
├── orgs_export_20251223.json      # Exportación completa (backup)
├── flow_manager.py                # Script principal de gestión
├── .env                           # Configuración (API token)
├── requirements.txt               # Dependencias Python
└── README_API.md                  # Documentación de API TextIt
```

---

## 🚀 Setup Inicial

### 1. Activar entorno virtual
```bash
cd chatbot
source venv/bin/activate
```

### 2. Instalar dependencias (si es necesario)
```bash
pip install rapidpro-python
```

### 3. Verificar conexión
```bash
python3 flow_manager.py list
```

---

## 🔧 Herramientas Disponibles

### 1. `flow_manager.py` - Gestión básica
- ✅ Listar flujos
- ✅ Descargar definiciones (formato API)
- ✅ Búsqueda de textos
- ⚠️ NO sirve para editar (formato incompatible)

### 2. `flow_editor.py` - ⭐ EDITOR FUNCIONAL ⭐
- ✅ Editar flujos de verdad
- ✅ Buscar y reemplazar texto
- ✅ Agregar emojis
- ✅ Cambios masivos automatizados
- ✅ **Funciona con imports de TextIt**

**Usa este para editar flujos!**

### `list` - Listar todos los flujos
```bash
python3 flow_manager.py list
```
**Salida**: Lista de flujos con UUID, tipo, estado archivado y ejecuciones completadas.

---

### `download` - Descargar un flujo
```bash
python3 flow_manager.py download <UUID>
```

**Ejemplo**:
```bash
python3 flow_manager.py download e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13
```

**Resultado**: 
- Descarga el flujo completo con todos sus nodos
- Guarda en `flows/Nombre_Flujo_UUID.json`
- JSON con definición completa del flujo

---

### `upload` - Subir/actualizar un flujo

⚠️ **IMPORTANTE**: La API de TextIt **NO permite subir flujos vía POST**. Solo permite descargarlos (GET).

**Para subir/actualizar flujos debes usar la interfaz web de TextIt**:

1. Ve a https://textit.com
2. Click en "Flows" → "Import"
3. Selecciona el archivo JSON
4. Click "Import"

El comando `upload` en el script está **deshabilitado** porque la API no lo soporta.

---

### `search` - Buscar texto en flujos locales
```bash
python3 flow_manager.py search "texto a buscar"
```

**Ejemplo**:
```bash
python3 flow_manager.py search "Registro Exitoso"
```

**Resultado**: Muestra archivos y nodos donde aparece el texto.

---

## 📊 Inventario de Flujos Activos

### Flujos Principales (No Archivados)

| # | Nombre | UUID | Ejecuciones | Descripción |
|---|--------|------|-------------|-------------|
| 1 | **30-Kardex Airtable** | `e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13` | 2,423 | Registro de Kardex principal |
| 2 | **31-Reversa Airtable** | `fd7a77c9-cbd3-4cf1-aa75-36fc53dcde13` | 715 | Reversa de movimientos |
| 3 | **08-menu-whatsapp** | `4d935f35-cde2-4406-b0cd-9b4f9d088435` | 8,832 | Menú principal WhatsApp |
| 4 | **09-Certificado v3** | `3a79f037-e62a-41e6-991a-effe00388c3c` | 35,557 | Generación de certificados |
| 5 | **16-Paginador** | `38f86dd7-028d-4586-ae8b-39b52a35cff0` | 43,231 | Sistema de paginación |
| 6 | **21-generador v3** | `2469b713-cc9f-4ce9-a2ce-1668fd88ecd1` | 34,891 | Registro de generadores |
| 7 | **22-notificador** | `2e2cf8b6-4658-469a-ae5e-15d910ad1c25` | 18,472 | Sistema de notificaciones |
| 8 | **10-Municipio** | `0aa6c066-fb2d-4948-bc37-ca5ed8cfc16c` | 47,780 | Búsqueda de municipios |
| 9 | **11-nuevousuario** | `3ab966c7-4916-45a4-ab6b-89cfd64762cb` | 5,570 | Registro nuevos usuarios |

**Total**: 83 flujos (31 activos, 52 archivados)

---

## 🔄 Flujo de Trabajo Típico

### Modificar un flujo de chatbot:

1. **Listar flujos disponibles**
   ```bash
   python3 flow_manager.py list
   ```

2. **Descargar el flujo a modificar**
   ```bash
   python3 flow_manager.py download e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13
   ```

3. **Editar el JSON localmente**
   - Abrir archivo en `flows/`
   - Modificar textos, acciones, rutas
   - Guardar cambios

4. **Probar búsqueda (opcional)**
   ```bash
   python3 flow_manager.py search "texto modificado"
   ```

5. **Subir flujo modificado vía Web** ⚠️
   - Ir a https://textit.com
   - Click en "Flows" → "Import"
   - Seleccionar el archivo modificado
   - Click "Import"
   - **Nota**: La API no permite POST, solo se puede por interfaz web

6. **Verificar en TextIt**
   - El flujo aparecerá actualizado
   - Probar enviando mensajes de prueba

---

## 📝 Estructura de un Flujo (JSON)

```json
{
  "name": "30-Kardex Airtable",
  "uuid": "e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13",
  "type": "messaging",
  "revision": 56,
  "spec_version": "14.3.0",
  "nodes": [
    {
      "uuid": "node-uuid",
      "actions": [
        {
          "type": "send_msg",
          "text": "Mensaje al usuario",
          "quick_replies": ["Opción 1", "Opción 2"],
          "uuid": "action-uuid"
        }
      ],
      "exits": [
        {
          "uuid": "exit-uuid",
          "destination_uuid": "next-node-uuid"
        }
      ],
      "router": {
        "type": "switch",
        "operand": "@input",
        "cases": [...],
        "categories": [...]
      }
    }
  ]
}
```

### Tipos de Acciones Comunes:
- `send_msg`: Enviar mensaje
- `set_run_result`: Guardar variable
- `call_webhook`: Llamar API externa (ej: Airtable)
- `set_contact_field`: Actualizar campo de contacto
- `add_contact_groups`: Agregar a grupo

---

## 🔗 Integración con Airtable

Los flujos de chatbot se conectan con Airtable para:

### Escribir datos:
- **Tabla Kardex**: Registros de movimientos (flujo 30-Kardex Airtable)
- **Tabla Coordinadores**: Datos de usuarios
- **Tabla MUNICIPIOS**: Búsqueda de municipios

### Ejemplo de webhook en flujo:
```json
{
  "type": "call_webhook",
  "method": "POST",
  "url": "https://api.airtable.com/v0/appniHwKiUMS0imXD/Kardex",
  "headers": {
    "Authorization": "Bearer @globals.apikey",
    "Content-Type": "application/json"
  },
  "body": "{\"records\": [...]}"
}
```

---

## 🎯 Casos de Uso

### 1. Cambiar mensajes de error
```bash
python3 flow_manager.py download <UUID>
# Editar texto en actions[].text
# Importar manualmente en TextIt web
```

### 2. Agregar nueva opción al menú
```bash
# Descargar flujo de menú
python3 flow_manager.py download 4d935f35-cde2-4406-b0cd-9b4f9d088435
# Agregar opción en quick_replies
# Importar manualmente en TextIt web
```

### 3. Modificar validaciones
- Editar `router.cases` para cambiar condiciones
- Cambiar `router.operand` para validar otro campo

### 4. Actualizar integración con Airtable
- Modificar `body` del webhook
- Cambiar campos enviados a Airtable

---

## 🚨 Precauciones

### ⚠️ IMPORTANTE

1. **La API NO permite subir flujos**
   - Solo se puede descargar (GET)
   - Para subir: usar interfaz web de TextIt
   - Esto es una limitación de la API oficial

2. **Siempre hacer backup antes de modificar**
   ```bash
   cp flows/archivo.json flows/archivo_backup_FECHA.json
   ```

3. **Probar en flujo de desarrollo primero**
   - No modificar flujos productivos directamente
   - Crear copia del flujo para testing

4. **Validar JSON antes de importar**
   ```bash
   python3 -m json.tool flows/archivo.json
   ```

5. **No modificar UUIDs**
   - Los UUIDs conectan nodos y acciones
   - Cambiarlos rompe el flujo

6. **Respetar spec_version**
   - Usar `spec_version: "14.3.0"` (versión actual)
   - Incluir `expire_after_minutes` (ej: 4320 = 3 días)
   - TextIt requiere formato exacto

---

## 🔮 Próximos Pasos

### Fase 1: Gestión Manual (ACTUAL) ✅
- ✅ Script Python funcional
- ✅ Descarga de flujos (GET)
- ⚠️ Subida solo vía web (API no permite POST)
- ✅ Búsqueda de textos
- ✅ Documentación completa
- ✅ Creación de flujos desde cero

### Fase 2: Interfaz Web (FUTURO)
- [ ] Página en portal: `/admin/chatbot`
- [ ] Listar flujos en tabla
- [ ] Descargar desde UI
- [ ] Editor visual de mensajes básicos
- [ ] Generador de JSON para importar
- [ ] Historial de versiones locales
- **Nota**: Upload seguirá siendo manual en TextIt (limitación API)

### Fase 3: Automatización (FUTURO)
- [ ] Sincronizar contactos Airtable → TextIt
- [ ] Envío de notificaciones automáticas
- [ ] Dashboards de analíticas de chatbot
- [ ] A/B testing de mensajes

---

## 📚 Recursos Externos

- **TextIt API Docs**: https://textit.com/api/v2/explorer/
- **RapidPro Python Client**: https://github.com/rapidpro/rapidpro-python
- **Flow Spec**: https://github.com/nyaruka/goflow/blob/master/flows/definition/flow.json

---

## 🆘 Troubleshooting

### Error: "403 Forbidden"
- Verificar que el API token sea correcto
- Regenerar token en TextIt si es necesario

### Error: "Flow not found"
- Verificar UUID correcto
- El flujo puede estar archivado

### Error: "Invalid flow definition"
- JSON mal formado
- Validar con `python3 -m json.tool`
- Verificar spec_version compatible

### Error al importar: "This file is no longer valid"
- Verificar que `spec_version` sea "14.3.0" (actual)
- Incluir campo `expire_after_minutes` (ej: 4320)
- Incluir campo `localization: {}`
- Verificar que todos los UUIDs sean únicos
- Ver flujo de referencia descargado para formato correcto

---

**Última actualización**: 25 de diciembre de 2024  
**Versión**: 1.0  
**Autor**: Leonardo Gutiérrez + Claude

---

## ⭐ FLUJO DE TRABAJO CORRECTO (¡Ahora Funciona!)

### Para Editar Flujos:

#### 1. Exportar desde TextIt Web
```
1. Ve a https://textit.com
2. Click en "Flows"
3. Selecciona el flujo → menú (⋮) → "Export"
4. Descarga el archivo (ej: kardex_export.json)
5. Muévelo a chatbot/
```

#### 2. Editar con el Script
```bash
cd chatbot

# Ver mensajes del flujo
python3 flow_editor.py list kardex_export.json

# Buscar y reemplazar
python3 flow_editor.py replace kardex_export.json "texto viejo" "texto nuevo"

# Agregar emoji
python3 flow_editor.py emoji kardex_export.json "✅"
```

#### 3. Re-importar en TextIt
```
1. Ve a https://textit.com → Flows → Import
2. Selecciona el archivo *_modified.json
3. Click "Import"
4. ✅ ¡Los cambios se aplican!
```

---

## 🆚 Diferencia Entre Formatos

### Formato API (flow_manager.py) - ❌ NO FUNCIONA PARA IMPORT
```json
{
  "name": "Kardex",
  "uuid": "...",
  "nodes": [...]
}
```

### Formato Org Export (flow_editor.py) - ✅ SÍ FUNCIONA
```json
{
  "version": "13",
  "site": "https://textit.com",
  "flows": [
    {
      "name": "Kardex",
      "uuid": "...",
      "nodes": [...]
    }
  ],
  "campaigns": [],
  "triggers": [],
  "fields": [],
  "groups": []
}
```

**Clave**: El wrapper con `version`, `site`, `flows[]` es esencial.

---

## 📝 Comandos de flow_editor.py

### list - Listar todos los mensajes
```bash
python3 flow_editor.py list export.json
```
**Output**: Lista todos los mensajes de todos los flujos en el export.

---

### replace - Buscar y reemplazar texto
```bash
python3 flow_editor.py replace export.json "Hola" "Buenos días"
```
**Output**: `export_modified.json` con los cambios aplicados.

---

### emoji - Agregar emoji a mensajes
```bash
python3 flow_editor.py emoji export.json "🎉"
```
**Output**: `export_with_emoji.json` con emoji al inicio de cada mensaje.

---

## 💡 Casos de Uso Reales

### 1. Actualizar URLs de webhook masivamente
```python
import json

with open('export.json') as f:
    data = json.load(f)

OLD_BASE = "appOLD123"
NEW_BASE = "appNEW456"

for flow in data['flows']:
    for node in flow['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'call_webhook':
                action['url'] = action['url'].replace(OLD_BASE, NEW_BASE)

with open('export_updated.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
```

### 2. Traducir flujos automáticamente
```python
from googletrans import Translator

translator = Translator()

for flow in data['flows']:
    for node in flow['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'send_msg':
                result = translator.translate(action['text'], src='es', dest='en')
                action['text'] = result.text
```

### 3. Agregar prefijos contextuales
```python
# Agregar nombre del flujo a cada mensaje
for flow in data['flows']:
    flow_name = flow['name']
    for node in flow['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'send_msg':
                action['text'] = f"[{flow_name}] {action['text']}"
```

---

## ⚠️ Precauciones Actualizadas

1. **Siempre exportar desde Web UI**
   - No uses archivos del API para editar
   - Solo archivos de "Export" funcionan

2. **Hacer backup antes de re-importar**
   ```bash
   cp export.json export_backup_$(date +%Y%m%d).json
   ```

3. **Probar en flujo de desarrollo primero**
   - No edites flujos productivos directamente
   - Crea copia del flujo para testing

4. **Validar JSON antes de importar**
   ```bash
   python3 -m json.tool export_modified.json > /dev/null && echo "✅ Válido"
   ```

5. **No cambiar UUIDs existentes**
   - Los UUIDs conectan nodos
   - Solo genera nuevos al duplicar flujos

---

## 🎯 Estado Actual del Proyecto

### ✅ Funcionalidades Confirmadas:
- Descargar flujos (API - solo lectura)
- **Editar flujos** (Org Export - ¡FUNCIONA!)
- Búsqueda de textos
- Backups automáticos
- Cambios masivos de texto
- Re-importación exitosa

### 📋 Pendiente:
- Interfaz web en el portal
- Diff visual de cambios
- Sistema de versionado
- Integración con git

---

## 📚 Archivos de Documentación

- `README.md` - Esta guía (general)
- `BREAKTHROUGH_EXITO.md` - Historia del descubrimiento exitoso
- `RAPIDPRO_PYTHON_GUIA.md` - Guía completa del API Python
- `IMPORTANTE_LIMITACIONES.md` - Limitaciones descubiertas
- `CONCLUSION_FINAL.md` - Primera conclusión (obsoleta - ahora SÍ funciona!)
- `README_API.md` - Referencia de endpoints de la API

---

**Última actualización**: 25 de diciembre de 2024 - 17:53  
**Estado**: ✅ EDICIÓN DE FLUJOS FUNCIONANDO  
**Método validado**: Organization Export → Modificar → Re-importar
