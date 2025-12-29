#!/usr/bin/env python3
"""
TextIt Flow Manager
Gestiona flujos de chatbot usando la API oficial de RapidPro
"""

import sys
import json
from temba_client.v2 import TembaClient

# Configuración
API_TOKEN = 'bfe6fe930e078ddfeac32f8ebccbf2428d0f43e0'
API_URL = 'https://textit.com'

# Cliente de la API
client = TembaClient(API_URL, API_TOKEN)

def list_flows():
    """Lista todos los flujos disponibles"""
    print("📋 Listando flujos...\n")
    
    flows = client.get_flows().all()
    
    for i, flow in enumerate(flows, 1):
        print(f"{i}. {flow.name}")
        print(f"   UUID: {flow.uuid}")
        print(f"   Tipo: {flow.type}")
        print(f"   Archivado: {'Sí' if flow.archived else 'No'}")
        print(f"   Ejecuciones completadas: {flow.runs.completed}")
        print()

def download_flow(uuid):
    """Descarga la definición completa de un flujo"""
    if not uuid:
        print("❌ Error: Debes proporcionar el UUID del flujo")
        print("Uso: python3 flow_manager.py download <UUID>")
        return
    
    print(f"📥 Descargando flujo {uuid}...")
    
    # Obtener definición del flujo
    definitions = client.get_definitions(flows=[uuid])
    
    if definitions.flows:
        flow_def = definitions.flows[0]
        filename = f"flows/{flow_def['name'].replace(' ', '_')}_{uuid[:8]}.json"
        
        # Crear directorio si no existe
        import os
        os.makedirs('flows', exist_ok=True)
        
        # Guardar JSON
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(flow_def, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Flujo guardado en: {filename}")
        print(f"   Nombre: {flow_def['name']}")
        print(f"   Nodos: {len(flow_def.get('nodes', []))}")
    else:
        print("❌ No se encontró el flujo")

def upload_flow(filepath):
    """Sube/actualiza un flujo desde un archivo JSON"""
    if not filepath:
        print("❌ Error: Debes proporcionar la ruta al archivo JSON")
        print("Uso: python3 flow_manager.py upload <archivo.json>")
        return
    
    print(f"📤 Subiendo flujo desde {filepath}...")
    
    try:
        import requests
        
        with open(filepath, 'r', encoding='utf-8') as f:
            flow_def = json.load(f)
        
        # Importar el flujo usando flow_definitions endpoint
        url = f"{API_URL}/api/v2/flow_definitions.json"
        headers = {
            'Authorization': f'Token {API_TOKEN}',
            'Content-Type': 'application/json'
        }
        
        # El payload debe ser un objeto con flows array
        payload = {
            'flows': [flow_def]
        }
        
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"✅ Flujo importado exitosamente")
            print(f"   Resultado: {result}")
        else:
            print(f"❌ Error al subir el flujo: HTTP {response.status_code}")
            print(f"   Respuesta: {response.text}")
        
    except Exception as e:
        print(f"❌ Error al subir el flujo: {e}")

def search_text(text):
    """Busca texto en flujos locales"""
    if not text:
        print("❌ Error: Debes proporcionar el texto a buscar")
        print("Uso: python3 flow_manager.py search <texto>")
        return
    
    print(f"🔍 Buscando '{text}' en flujos locales...\n")
    
    import os
    import glob
    
    if not os.path.exists('flows'):
        print("⚠️  No hay flujos descargados. Usa: python3 flow_manager.py download <UUID>")
        return
    
    found = 0
    for filepath in glob.glob('flows/*.json'):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if text.lower() in content.lower():
            found += 1
            print(f"📄 {os.path.basename(filepath)}")
            
            # Mostrar contexto
            flow = json.loads(content)
            for i, node in enumerate(flow.get('nodes', [])):
                for action in node.get('actions', []):
                    if 'text' in action and text.lower() in action['text'].lower():
                        preview = action['text'][:80] + "..." if len(action['text']) > 80 else action['text']
                        print(f"   Nodo {i}: \"{preview}\"")
            print()
    
    if found == 0:
        print("❌ No se encontraron coincidencias")
    else:
        print(f"✅ Encontrado en {found} archivo(s)")

def show_help():
    """Muestra la ayuda"""
    print("""
📚 TextIt Flow Manager - Comandos disponibles:

  list                    Lista todos los flujos disponibles
  download <UUID>         Descarga un flujo específico
  upload <archivo.json>   Sube/actualiza un flujo
  search <texto>          Busca texto en flujos locales
  help                    Muestra esta ayuda

Ejemplos:
  python3 flow_manager.py list
  python3 flow_manager.py download e3837ec8-d0c7-4e9b-a14a-6fdcc24e1e13
  python3 flow_manager.py upload flows/mi_flujo.json
  python3 flow_manager.py search "Registro Exitoso"
    """)

# Main
if __name__ == '__main__':
    commands = {
        'list': list_flows,
        'download': lambda: download_flow(sys.argv[2] if len(sys.argv) > 2 else None),
        'upload': lambda: upload_flow(sys.argv[2] if len(sys.argv) > 2 else None),
        'search': lambda: search_text(sys.argv[2] if len(sys.argv) > 2 else None),
        'help': show_help
    }
    
    command = sys.argv[1] if len(sys.argv) > 1 else 'help'
    
    if command in commands:
        commands[command]()
    else:
        print(f"❌ Comando desconocido: {command}")
        show_help()
