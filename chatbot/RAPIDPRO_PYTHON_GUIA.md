# 📚 RapidPro Python Client - Guía Completa

## 🔍 ¿Qué es `rapidpro-python`?

**Cliente oficial de Python** para la API de RapidPro/TextIt desarrollado por **Nyaruka** (los creadores de RapidPro).

- **Versión instalada**: 2.21.0
- **Módulo principal**: `temba_client.v2.TembaClient`
- **Licencia**: BSD-4-Clause
- **Dependencias**: `requests`, `iso8601`

---

## 🏗️ Arquitectura

### Módulos principales:

```
temba_client/
├── base.py              # Clase base con lógica HTTP
├── exceptions.py        # Excepciones personalizadas
├── serialization.py     # Serialización de objetos
├── utils.py             # Utilidades
└── v2/
    ├── __init__.py      # TembaClient (cliente principal)
    └── types.py         # Tipos de datos (Contact, Flow, etc.)
```

### Clase Principal: `TembaClient`

```python
from temba_client.v2 import TembaClient

client = TembaClient('https://textit.com', 'YOUR_API_TOKEN')
```

---

## 📦 Tipos de Objetos Disponibles

La librería define 23 tipos de objetos:

1. **Archive** - Archivos de mensajes/runs
2. **Boundary** - Límites administrativos (geografía)
3. **Broadcast** - Mensajes masivos
4. **Campaign** - Campañas automatizadas
5. **CampaignEvent** - Eventos de campañas
6. **Channel** - Canales de comunicación
7. **Classifier** - Clasificadores de IA
8. **Contact** - Contactos/usuarios
9. **Export** - Exportaciones de datos
10. **Field** - Campos personalizados
11. **Flow** - Flujos de chatbot
12. **FlowStart** - Inicios de flujo
13. **Global** - Variables globales
14. **Group** - Grupos de contactos
15. **Label** - Etiquetas para mensajes
16. **Message** - Mensajes individuales
17. **Org** - Organización/cuenta
18. **Resthook** - Webhooks
19. **ResthookEvent** - Eventos de webhooks
20. **ResthookSubscriber** - Suscripciones a webhooks
21. **Run** - Ejecuciones de flujos

---

## 🔍 MÉTODOS GET (Lectura)

### 📊 Flujos
```python
# Listar todos los flujos
flows = client.get_flows().all()

# Filtrar por UUID
flow = client.get_flows(uuid='e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13').first()

# Filtrar por tipo
messaging_flows = client.get_flows(type='message').all()

# Filtrar archivados
active_flows = client.get_flows(archived=False).all()
```

### 📥 Definiciones de Flujos (JSON completo)
```python
# Descargar definición completa de un flujo
definitions = client.get_definitions(flows=['flow-uuid-1', 'flow-uuid-2'])

# Incluir dependencias (sub-flujos)
definitions = client.get_definitions(
    flows=['flow-uuid'], 
    dependencies=True
)
```

### 👥 Contactos
```python
# Listar todos los contactos
contacts = client.get_contacts().all()

# Por UUID
contact = client.get_contacts(uuid='contact-uuid').first()

# Por URN (número de teléfono)
contact = client.get_contacts(urn='tel:+573001234567').first()

# Por grupo
coordinadores = client.get_contacts(group='coordinadores-uuid').all()

# Contactos eliminados
deleted = client.get_contacts(deleted=True).all()

# Con paginación y fechas
recent = client.get_contacts(
    after='2024-01-01T00:00:00Z',
    before='2024-12-31T23:59:59Z'
).all()
```

### 📨 Mensajes
```python
# Listar mensajes
messages = client.get_messages().all()

# Por carpeta (inbox, flows, archived, outbox, sent, failed)
inbox = client.get_messages(folder='inbox').all()
sent = client.get_messages(folder='sent').all()

# Por fecha
recent_messages = client.get_messages(
    after='2024-12-01T00:00:00Z'
).all()

# Por UUID específico
msg = client.get_messages(uuid='message-uuid').first()
```

### 🏃 Ejecuciones de Flujos (Runs)
```python
# Todas las ejecuciones
runs = client.get_runs().all()

# Por flujo específico
kardex_runs = client.get_runs(flow='kardex-flow-uuid').all()

# Solo completadas
completed = client.get_runs(responded=True).all()

# Con rango de fechas
runs_dec = client.get_runs(
    after='2024-12-01T00:00:00Z',
    before='2024-12-31T23:59:59Z'
).all()

# Con rutas (paths) incluidas
detailed_runs = client.get_runs(paths=True).all()
```

### 👥 Grupos
```python
# Listar grupos
groups = client.get_groups().all()

# Por nombre
coordinadores = client.get_groups(name='Coordinadores').first()

# Por UUID
group = client.get_groups(uuid='group-uuid').first()
```

### 📋 Campos Personalizados
```python
# Todos los campos
fields = client.get_fields().all()

# Por key
airtable_id = client.get_fields(key='airtableid').first()
```

