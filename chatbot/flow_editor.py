#!/usr/bin/env python3
"""
TextIt Flow Editor - Editor de flujos que SÍ funciona
Usa el formato de Organization Export
"""

import json
import sys
import uuid as uuid_lib

def load_export(filename):
    """Carga un export de TextIt"""
    with open(filename, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_export(data, filename):
    """Guarda un export de TextIt"""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def replace_text(data, old_text, new_text):
    """Reemplaza texto en todos los mensajes de todos los flujos"""
    count = 0
    for flow in data['flows']:
        for node in flow['nodes']:
            for action in node.get('actions', []):
                if action['type'] == 'send_msg':
                    if old_text in action['text']:
                        action['text'] = action['text'].replace(old_text, new_text)
                        count += 1
                        print(f"  ✓ {flow['name']}: Cambiado")
    return count

def list_messages(data):
    """Lista todos los mensajes de todos los flujos"""
    print("\n📝 Mensajes en los flujos:\n")
    for flow in data['flows']:
        print(f"Flujo: {flow['name']}")
        for i, node in enumerate(flow['nodes']):
            for action in node.get('actions', []):
                if action['type'] == 'send_msg':
                    text = action['text']
                    preview = text[:60] + '...' if len(text) > 60 else text
                    print(f"  Nodo {i}: {preview}")
        print()

def add_emoji_to_messages(data, emoji):
    """Agrega un emoji al inicio de todos los mensajes"""
    count = 0
    for flow in data['flows']:
        for node in flow['nodes']:
            for action in node.get('actions', []):
                if action['type'] == 'send_msg':
                    if not action['text'].startswith(emoji):
                        action['text'] = f"{emoji} {action['text']}"
                        count += 1
    return count

def show_help():
    print("""
TextIt Flow Editor
==================

Comandos:
  list <file>                     - Lista todos los mensajes
  replace <file> <old> <new>      - Reemplaza texto
  emoji <file> <emoji>            - Agrega emoji a todos los mensajes
  
Ejemplos:
  python3 flow_editor.py list export.json
  python3 flow_editor.py replace export.json "Hola" "Buenos días"
  python3 flow_editor.py emoji export.json "👋"
""")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        show_help()
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'list' and len(sys.argv) >= 3:
        filename = sys.argv[2]
        data = load_export(filename)
        list_messages(data)
    
    elif command == 'replace' and len(sys.argv) >= 5:
        filename = sys.argv[2]
        old_text = sys.argv[3]
        new_text = sys.argv[4]
        
        data = load_export(filename)
        count = replace_text(data, old_text, new_text)
        
        output = filename.replace('.json', '_modified.json')
        save_export(data, output)
        
        print(f"\n✅ Reemplazados {count} mensajes")
        print(f"📁 Guardado en: {output}")
        print(f"🔄 Importa este archivo en TextIt")
    
    elif command == 'emoji' and len(sys.argv) >= 4:
        filename = sys.argv[2]
        emoji = sys.argv[3]
        
        data = load_export(filename)
        count = add_emoji_to_messages(data, emoji)
        
        output = filename.replace('.json', '_with_emoji.json')
        save_export(data, output)
        
        print(f"\n✅ Agregado {emoji} a {count} mensajes")
        print(f"📁 Guardado en: {output}")
    
    else:
        show_help()
