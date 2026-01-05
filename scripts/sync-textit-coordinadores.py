#!/usr/bin/env python3
"""
Script para sincronizar coordinadores de Airtable con contactos de TextIt
Actualiza los nombres en TextIt para que coincidan con los de Airtable

Requisitos:
- requests
- python-dotenv

Uso:
    python scripts/sync-textit-coordinadores.py [--dry-run]
"""

import os
import sys
import requests
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configuración
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID", "appniHwKiUMS0imXD")
TEXTIT_API_TOKEN = os.getenv("TEXTIT_API_TOKEN")
TEXTIT_API_URL = os.getenv("TEXTIT_API_URL", "https://textit.com/api/v2")

# Validar configuración
if not AIRTABLE_API_KEY:
    print("❌ Error: AIRTABLE_API_KEY no configurado en .env.local")
    sys.exit(1)

if not TEXTIT_API_TOKEN:
    print("❌ Error: TEXTIT_API_TOKEN no configurado")
    print("   Configúralo en .env.local o en chatbot/.env")
    sys.exit(1)


def get_coordinadores_airtable() -> List[Dict]:
    """
    Obtiene todos los coordinadores activos de Airtable
    Retorna: [{ id, name, email, rol }]
    """
    print("\n📥 Obteniendo coordinadores de Airtable...")
    
    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/Coordinadores"
    headers = {
        "Authorization": f"Bearer {AIRTABLE_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Filtrar solo activos (no Desactivado)
    params = {
        "filterByFormula": "NOT({Rol} = 'Desactivado')"
    }
    
    coordinadores = []
    
    try:
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        data = response.json()
        
        for record in data.get("records", []):
            fields = record.get("fields", {})
            coordinadores.append({
                "id": record["id"],
                "name": fields.get("Name", ""),
                "email": fields.get("Email", ""),
                "rol": fields.get("Rol", "Coordinador")
            })
        
        print(f"✅ {len(coordinadores)} coordinadores encontrados en Airtable")
        return coordinadores
        
    except Exception as e:
        print(f"❌ Error obteniendo coordinadores de Airtable: {e}")
        sys.exit(1)


def get_contacts_textit() -> List[Dict]:
    """
    Obtiene todos los contactos de TextIt que tienen campo airtableid
    Retorna: [{ uuid, name, fields: { airtableid } }]
    """
    print("\n📥 Obteniendo contactos de TextIt...")
    
    url = f"{TEXTIT_API_URL}/contacts.json"
    headers = {
        "Authorization": f"Token {TEXTIT_API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    contacts = []
    next_url = url
    
    try:
        while next_url:
            response = requests.get(next_url, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            # Filtrar solo contactos con airtableid
            for contact in data.get("results", []):
                fields = contact.get("fields", {})
                if "airtableid" in fields:
                    contacts.append({
                        "uuid": contact["uuid"],
                        "name": contact.get("name", ""),
                        "airtable_id": fields["airtableid"],
                        "urns": contact.get("urns", [])
                    })
            
            next_url = data.get("next")
        
        print(f"✅ {len(contacts)} contactos con airtableid encontrados en TextIt")
        return contacts
        
    except Exception as e:
        print(f"❌ Error obteniendo contactos de TextIt: {e}")
        sys.exit(1)


def update_contact_textit(uuid: str, name: str, dry_run: bool = False) -> bool:
    """
    Actualiza el nombre de un contacto en TextIt
    """
    if dry_run:
        print(f"   [DRY-RUN] Actualizaría contacto {uuid} a nombre: {name}")
        return True
    
    url = f"{TEXTIT_API_URL}/contacts.json?uuid={uuid}"
    headers = {
        "Authorization": f"Token {TEXTIT_API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "name": name
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"   ❌ Error actualizando contacto {uuid}: {e}")
        return False


def sync_coordinadores(dry_run: bool = False):
    """
    Sincroniza nombres de coordinadores de Airtable a TextIt
    """
    print("\n" + "="*60)
    print("🔄 SINCRONIZACIÓN AIRTABLE → TEXTIT")
    print("="*60)
    
    if dry_run:
        print("⚠️  MODO DRY-RUN: No se realizarán cambios reales")
    
    # 1. Obtener datos de ambas plataformas
    coordinadores_at = get_coordinadores_airtable()
    contactos_textit = get_contacts_textit()
    
    # 2. Crear mapa de Airtable ID → Nombre
    coordinadores_map = {c["id"]: c["name"] for c in coordinadores_at}
    
    # 3. Comparar y actualizar
    print("\n🔍 Comparando datos...")
    print("-" * 60)
    
    actualizados = 0
    sin_cambios = 0
    no_encontrados = 0
    
    for contact in contactos_textit:
        airtable_id = contact["airtable_id"]
        nombre_textit = contact["name"]
        uuid = contact["uuid"]
        
        # Buscar en Airtable
        nombre_airtable = coordinadores_map.get(airtable_id)
        
        if not nombre_airtable:
            print(f"⚠️  {nombre_textit} (ID: {airtable_id}) - No encontrado en Airtable")
            no_encontrados += 1
            continue
        
        # Comparar nombres
        if nombre_textit != nombre_airtable:
            print(f"🔄 {nombre_textit} → {nombre_airtable}")
            if update_contact_textit(uuid, nombre_airtable, dry_run):
                actualizados += 1
        else:
            sin_cambios += 1
    
    # 4. Resumen
    print("\n" + "="*60)
    print("📊 RESUMEN")
    print("="*60)
    print(f"✅ Actualizados: {actualizados}")
    print(f"⚪ Sin cambios: {sin_cambios}")
    print(f"⚠️  No encontrados en Airtable: {no_encontrados}")
    print(f"📊 Total procesados: {len(contactos_textit)}")
    
    if dry_run:
        print("\n💡 Ejecuta sin --dry-run para aplicar los cambios")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    sync_coordinadores(dry_run)
