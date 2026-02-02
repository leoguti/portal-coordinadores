# Testing automatizado con Telethon

Script que se conecta a Telegram como usuario y envía mensajes al bot para verificar flujos del Kardex automáticamente.

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

.venv/bin/python test_bot.py <nombre_prueba>
```

### Primera ejecución

La primera vez pedirá:

1. **Numero de telefono** (con codigo de pais, ej: `+573001234567`)
2. **Codigo de verificacion** que llega por Telegram o SMS

La sesion se guarda en `test_session.session`. Las siguientes ejecuciones no piden autenticacion.

## Pruebas disponibles

### salida_con_ca
Salida de material desde un Centro de Acopio hacia un gestor.
```bash
.venv/bin/python test_bot.py salida_con_ca
```
Flujo: salir → ks+fecha → ca+materiales → seleccionar CA → seleccionar gestor → forma de pago → foto bascula → confirmar

### salida_con_mun
Salida de material desde un municipio (genera conciliacion automatica).
```bash
.venv/bin/python test_bot.py salida_con_mun
```
Flujo: salir → ks+fecha → municipio+materiales → confirmar municipio → seleccionar gestor → forma de pago → foto bascula → confirmar

### entrada
Entrada de material a un Centro de Acopio.
```bash
.venv/bin/python test_bot.py entrada
```
Flujo: salir → ke+fecha → municipio+materiales → confirmar municipio → seleccionar CA → forma de pago → foto bascula (opcional) → confirmar

## Configuracion de pasos

Los pasos de cada prueba se definen en el diccionario `TESTS` dentro de `test_bot.py`. Cada paso es:
- `{"text": "mensaje"}` para enviar texto
- `{"photo": "ruta/archivo.png"}` para enviar imagen

Para modificar valores (CA, gestor, municipio, cantidades), editar directamente los pasos en el script.

## Archivos

| Archivo | Descripcion |
|---|---|
| `test_bot.py` | Script principal de prueba |
| `requirements.txt` | Dependencia: `telethon>=1.36.0` |
| `test_session.session` | Sesion de Telegram (se genera automaticamente, no commitear) |