### 🌐 Variables Globales
```python
# Todas las variables
globals = client.get_globals().all()

# Por key específico
api_key = client.get_globals(key='apikey').first()
```

### 📢 Broadcasts (Difusiones)
```python
# Todos los broadcasts
broadcasts = client.get_broadcasts().all()

# Por UUID
broadcast = client.get_broadcasts(uuid='broadcast-uuid').first()

# Por fecha
recent = client.get_broadcasts(after='2024-12-01T00:00:00Z').all()
```

### 🏢 Información de la Organización
```python
# Info de tu cuenta
org = client.get_org()
print(org.name)
print(org.timezone)
print(org.credits.remaining)
```

### 📡 Canales
```python
# Todos los canales
channels = client.get_channels().all()

# Por dirección (número)
wa_channel = client.get_channels(address='+573001234567').first()
```

### 🎯 Campañas
```python
# Todas las campañas
campaigns = client.get_campaigns().all()

# Eventos de una campaña
events = client.get_campaign_events(campaign='campaign-uuid').all()
```

---

## ✏️ MÉTODOS CREATE (Crear)

### 📨 Enviar Mensaje
```python
# Enviar mensaje a un contacto
message = client.create_message(
    contact='contact-uuid',
    text='¡Hola! Este es un mensaje desde Python',
    attachments=[],  # URLs de archivos adjuntos
    quick_replies=['Opción 1', 'Opción 2']
)
```

### 📢 Crear Broadcast
```python
# Enviar mensaje masivo
broadcast = client.create_broadcast(
    text='Mensaje para todos',
    groups=['coordinadores-uuid'],  # A un grupo
    # O a contactos específicos:
    # contacts=['contact-uuid-1', 'contact-uuid-2'],
    # O a URNs:
    # urns=['tel:+573001234567']
)
```

### 🏃 Iniciar Flujo para Contactos
```python
# Iniciar un flujo para uno o más contactos
flow_start = client.create_flow_start(
    flow='flow-uuid',
    contacts=['contact-uuid-1', 'contact-uuid-2'],
    # O usar grupos:
    # groups=['group-uuid'],
    # O usar URNs:
    # urns=['tel:+573001234567'],
    restart_participants=False,  # Reiniciar si ya están en el flujo
    params={'variable': 'valor'}  # Variables iniciales
)
```

### 👤 Crear Contacto
```python
# Crear nuevo contacto
contact = client.create_contact(
    name='Juan Pérez',
    language='spa',
    urns=['tel:+573001234567', 'mailto:juan@example.com'],
    fields={'airtableid': 'rec123456'},  # Campos personalizados
    groups=['coordinadores-uuid']
)
```

### 👥 Crear Grupo
```python
# Crear nuevo grupo
group = client.create_group(name='Nuevos Coordinadores')
```

### 📋 Crear Campo Personalizado
```python
# Crear campo custom
field = client.create_field(
    name='Airtable ID',
    type='text'  # Opciones: text, number, datetime, state, district, ward
)
```

### 🌐 Crear Variable Global
```python
# Crear variable global
global_var = client.create_global(
    name='api_key',
    value='sk-12345'
)
```

### 🏷️ Crear Etiqueta
```python
# Crear etiqueta para mensajes
label = client.create_label(name='Importante')
```

### 🎯 Crear Campaña
```python
# Crear campaña
campaign = client.create_campaign(
    name='Seguimiento Coordinadores',
    group='coordinadores-uuid'
)

# Agregar evento a la campaña
event = client.create_campaign_event(
    campaign='campaign-uuid',
    relative_to='created_on',  # Campo de fecha de referencia
    offset=1,  # Días de diferencia
    unit='D',  # D=días, H=horas, M=minutos, W=semanas
    delivery_hour=9,  # Hora del día (0-23)
    flow='flow-uuid'  # Flujo a ejecutar
    # O mensaje directo:
    # message='Recordatorio de seguimiento'
)
```

---

## 🔄 MÉTODOS UPDATE (Actualizar)

### 👤 Actualizar Contacto
```python
# Actualizar datos de contacto
client.update_contact(
    contact='contact-uuid',
    name='Juan Carlos Pérez',
    language='eng',
    urns=['tel:+573009999999'],
    fields={'airtableid': 'recNEW123'},
    groups=['admin-uuid']  # Sobrescribe grupos
)
```

### 👥 Actualizar Grupo
```python
# Cambiar nombre del grupo
client.update_group(
    group='group-uuid',
    name='Coordinadores Activos'
)
```

### 📋 Actualizar Campo
```python
# Actualizar campo personalizado
client.update_field(
    field='field-uuid',
    name='ID Airtable',
    type='text'
)
```

### 🌐 Actualizar Variable Global
```python
# Actualizar valor de global
client.update_global(
    glbl='global-uuid',
    value='nuevo-valor'
)
```

---

