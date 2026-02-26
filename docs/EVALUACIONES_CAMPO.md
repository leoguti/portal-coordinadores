# Evaluaciones de Campo

**Estado**: Pendiente - esperando confirmación del cliente

## Concepto

Digitalizar las evaluaciones que se realizan en actividades de campo, reemplazando el formulario de Google actual. Cada coordinador solo ve sus propias evaluaciones.

## Flujo propuesto

1. **Coordinador crea actividad** (Telegram o plataforma) → registro en Airtable con estado "En curso"
2. **Se genera QR único** con deeplink de WhatsApp vinculado al ID de la actividad (ej: `wa.me/BOT?text=EVAL-ABC123`)
3. **Participantes en campo** escanean el QR → responden 3 preguntas por WhatsApp (flujo TextIt)
4. **Respuestas se guardan** en Airtable vinculadas a la actividad y al coordinador
5. **Coordinador completa** los datos de la actividad (fotos, participantes, etc.)
6. **En la plataforma** el coordinador ve: cantidad de evaluaciones, resumen de respuestas, opción de descarga

## Detalles técnicos

- **3 preguntas fijas** (mismas para todas las actividades) → un solo flujo de TextIt
- **Tabla "Evaluaciones" en Airtable**: Actividad (linked), respuestas, fecha, teléfono del evaluador
- Privacidad: cada coordinador solo accede a evaluaciones de sus actividades
- Considerar tiempo límite para el QR (24-48h post-actividad)

## Pendiente del cliente

- [ ] Las 3 preguntas exactas y tipo de respuesta (texto libre, escala 1-5, sí/no, etc.)
- [ ] Confirmar número de WhatsApp del bot de TextIt a usar
- [ ] Aprobación final del flujo propuesto
