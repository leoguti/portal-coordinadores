# 📘 Estructura Real de Flujos TextIt

## Análisis de Flujo Real: "04-inicio editor-verificador"

Basado en flujo descargado de producción con 7 nodos.

---

## 🏗️ Estructura Principal

```json
{
  "name": "Nombre del flujo",
  "uuid": "uuid-del-flujo",
  "spec_version": "14.3.0",
  "language": "spa",
  "type": "messaging",
  "revision": 68,
  "expire_after_minutes": 10080,
  "localization": {},
  
  "nodes": [
    // Array de nodos
  ],
  
  "_ui": {
    "nodes": {
      // Posiciones visuales de cada nodo
    },
    "stickies": {}  // Notas adhesivas en el editor
  }
}
```

---

## 📦 Tipos de Nodos

### 1. Nodo de Acción (`execute_actions`)
**Envía mensajes, guarda variables, llama webhooks**

```json
{
  "uuid": "unique-node-id",
  "actions": [
    {
      "type": "send_msg",
      "text": "Mensaje al usuario",
      "attachments": [],
      "quick_replies": ["Opción 1", "Opción 2"],
      "uuid": "unique-action-id"
    }
  ],
  "exits": [
    {
      "uuid": "unique-exit-id",
      "destination_uuid": "next-node-id"  // o null para finalizar
    }
  ]
}
```

**Tipos de acciones comunes:**
- `send_msg` - Enviar mensaje
- `set_run_result` - Guardar variable
- `call_webhook` - Llamar API externa
- `set_contact_field` - Actualizar campo de contacto
- `add_contact_groups` - Agregar a grupo
- `remove_contact_groups` - Remover de grupo

---

### 2. Nodo Router (`wait_for_response`)
**Espera respuesta del usuario y toma decisiones**

```json
{
  "uuid": "unique-node-id",
  "actions": [],  // Vacío en routers puros
  "router": {
    "type": "switch",
    "operand": "@input.text",  // Qué evaluar
    "result_name": "nombre_variable",  // Guardar resultado
    "default_category_uuid": "uuid-categoria-other",
    "wait": {
      "type": "msg"  // Esperar mensaje del usuario
    },
    "cases": [
      {
        "uuid": "unique-case-id",
        "type": "has_any_word",  // Tipo de evaluación
        "arguments": ["si", "sí", "ok"],  // Palabras a buscar
        "category_uuid": "uuid-categoria-si"
      }
    ],
    "categories": [
      {
        "uuid": "uuid-categoria-si",
        "name": "Si",
        "exit_uuid": "uuid-exit-si"
      },
      {
        "uuid": "uuid-categoria-other",
        "name": "Other",
        "exit_uuid": "uuid-exit-other"
      }
    ]
  },
  "exits": [
    {
      "uuid": "uuid-exit-si",
      "destination_uuid": "next-node-for-si"
    },
    {
      "uuid": "uuid-exit-other",
      "destination_uuid": "next-node-for-other"
    }
  ]
}
```

**Tipos de evaluación (`type`):**
- `has_any_word` - Contiene alguna palabra
- `has_all_words` - Contiene todas las palabras
- `has_phrase` - Contiene frase exacta
- `has_number` - Es un número
- `has_number_between` - Número en rango
- `has_date` - Es una fecha
- `has_email` - Es un email
- `has_phone` - Es un teléfono
- `has_group` - Usuario en grupo

---

### 3. Nodo de División por Grupo (`split_by_groups`)
**Divide el flujo según grupos del contacto**

```json
{
  "uuid": "unique-node-id",
  "actions": [],
  "router": {
    "type": "switch",
    "operand": "@contact.groups",
    "result_name": "grupo",
    "cases": [
      {
        "uuid": "unique-case-id",
        "type": "has_group",
        "arguments": [
          "group-uuid",
          "Nombre del Grupo"
        ],
        "category_uuid": "category-uuid"
      }
    ],
    "categories": [...]
  },
  "exits": [...]
}
```

---

### 4. Nodo de Sub-flujo (`split_by_subflow`)
**Llama a otro flujo y continúa**

