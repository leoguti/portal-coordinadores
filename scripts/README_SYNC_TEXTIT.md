# 🔄 Sincronización Airtable ↔ TextIt

## Descripción

Script para sincronizar los nombres de coordinadores entre Airtable y TextIt.

### Problema que resuelve
- Los contactos en TextIt tienen un campo `airtable_id` que los vincula con registros de Airtable
- Los nombres pueden quedar desactualizados entre las dos plataformas
- Este script actualiza los nombres en TextIt para que coincidan con Airtable

## Requisitos

```bash
pip install requests python-dotenv
```

## Configuración

Asegúrate de tener configuradas estas variables en `.env.local`:

```env
# Airtable
AIRTABLE_API_KEY=tu-api-key
AIRTABLE_BASE_ID=appniHwKiUMS0imXD

# TextIt
TEXTIT_API_TOKEN=bfe6fe930e078ddfeac32f8ebccbf2428d0f43e0
TEXTIT_API_URL=https://textit.com/api/v2
```

## Uso

### 1. Modo prueba (dry-run) - SIN hacer cambios reales

```bash
cd /home/leonardo-gutierrez/portal-campolimpio
python scripts/sync-textit-coordinadores.py --dry-run
```

Esto te mostrará:
- ✅ Qué coordinadores se actualizarían
- ⚪ Cuáles ya están sincronizados
- ⚠️ Cuáles tienen `airtable_id` pero no se encuentran en Airtable

### 2. Aplicar cambios reales

```bash
python scripts/sync-textit-coordinadores.py
```

## Ejemplo de salida

```
============================================================
🔄 SINCRONIZACIÓN AIRTABLE → TEXTIT
============================================================

📥 Obteniendo coordinadores de Airtable...
✅ 12 coordinadores encontrados en Airtable

📥 Obteniendo contactos de TextIt...
✅ 15 contactos con airtable_id encontrados en TextIt

🔍 Comparando datos...
------------------------------------------------------------
🔄 Juan Perez → Juan Pérez García
🔄 Maria G → María Gómez
⚠️  Pedro Old (ID: recXXX) - No encontrado en Airtable

============================================================
📊 RESUMEN
============================================================
✅ Actualizados: 2
⚪ Sin cambios: 12
⚠️  No encontrados en Airtable: 1
📊 Total procesados: 15
```

## Lógica del script

1. **Obtiene coordinadores activos** de Airtable (excluye "Desactivado")
2. **Obtiene contactos de TextIt** que tienen campo `airtable_id`
3. **Compara nombres** entre ambas plataformas
4. **Actualiza en TextIt** los nombres que difieren
5. **Muestra resumen** de cambios realizados

## Campo de vinculación

El script usa el campo **`airtable_id`** en TextIt que debe contener el **Record ID** de Airtable (formato: `recXXXXXXXXXXXXXX`).

## Seguridad

- Solo actualiza el campo `name` en TextIt
- No modifica `airtable_id`, `urns` (teléfonos), ni otros campos
- Usa modo dry-run por defecto para verificar antes de aplicar

## Notas importantes

⚠️ **Coordinadores desactivados**: El script NO sincroniza coordinadores con rol "Desactivado" en Airtable.

⚠️ **Sin airtable_id**: Los contactos de TextIt que no tengan el campo `airtable_id` serán ignorados.

⚠️ **API Rate Limits**: TextIt tiene límites de peticiones. El script maneja paginación automáticamente.
