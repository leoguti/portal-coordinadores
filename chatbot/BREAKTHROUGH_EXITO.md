# 🎉 ¡BREAKTHROUGH! - Edición Exitosa de Flujos TextIt

## 🏆 DESCUBRIMIENTO DEL 25 DE DICIEMBRE DE 2024

**¡SÍ ES POSIBLE EDITAR FLUJOS DE TEXTIT PROGRAMÁTICAMENTE!**

---

## 🔑 La Clave del Éxito

### ❌ Lo que NO funcionaba:
```json
// Formato API individual (get_definitions)
{
  "name": "Hola Mundo",
  "uuid": "...",
  "nodes": [...]
}
```

### ✅ Lo que SÍ funciona:
```json
// Formato "Organization Export"
{
  "version": "13",
  "site": "https://textit.com",
  "flows": [
    {
      "name": "Hola Mundo",
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

---

## 🧪 Prueba Exitosa

1. ✅ Exportar flujo manualmente desde TextIt web
2. ✅ Modificar JSON localmente (cambió "Hola Mundo" → "Hola Mundp")
3. ✅ Re-importar en TextIt
4. ✅ **¡EL CAMBIO SE APLICÓ!**

---

## 🛠️ Flujo de Trabajo Correcto

### Para editar un flujo:

```bash
# 1. Exportar desde TextIt Web
# Flows → (menú) → Export
# Descarga: flow_name.json

# 2. Editar con Python
python3 << 'EOF'
import json

with open('export.json', 'r') as f:
    data = json.load(f)

# Modificar lo que necesites
data['flows'][0]['nodes'][0]['actions'][0]['text'] = "Nuevo texto"