```json
{
  "uuid": "unique-node-id",
  "router": {
    "type": "switch",
    "operand": "@child.run.status",
    "result_name": "subflow_result",
    "cases": [
      {
        "type": "has_only_text",
        "arguments": ["completed"],
        "category_uuid": "completed-category-uuid"
      }
    ]
  },
  "exits": [...]
}
```

---

## 🔗 UUIDs y Referencias

### Regla #1: Todos los UUIDs deben ser únicos
```python
import uuid
str(uuid.uuid4())  # Genera: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

### Regla #2: Las referencias deben coincidir

```
Node.exits[].uuid  →  Router.categories[].exit_uuid
Router.categories[].exit_uuid  →  Node.exits[].uuid
Node.exits[].destination_uuid  →  Otro Node.uuid
Router.cases[].category_uuid  →  Router.categories[].uuid
```

---

## 💡 Ejemplo Completo Funcional

```json
{
  "name": "Ejemplo Simple",
  "uuid": "flow-uuid",
  "spec_version": "14.3.0",
  "language": "spa",
  "type": "messaging",
  "revision": 1,
  "expire_after_minutes": 4320,
  "localization": {},
  
  "nodes": [
    {
      "uuid": "node-1",
      "actions": [
        {
          "type": "send_msg",
          "text": "¿Estás de acuerdo?",
          "quick_replies": ["Sí", "No"],
          "uuid": "action-1"
        }
      ],
      "exits": [
        {
          "uuid": "exit-1",
          "destination_uuid": "node-2"
        }
      ]
    },
    {
      "uuid": "node-2",
      "actions": [],
      "router": {
        "type": "switch",
        "operand": "@input.text",
        "result_name": "respuesta",
        "default_category_uuid": "cat-other",
        "wait": {"type": "msg"},
        "cases": [
          {
            "uuid": "case-si",
            "type": "has_any_word",
            "arguments": ["si", "sí"],
            "category_uuid": "cat-si"
          }
        ],
        "categories": [
          {
            "uuid": "cat-si",
            "name": "Si",
            "exit_uuid": "exit-si"
          },
          {
            "uuid": "cat-other",
            "name": "Other",
            "exit_uuid": "exit-other"
          }
        ]
      },
      "exits": [
        {
          "uuid": "exit-si",
          "destination_uuid": "node-3"
        },
        {
          "uuid": "exit-other",
          "destination_uuid": "node-4"
        }
      ]
    },
    {
      "uuid": "node-3",
      "actions": [
        {
          "type": "send_msg",
          "text": "¡Perfecto!",
          "uuid": "action-3"
        }
      ],
      "exits": [
        {
          "uuid": "exit-3",
          "destination_uuid": null
        }
      ]
    },
    {
      "uuid": "node-4",
      "actions": [
        {
          "type": "send_msg",
          "text": "Entiendo",
          "uuid": "action-4"
        }
      ],
      "exits": [
        {
          "uuid": "exit-4",
          "destination_uuid": null
        }
      ]
    }
  ],
  
  "_ui": {
    "nodes": {
      "node-1": {
        "position": {"left": 100, "top": 0},
        "type": "execute_actions"
      },
      "node-2": {
        "position": {"left": 100, "top": 200},
        "type": "wait_for_response"
      },
      "node-3": {
        "position": {"left": 0, "top": 400},
        "type": "execute_actions"
      },
      "node-4": {
        "position": {"left": 250, "top": 400},
        "type": "execute_actions"
      }
    },
    "stickies": {}
  }
}
```

---

## ⚠️ Errores Comunes

1. **UUIDs duplicados** - Genera uno nuevo para cada elemento
2. **Referencias rotas** - exit_uuid debe existir en exits[]
3. **category_uuid no existe** - Debe estar en categories[]
4. **destination_uuid incorrecto** - Debe apuntar a un node.uuid válido
5. **Falta wait en router** - Routers que esperan input necesitan wait.type

---

## 📚 Referencias

- **Spec**: https://github.com/nyaruka/goflow/blob/master/flows/definition/flow.json
- **Docs**: https://textit.com/docs/flows/
- **Examples**: Analizar flujos reales exportados

---

**Fuente**: Análisis de flujo real "04-inicio editor-verificador"  
**Fecha**: 25 de diciembre de 2024
