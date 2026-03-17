# Evaluaciones de Campo

**Estado**: En diseño

## Concepto

Digitalizar las evaluaciones que se realizan en actividades de campo, reemplazando el formulario de Google actual. Los participantes responden por WhatsApp escaneando un QR. Cada coordinador solo ve sus propias evaluaciones.

## Flujo propuesto

1. **Coordinador crea actividad** en el portal → registro en Airtable
2. **Se genera QR único** con deeplink de WhatsApp vinculado al ID de la actividad (ej: `wa.me/BOT?text=EVAL-ABC123`)
3. **Participantes en campo** escanean el QR → responden datos personales + 3 preguntas por WhatsApp (flujo TextIt)
4. **Respuestas se guardan** en Airtable vinculadas a la actividad y al coordinador
5. **En el portal** el coordinador ve: cantidad de evaluaciones, resumen de respuestas, opción de descarga

## Datos personales recolectados

1. Nombre
2. Documento de identidad
3. Departamento
4. Ciudad
5. Fecha

## Preguntas del quiz (respuesta múltiple A/B/C/D)

**P1. ¿Cómo se debe disponer los envases, empaques y embalajes que contuvieron plaguicidas?**
- a. Con el carro recolector de basura Municipal
- b. Con el reciclador formal del Municipio
- **c. Con un programa de manejo seguro y responsable de residuos posconsumo resolución 1675/2013** ✓
- d. Abandonar los envases en el cultivo después de la aplicación

**P2. ¿Cuáles son los riesgos que se generan con el mal manejo de estos envases?**
- a. Reutilización doméstica de los envases
- b. Arrojar los envases en las fuentes hídricas
- c. Venta ilegal de los envases y falsificación de productos agroquímicos
- **d. Todas las anteriores** ✓

**P3. ¿Para qué sirve el triple lavado en los envases de plaguicidas?**
- a. Permite economizar dinero porque aprovecha el 100% de la inversión en el producto
- b. Asegura que los envases puedan ser reciclados para transformación en madera plástica
- c. Porque el envase puede ser entregado a un programa posconsumo y puede recibir la certificación de devolución
- **d. Todas las anteriores** ✓

## Tabla "Evaluaciones" en Airtable (por definir)

Campos:
- Actividad (linked record)
- Coordinador (lookup)
- Nombre
- Documento
- Departamento
- Ciudad
- Fecha
- Respuesta P1 (A/B/C/D)
- Respuesta P2 (A/B/C/D)
- Respuesta P3 (A/B/C/D)
- Puntaje (0-3 correctas)
- Timestamp

## Decisiones tomadas

- ✅ WhatsApp bot: `+573234688397` (canal dialog360, UUID `f4a1bae0-4b8d-45db-8fbc-4235ff9a0709`)
- ✅ Se le dice al participante si acertó o no cada pregunta
- ✅ Preguntas fijas hardcodeadas en TextIt (cambian editando el flujo año a año)
- ✅ Flujo exclusivo para WhatsApp (no Telegram)
- ✅ Actividad se crea desde portal web o desde Telegram
- ✅ Fecha de actividad: mínimo hoy, máximo 7 días desde hoy
- ✅ QR expira: fecha de la actividad + 7 días

## Pendiente

- [ ] Crear tabla "Evaluaciones" en Airtable
- [ ] Crear endpoint webhook en portal (`POST /api/evaluaciones/webhook`)
- [ ] Crear flujo en TextIt con datos personales + 3 preguntas + retroalimentación
- [ ] Generar QR en la vista de actividad del coordinador