## ❌ MÉTODOS DELETE (Eliminar)

```python
# Eliminar contacto
client.delete_contact('contact-uuid')

# Eliminar grupo
client.delete_group('group-uuid')

# Eliminar etiqueta
client.delete_label('label-uuid')

# Eliminar evento de campaña
client.delete_campaign_event('event-uuid')
```

---

## 🔢 MÉTODOS BULK (Operaciones Masivas)

### Agregar contactos a grupo
```python
client.bulk_add_contacts(
    contacts=['uuid-1', 'uuid-2', 'uuid-3'],
    group='coordinadores-uuid'
)
```

### Remover contactos de grupo
```python
client.bulk_remove_contacts(
    contacts=['uuid-1', 'uuid-2'],
    group='group-uuid'
)
```

### Bloquear contactos
```python
client.bulk_block_contacts(['uuid-1', 'uuid-2'])
```

### Desbloquear contactos
```python
client.bulk_unblock_contacts(['uuid-1', 'uuid-2'])
```

### Interrumpir flujos activos
```python
# Detiene todos los flujos activos de los contactos
client.bulk_interrupt_contacts(['uuid-1', 'uuid-2'])
```

---

## 🔄 Paginación

Todos los métodos `get_*` retornan un **query object iterable**:

```python
# Obtener TODOS (automáticamente pagina)
all_contacts = client.get_contacts().all()

# Obtener solo el primero
first = client.get_contacts().first()

# Iterar con límite
query = client.get_contacts()
for contact in query.iterfetches(max_records=100):
    print(contact.name)
```

---

## 🎯 Casos de Uso Prácticos

### 1. Sincronizar Coordinadores de Airtable a TextIt
```python
# Obtener coordinadores de Airtable (usando tu lib actual)
coordinadores = getCoordinadoresFromAirtable()

# Crear o actualizar en TextIt
for coord in coordinadores:
    # Buscar si existe por campo custom
    existing = client.get_contacts(
        fields={'airtableid': coord['id']}
    ).first()
    
    if existing:
        # Actualizar
        client.update_contact(
            contact=existing.uuid,
            name=coord['name'],
            urns=[f"tel:{coord['phone']}"]
        )
    else:
        # Crear
        client.create_contact(
            name=coord['name'],
            urns=[f"tel:{coord['phone']}"],
            fields={'airtableid': coord['id']},
            groups=['coordinadores-uuid']
        )
```

### 2. Notificar cuando se crea una orden
```python
def notify_order_created(order_id, coordinator_id):
    # Buscar coordinador en TextIt
    contact = client.get_contacts(
        fields={'airtableid': coordinator_id}
    ).first()
    
    if contact:
        # Enviar notificación
        client.create_message(
            contact=contact.uuid,
            text=f'✅ Tu orden #{order_id} ha sido creada exitosamente.'
        )
```

### 3. Iniciar flujo de seguimiento
```python
def start_followup_flow(coordinator_ids):
    # Buscar contactos
    contacts = []
    for coord_id in coordinator_ids:
        contact = client.get_contacts(
            fields={'airtableid': coord_id}
        ).first()
        if contact:
            contacts.append(contact.uuid)
    
    # Iniciar flujo
    client.create_flow_start(
        flow='followup-flow-uuid',
        contacts=contacts,
        params={'source': 'portal'}
    )
```

### 4. Backup diario de flujos
```python
import json
from datetime import datetime

def backup_all_flows():
    flows = client.get_flows(archived=False).all()
    
    for flow in flows:
        # Descargar definición
        definition = client.get_definitions(flows=[flow.uuid])
        
        # Guardar
        filename = f"backups/{flow.name}_{datetime.now().strftime('%Y%m%d')}.json"
        with open(filename, 'w') as f:
            json.dump(definition, f, indent=2)
```

### 5. Reportes de actividad
```python
def get_activity_report(date_from, date_to):
    # Mensajes enviados
    messages = client.get_messages(
        folder='sent',
        after=date_from,
        before=date_to
    ).all()
    
    # Runs completados
    runs = client.get_runs(
        responded=True,
        after=date_from,
        before=date_to
    ).all()
    
    return {
        'messages_sent': len(messages),
        'flows_completed': len(runs)
    }
```

---

## ⚠️ Limitaciones

### ❌ NO Disponible en la Librería:
- Crear/subir flujos nuevos (solo leer)
- Modificar flujos existentes
- Importar definiciones

### ✅ SÍ Disponible:
- Leer todo (flujos, contactos, mensajes, etc.)
- Crear contactos, grupos, mensajes
- Iniciar flujos
- Operaciones masivas

---

## 📚 Documentación Oficial

- **GitHub**: https://github.com/rapidpro/rapidpro-python
- **API Docs**: https://textit.com/api/v2/explorer/
- **RapidPro Docs**: https://rapidpro.io/

---

**Última actualización**: 25 de diciembre de 2024  
**Versión analizada**: rapidpro-python 2.21.0