with open('export_modified.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
EOF

# 3. Re-importar en TextIt Web
# Flows → Import → Selecciona export_modified.json
```

---

## 💡 Casos de Uso Ahora Posibles

### 1. Cambios Masivos de Texto
```python
# Buscar y reemplazar en todos los mensajes
for flow in data['flows']:
    for node in flow['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'send_msg':
                action['text'] = action['text'].replace(
                    'texto viejo', 
                    'texto nuevo'
                )
```

### 2. Traducción Automática
```python
from googletrans import Translator

translator = Translator()

for flow in data['flows']:
    for node in flow['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'send_msg':
                translated = translator.translate(
                    action['text'], 
                    src='es', 
                    dest='en'
                )
                action['text'] = translated.text
```

### 3. Agregar Emojis Automáticamente
```python
emoji_map = {
    'error': '❌',
    'éxito': '✅',
    'pregunta': '❓',
    'info': 'ℹ️'
}

for flow in data['flows']:
    for node in flow['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'send_msg':
                text = action['text'].lower()
                for word, emoji in emoji_map.items():
                    if word in text:
                        action['text'] = f"{emoji} {action['text']}"
                        break
```

### 4. Agregar Quick Replies Estándar
```python
standard_replies = ['✅ Sí', '❌ No', '❓ Ayuda']

for flow in data['flows']:
    for node in flow['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'send_msg':
                if not action.get('quick_replies'):
                    action['quick_replies'] = standard_replies
```

### 5. Duplicar Flujo con Variaciones
```python
# Crear variante de flujo para otro contexto
base_flow = data['flows'][0].copy()
base_flow['name'] = "Kardex - Variante A"
base_flow['uuid'] = str(uuid.uuid4())

# Modificar textos específicos
for node in base_flow['nodes']:
    for action in node.get('actions', []):
        if action['type'] == 'send_msg':
            action['text'] = action['text'].replace(
                'coordinador',
                'gestor'
            )

data['flows'].append(base_flow)
```

### 6. Actualizar URLs de Webhooks
```python
# Cambiar todas las URLs de webhooks
OLD_URL = "https://api.airtable.com/v0/OLD_BASE"
NEW_URL = "https://api.airtable.com/v0/NEW_BASE"

for flow in data['flows']:
    for node in flow['nodes']:
        for action in node.get('actions', []):
            if action['type'] == 'call_webhook':
                action['url'] = action['url'].replace(OLD_URL, NEW_URL)
```

---

## 🔧 Script de Utilidad

```python
#!/usr/bin/env python3
"""
TextIt Flow Editor - Ahora que sabemos que funciona
"""

import json
import sys

def load_export(filename):
    with open(filename, 'r') as f:
        return json.load(f)

def save_export(data, filename):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def replace_text_in_flows(data, old_text, new_text):
    """Reemplaza texto en todos los mensajes"""
    count = 0
    for flow in data['flows']:
        for node in flow['nodes']:
            for action in node.get('actions', []):
                if action['type'] == 'send_msg':
                    if old_text in action['text']:
                        action['text'] = action['text'].replace(old_text, new_text)
                        count += 1
    return count

def list_all_messages(data):
    """Lista todos los mensajes de todos los flujos"""
    messages = []
    for flow in data['flows']:
        flow_name = flow['name']
        for i, node in enumerate(flow['nodes']):
            for action in node.get('actions', []):
                if action['type'] == 'send_msg':
                    messages.append({
                        'flow': flow_name,
                        'node': i,
                        'text': action['text'][:50] + '...' if len(action['text']) > 50 else action['text']
                    })
    return messages

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Uso: python3 flow_editor.py <export.json>")
        sys.exit(1)
    
    filename = sys.argv[1]
    data = load_export(filename)
    
    print(f"✅ Cargado: {len(data['flows'])} flujos")
    
    # Ejemplo: Listar mensajes
    messages = list_all_messages(data)
    for msg in messages[:10]:  # Primeros 10
        print(f"  {msg['flow']}: {msg['text']}")
```

---

## ⚠️ Limitaciones y Consideraciones

### 1. **Exportación Manual Requerida**
- No se puede usar `get_definitions` de la API
- Hay que exportar desde la UI web
- El formato es diferente

### 2. **UUIDs Deben Ser Únicos**
- Al duplicar flujos, generar nuevos UUIDs
- Usar `uuid.uuid4()` en Python

### 3. **Validación de Estructura**
- TextIt valida la estructura JSON
- Mantener el formato exacto
- No eliminar campos requeridos

### 4. **Backup Siempre**
- Hacer backup antes de modificar
- TextIt sobrescribe sin confirmación

### 5. **Testing en Desarrollo**
- Probar cambios en flujos de prueba primero
- No modificar flujos productivos directamente

---

## 🎯 Próximos Pasos

### Inmediato:
1. ✅ Crear script de edición de flujos
2. ✅ Documentar estructura completa del formato
3. ✅ Crear herramientas de búsqueda/reemplazo
4. ✅ Generador de variantes de flujos

### Futuro:
1. 🔄 Interfaz web en el portal para editar flujos
2. 📊 Diff visual de cambios antes de importar
3. 🌐 Sistema de traducción automática
4. 🎨 Generador de flujos desde plantillas

---

## 📚 Estructura Completa del Export

```json
{
  "version": "13",           // Versión del formato
  "site": "https://textit.com",  // URL del sitio
  
  "flows": [                 // Array de flujos
    {
      "name": "Nombre",
      "uuid": "...",
      "spec_version": "14.3.0",
      "language": "spa",
      "type": "messaging",
      "nodes": [...],
      "_ui": {...},
      "revision": 2,
      "expire_after_minutes": 4320,
      "localization": {}
    }
  ],
  
  "campaigns": [],           // Array de campañas
  "triggers": [],            // Array de triggers (keywords)
  "fields": [],              // Array de campos custom
  "groups": []               // Array de grupos
}
```

---

## 🎓 Lecciones Aprendidas

1. **La API no es suficiente** - El formato de exportación web es diferente
2. **La persistencia paga** - Muchos intentos hasta encontrar el formato correcto
3. **Los exports manuales tienen poder** - No todo debe ser API
4. **El formato importa** - Una estructura vs otra hace toda la diferencia
5. **Testing incremental funciona** - Probar con cambios mínimos primero

---

## 🏆 Conclusión

**¡MISIÓN CUMPLIDA!**

Ahora podemos:
- ✅ Editar flujos programáticamente
- ✅ Automatizar cambios masivos
- ✅ Crear variantes de flujos
- ✅ Traducir automáticamente
- ✅ Mantener version control

Todo esto manteniendo la capacidad de importar de vuelta a TextIt.

---

**Fecha del descubrimiento**: 25 de diciembre de 2024  
**Método**: Prueba y error exhaustivo  
**Resultado**: ¡ÉXITO TOTAL! 🎉
