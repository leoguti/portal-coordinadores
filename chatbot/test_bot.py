"""
Testing automatizado de bot Telegram con Telethon.

Uso:
  python test_bot.py salida_con_ca     # Salida desde Centro de Acopio
  python test_bot.py salida_con_mun    # Salida desde municipio (conciliación)
  python test_bot.py entrada           # Entrada desde municipio

La primera ejecución pedirá autenticación (código por SMS/Telegram).
Las siguientes reutilizan la sesión guardada en 'test_session.session'.
"""

import asyncio
import os
import sys

from telethon import TelegramClient

# ── Configuración ──────────────────────────────────────────────
API_ID = os.getenv("TELEGRAM_API_ID", "")
API_HASH = os.getenv("TELEGRAM_API_HASH", "")
BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "")

SESSION_NAME = "test_session"
TIMEOUT_SECONDS = 30

# ── Pruebas disponibles ───────────────────────────────────────
TESTS = {
    "salida_con_ca": [
        {"text": "salir"},
        {"text": "ks+01/01/2026"},
        {"text": "ca+222+0+0+0+0+0+0"},
        {"text": "51"},       # centro de acopio (P.R ALIAR)
        {"text": "311"},
        {"text": "2"},
        {"photo": "../public/logo-campolimpio-white.png"},
        {"text": "SI"},
    ],
    "salida_con_mun": [
        {"text": "salir"},
        {"text": "ks+01/01/2026"},
        {"text": "duitama+111+0+0+0+0+0+0"},
        {"text": "SI"},       # buscar municipio
        {"text": "Si"},       # confirmar Duitama - Boyacá
        {"text": "311"},      # gestor
        {"text": "2"},        # forma de pago
        {"photo": "../public/logo-campolimpio-white.png"},
        {"text": "SI"},       # confirmación final
    ],
    "entrada": [
        {"text": "salir"},
        {"text": "ke+01/01/2026"},
        {"text": "duitama+333+0+0+0+0+0+0"},
        {"text": "SI"},       # buscar municipio
        {"text": "51"},       # centro de acopio destino (P.R ALIAR)
        {"text": "2"},        # forma de pago: Sin Costo
        {"text": "Si"},       # sí enviar foto de báscula
        {"photo": "../public/logo-campolimpio-white.png"},
        {"text": "SI"},       # confirmación final
    ],
    "certificado": [
        {"text": "salir"},
        {"text": "C+13-02-2025"},
        {"text": "800019277+200+800+0+0+si+SORA+SORA"},
        {"text": "2"},
        {"text": "si"},
        {"text": "si"},
        {"text": "si"},
    ],
    "certificado_v4": [
        {"text": "salir"},
        {"text": "v4C+23/02/2026"},
        {"text": "800019277+200+800+0+0+si+SORA+SORA"},
        {"text": "2"},
        {"text": "si"},
        {"text": "si"},
        {"text": "si"},
    ],
}


def validate_config():
    missing = []
    if not API_ID:
        missing.append("TELEGRAM_API_ID")
    if not API_HASH:
        missing.append("TELEGRAM_API_HASH")
    if not BOT_USERNAME:
        missing.append("TELEGRAM_BOT_USERNAME")
    if missing:
        print("Error: faltan variables de entorno:")
        for var in missing:
            print(f"  - {var}")
        print("\nEjemplo:")
        print('  export TELEGRAM_API_ID="12345678"')
        print('  export TELEGRAM_API_HASH="abcdef1234567890abcdef1234567890"')
        print('  export TELEGRAM_BOT_USERNAME="@campolimpiobot"')
        sys.exit(1)


async def wait_for_response(client, last_msg_id, timeout=TIMEOUT_SECONDS):
    """Espera una respuesta del bot posterior a last_msg_id."""
    for _ in range(timeout):
        await asyncio.sleep(1)
        messages = await client.get_messages(BOT_USERNAME, limit=5)
        for msg in messages:
            if not msg.out and msg.id > last_msg_id:
                return msg
    return None


async def main():
    validate_config()

    # Seleccionar prueba
    test_name = sys.argv[1] if len(sys.argv) > 1 else None
    if test_name not in TESTS:
        print("Pruebas disponibles:")
        for name in TESTS:
            print(f"  python test_bot.py {name}")
        sys.exit(1)

    steps = TESTS[test_name]
    print(f"=== Ejecutando: {test_name} ({len(steps)} pasos) ===\n")

    client = TelegramClient(SESSION_NAME, int(API_ID), API_HASH)
    await client.start()

    me = await client.get_me()
    print(f"Autenticado como: {me.first_name} ({me.phone})\n")

    history = await client.get_messages(BOT_USERNAME, limit=1)
    last_id = history[0].id if history else 0

    for i, step in enumerate(steps, 1):
        if "text" in step:
            print(f"── Paso {i}: Enviando '{step['text']}' ──")
            await client.send_message(BOT_USERNAME, step["text"])
        elif "photo" in step:
            photo_path = step["photo"]
            print(f"── Paso {i}: Enviando foto '{photo_path}' ──")
            await client.send_file(BOT_USERNAME, photo_path)

        print(f"   Esperando respuesta (máx {TIMEOUT_SECONDS}s)...")
        response = await wait_for_response(client, last_id)

        if response:
            print(f"   Respuesta: {response.text}")
            if response.buttons:
                print("   Botones:")
                for row in response.buttons:
                    for btn in row:
                        print(f"     [{btn.text}]")
            last_id = response.id
            print()
        else:
            print(f"   Sin respuesta después de {TIMEOUT_SECONDS}s.\n")

        if i < len(steps):
            await asyncio.sleep(3)

    print(f"=== {test_name}: Prueba finalizada ===")
    await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
