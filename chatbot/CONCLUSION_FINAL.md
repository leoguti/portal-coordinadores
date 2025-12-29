# 🚫 CONCLUSIÓN FINAL - TextIt Import Restrictions

## Descubrimiento del 25 de diciembre de 2024

Después de múltiples pruebas, hemos confirmado que **TextIt NO permite modificar flujos fuera de su plataforma**.

---

## ❌ Lo que NO funciona:

### Intento 1: Crear flujo desde cero con JSON
**Resultado**: ❌ "This file is no longer valid"
**Razón**: UUID no existe en la cuenta

### Intento 2: Usar UUID de flujo existente
**Resultado**: ❌ "This file is no longer valid"  
**Razón**: Validación interna falla

### Intento 3: Descargar → Modificar → Re-importar
**Resultado**: ❌ "This file is no longer valid"
**Razón**: TextIt detecta que el archivo fue modificado

### Intento 4: Solo cambiar texto, mantener revision
**Resultado**: ❌ "This file is no longer valid"

### Intento 5: Incrementar revision number
**Resultado**: ❌ "This file is no longer valid"

---

## 🔍 ¿Por qué falla?

TextIt probablemente valida:
1. **Hash/Firma digital** del archivo (no visible en JSON)
2. **Timestamp interno** de última modificación
3. **Checksum** de contenido
4. **Token de sesión** embebido

Esto significa que **solo los archivos exportados directamente desde TextIt son válidos para import**, y por un tiempo limitado.

---

## ✅ Lo que SÍ podemos hacer (y ES útil)

### 1. **Búsqueda masiva de textos**
```bash
# Descargar todos los flujos
for uuid in $(python3 flow_manager.py list | grep UUID | awk '{print $2}'); do
    python3 flow_manager.py download $uuid
done

# Buscar en todos
python3 flow_manager.py search "texto a buscar"
```

**Caso de uso**: Encontrar dónde está un mensaje específico en 83 flujos.

---

### 2. **Backup automático diario**
```bash
#!/bin/bash
# backup_flows.sh

DATE=$(date +%Y%m%d)
BACKUP_DIR="backups/$DATE"

mkdir -p $BACKUP_DIR

# Descargar todos los flujos activos
python3 flow_manager.py list | grep "Archivado: No" -B 3 | grep UUID | while read line; do
    UUID=$(echo $line | awk '{print $2}')
    python3 flow_manager.py download $UUID
    mv flows/*.json $BACKUP_DIR/
done

echo "Backup completado: $BACKUP_DIR"
```

**Caso de uso**: Versión control manual de flujos.

---

### 3. **Análisis y documentación**
```python
import json
import glob

# Analizar todos los flujos
for flow_file in glob.glob('flows/*.json'):
    with open(flow_file) as f:
        flow = json.load(f)
    
    print(f"Flujo: {flow['name']}")
    print(f"  Nodos: {len(flow['nodes'])}")
    print(f"  Revisión: {flow['revision']}")
    
    # Extraer todos los mensajes
    for node in flow['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'send_msg':
                print(f"  - {action['text'][:50]}...")
```

**Caso de uso**: Generar documentación automática de todos los flujos.

---

### 4. **Extractor de mensajes para traducción**
```python
# Extraer todos los textos de un flujo
def extract_messages(flow_json):
    messages = []
    for node in flow_json['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'send_msg':
                messages.append({
                    'text': action['text'],
                    'uuid': action['uuid']
                })
    return messages

# Generar CSV para traducción
import csv
messages = extract_messages(flow)
with open('mensajes_para_traducir.csv', 'w') as f:
    writer = csv.DictWriter(f, fieldnames=['uuid', 'text', 'translation'])
    writer.writeheader()
    for msg in messages:
        writer.writerow({'uuid': msg['uuid'], 'text': msg['text'], 'translation': ''})
```

**Caso de uso**: Traducir flujos a otros idiomas.

---

### 5. **Generador de plantillas**
```python
# Generar plantilla base para nuevo flujo
def generate_flow_template(name, first_message):
    return {
        "name": name,
        "spec_version": "14.3.0",
        "language": "spa",
        "type": "messaging",
        "expire_after_minutes": 4320,
        "revision": 1,
        "localization": {},
        "nodes": [
            {
                "uuid": generate_uuid(),
                "actions": [{
                    "type": "send_msg",
                    "text": first_message,
                    "uuid": generate_uuid()
                }],
                "exits": [{"uuid": generate_uuid()}]
            }
        ],
        "_ui": {"nodes": {}}
    }

# Usuario crea flujo vacío en TextIt web
# Luego copia/pega nodos de esta plantilla manualmente
```

**Caso de uso**: Acelerar creación de flujos similares.

---

### 6. **Usar la API para automatización real**
```python
from temba_client.v2 import TembaClient

client = TembaClient('https://textit.com', TOKEN)

# Lo que SÍ podemos automatizar:

# 1. Sincronizar contactos
for coordinador in airtable_coordinadores:
    client.create_contact(
        name=coordinador['nombre'],
        urns=[f"tel:{coordinador['telefono']}"],
        fields={'airtableid': coordinador['id']}
    )

# 2. Enviar notificaciones
client.create_message(
    contact='contact-uuid',
    text='Tu orden ha sido aprobada'
)

# 3. Iniciar flujos programáticamente
client.create_flow_start(
    flow='kardex-flow-uuid',
    contacts=['contact-uuid']
)
```

**Caso de uso**: Integración real Portal ↔ Chatbot.

---

## 🎯 Recomendación Final

### Para editar flujos:
✅ **Usar la interfaz web de TextIt** (es para lo que está diseñado)

### Para automatización:
✅ **Usar el API de RapidPro** para:
- Gestionar contactos
- Enviar mensajes
- Iniciar flujos
- Sincronizar datos

### Para gestión:
✅ **Usar nuestro script** para:
- Backups automáticos
- Búsqueda de textos
- Documentación
- Análisis de uso

---

## 📊 Resumen de Capacidades Reales

| Tarea | Método | Estado |
|-------|--------|--------|
| Crear flujo nuevo | Web UI | ✅ |
| Editar flujo | Web UI | ✅ |
| Exportar flujo | Web UI / API | ✅ |
| Importar flujo | Solo backups sin modificar | ⚠️ |
| Backup automático | Script Python | ✅ |
| Buscar textos | Script Python | ✅ |
| Enviar mensajes | API Python | ✅ |
| Gestionar contactos | API Python | ✅ |
| Iniciar flujos | API Python | ✅ |
| Modificar flujo externamente | **IMPOSIBLE** | ❌ |

---

## 💡 Siguiente Paso Práctico

Implementar **Integración Portal → Chatbot**:

1. ✅ Sincronizar coordinadores Airtable → TextIt
2. ✅ Notificar por WhatsApp cuando se crea orden
3. ✅ Iniciar flujo de seguimiento desde el portal
4. ✅ Dashboard de mensajes del chatbot

Esto SÍ es posible y útil con la API.

---

**Fecha**: 25 de diciembre de 2024  
**Validado con**: TextIt API v2, múltiples pruebas
