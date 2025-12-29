# ⚠️ LIMITACIONES IMPORTANTES - TextIt Flow Import

## 🚫 NO SE PUEDEN CREAR FLUJOS NUEVOS DESDE JSON

### El Problema Descubierto:

Cuando intentas importar un flujo con un UUID inventado o que no existe en tu cuenta, TextIt devuelve:

```
"This file is no longer valid. Please export a new version and try again."
```

### ¿Por qué pasa esto?

TextIt **valida que el UUID del flujo exista en tu cuenta** antes de permitir la importación. 

**Comportamiento real**:
- ✅ **Flujo con UUID existente** → Se actualiza el contenido
- ❌ **Flujo con UUID inventado** → Error: "no longer valid"
- ❌ **Flujo sin UUID** → Error o se ignora

### 🎯 Conclusión:

**NO puedes crear flujos completamente nuevos desde JSON**. Solo puedes:

1. ✅ **Crear flujo vacío en TextIt web** (interfaz visual)
2. ✅ **Descargar su UUID real**
3. ✅ **Modificar el JSON localmente**
4. ✅ **Re-importar para actualizar**

---

## ✅ Flujo de Trabajo CORRECTO

### Para Crear Flujo Nuevo:

```bash
# 1. Crear flujo vacío en TextIt web
#    - Ve a https://textit.com
#    - Click "Create Flow"
#    - Ponle nombre: "Mi Flujo Nuevo"
#    - Guarda (aunque esté vacío)

# 2. Obtener su UUID
python3 flow_manager.py list
# Busca "Mi Flujo Nuevo" y copia su UUID

# 3. Descargar el flujo vacío
python3 flow_manager.py download <UUID-del-flujo-nuevo>

# 4. Modificar el JSON con tu lógica
# Edita flows/Mi_Flujo_Nuevo_<UUID>.json

# 5. Re-importar en TextIt web
# Flows → Import → Selecciona el archivo modificado
# ✅ Ahora sí funciona porque el UUID existe
```

### Para Modificar Flujo Existente:

```bash
# 1. Descargar
python3 flow_manager.py download <UUID-existente>

# 2. Modificar
# Edita el JSON

# 3. Re-importar en web
# Flows → Import → Selecciona archivo
```

---

## 💡 ¿Qué SÍ podemos automatizar?

Aunque no podemos crear flujos nuevos, **SÍ podemos hacer estas cosas útiles**:

### 1. Modificaciones masivas de texto
```bash
# Descargar flujo
python3 flow_manager.py download <UUID>

# Buscar y reemplazar en el JSON (script Python)
sed -i 's/texto viejo/texto nuevo/g' flows/archivo.json

# Re-importar en web
```

### 2. Búsqueda en todos los flujos
```bash
python3 flow_manager.py search "palabra clave"
# Te dice en qué flujos aparece
```

### 3. Backup automático
```bash
# Descargar TODOS los flujos activos
# Script que hace backup diario
```

### 4. Análisis de flujos
```bash
# Extraer métricas: cantidad de nodos, mensajes, etc.
# Generar reportes de complejidad
```

### 5. Generador de plantillas
```bash
# Dado un flujo base, generar variaciones
# Cambiar variables, textos, validaciones
# Genera JSON listo para importar en flujo existente
```

---

## 📋 Resumen de Capacidades

| Acción | API | Import JSON | Web UI |
|--------|-----|-------------|--------|
| Crear flujo nuevo | ❌ | ❌ | ✅ |
| Modificar flujo existente | ❌ | ✅ | ✅ |
| Descargar flujo | ✅ | N/A | ✅ |
| Listar flujos | ✅ | N/A | ✅ |
| Enviar mensajes | ✅ | N/A | ✅ |
| Iniciar flujos | ✅ | N/A | ✅ |
| Gestionar contactos | ✅ | N/A | ✅ |

---

## 🔍 Referencias

- **TextIt Docs**: https://textit.com/api/v2/explorer/
- **Flow Spec**: https://github.com/nyaruka/goflow/blob/master/flows/definition/flow.json
- **RapidPro Python**: https://github.com/rapidpro/rapidpro-python

---

**Fecha**: 25 de diciembre de 2024  
**Descubrimiento**: Validado con pruebas reales de importación
