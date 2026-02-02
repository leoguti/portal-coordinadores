# Testing automatizado con Telethon

Script que se conecta a Telegram como usuario y envía mensajes al bot para verificar flujos automáticamente.

## Prerequisitos

1. Python 3.12+
2. Credenciales de app Telegram (obtener en https://my.telegram.org):
   - `api_id`: `32763831`
   - `api_hash`: `e708870c7d10a56b9a95f70661ae9568`
3. Username del bot: `@campolimpiobot`

## Instalación

```bash
cd chatbot
python3 -m venv .venv
.venv/bin/pip install telethon
```

## Ejecución

```bash
cd chatbot

export TELEGRAM_API_ID="32763831"
export TELEGRAM_API_HASH="e708870c7d10a56b9a95f70661ae9568"
export TELEGRAM_BOT_USERNAME="@campolimpiobot"

.venv/bin/python test_bot.py
```

### Primera ejecución

La primera vez pedirá:

1. **Número de teléfono** (con código de país, ej: `+573001234567`)
2. **Código de verificación** que llega por Telegram o SMS

La sesión se guarda en `test_session.session`. Las siguientes ejecuciones no piden autenticación.

## Mensajes de prueba

El script envía los mensajes definidos en la lista `MESSAGES` dentro de `test_bot.py`:

```python
MESSAGES = [
    "salir",           # Resetear flujo activo
    "ks+01/01/2026",   # Consulta Kardex
]
```

Para cambiar los mensajes, editar esa lista directamente.

## Archivos

| Archivo | Descripción |
|---|---|
| `test_bot.py` | Script principal de prueba |
| `requirements.txt` | Dependencia: `telethon>=1.36.0` |
| `test_session.session` | Sesión de Telegram (se genera automáticamente, no commitear) |
