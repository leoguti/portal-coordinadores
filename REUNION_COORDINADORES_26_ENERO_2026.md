# Reunión con Coordinadores - 26 de Enero 2026

**Fecha**: 26 de enero de 2026
**Participantes**: Todos los coordinadores (usuarios del portal)

## Notas de la Reunión

### Bug: Validación Municipio en SALIDAS desde Centro de Acopio
- **Problema**: Cuando se crea una SALIDA desde centro de acopio, el sistema exige municipio aunque el centro ya lo tiene asociado
- **Esperado**: Si origen = centro de acopio → NO debe pedir municipio (el centro ya lo tiene)
- **✅ SOLUCIONADO**: Corregida validación para no exigir municipio en SALIDAS desde centro de acopio

### Consecutivos
- **Pregunta**: ¿Los consecutivos son diferentes?
- **Respuesta (Angela)**: Son lo mismo

### Registro sin Costo en Orden de Servicio
- **Andrés**: Hay un registro que no tiene costo pero que está por relacionar en la orden de servicio
- **Acción**: Preguntarle a Andrés qué registro específico es
- **Andrea**: Está enviando el registro sin costo que aparece para meter en una orden
- **Pendiente**: Número de registro específico

### Problema de Fechas / Timezone
- **Reporte**: Los coordinadores se quejan que los datos de fecha pueden cambiar
- **Posible causa**: Problema de timezone (zona horaria)
- **Acción**: Investigar configuración de timezone en el sistema y Airtable

### Filtros
- **Angela**: Pregunta por los filtros
- **DECISIÓN TOMADA**: Hay que activarlos para coordinador
- **ACLARACIÓN**: Los filtros YA ESTÁN en la interfaz de administrador, pero NO están en la interfaz de coordinador
- **✅ COMPLETADO Y VERIFICADO**: Filtros implementados y funcionando correctamente para coordinadores (Mes, Año, Municipio, Tipo)

### Correos - Gestores y Proveedores
- **Johan**: El correo debe llegar al gestor
- **Johan**: Falta agregar correo a los proveedores (aunque crees que sí está)
- **Acción**: Revisar flujo de correos a gestores y proveedores

### Problema con PDF de Orden de Servicio
- **Reporte**: En la vista de PDF no aparece en qué registro está
- **Reporte**: No abre el PDF de la orden de servicio
- **Reporte**: No aparece activado
- **Problema adicional**: Al descargar, el archivo tiene nombre hash (ej: "2a5f0dfc") sin extensión .pdf
- **✅ SOLUCIONADO**: PDF funciona y se descarga correctamente
- **Limitación técnica**: El nombre del archivo es un hash de Airtable por políticas CORS del navegador
- **Solución acordada**: Los coordinadores renombran manualmente el archivo después de descargarlo

### TODO: Visualización de Órdenes de Servicio - Vista Administrador
- **Problema**: No están viendo órdenes de servicio en la visualización de administrador
- **Esperado**: Deberían verse las órdenes de servicio de TODOS los coordinadores
- **Acción**: Implementar/corregir vista de administrador para mostrar todas las órdenes de servicio

### Proveedores - Caso ATICA (Múltiples Sucursales)
- **María Paula**: Problema con ATICA - No todas las zonas tienen el mismo correo
- **Detalle**: Se envía a diferentes sucursales con el mismo NIT
- **Razón**: Es una empresa que tiene diferentes sucursales
- **Acción**: Revisar cómo manejar proveedores con mismo NIT pero diferentes correos por sucursal/zona

### Visibilidad de Estados - Post Pago
- **Pregunta**: Que el estado también sea conocido por los coordinadores después de pago y demás
- **Necesidad**: Los coordinadores quieren ver actualizaciones de estado después del proceso de pago
- **Específicamente**: Estados "Rechazada" y "Pagada" deben ser visibles para los coordinadores
- **Acción**: Implementar visibilidad de estados post-pago para coordinadores (incluir estados: Rechazada, Pagada)

### URGENTE: Problema con Carga de Fotos en Actividades
- **Andrés**: Las actividades no están recibiendo fotos
- **Acción**: Revisar funcionalidad de carga de fotos en el sistema
- **PRUEBA REALIZADA (26/01)**: Las imágenes SÍ se suben correctamente en pruebas
- **CONCLUSIÓN**: El código funciona bien. Posibles causas del problema reportado:
  - Problema específico del navegador/conexión de Andrés
  - Problema específico de actividades particulares
  - Confusión sobre dónde visualizar las fotos
- **ACCIÓN PENDIENTE**: Pedirle a Andrés que especifique qué actividad(es) no están recibiendo fotos para investigar

### Problema de Múltiples Sesiones Simultáneas
- **Reporte**: Hay usuarios que manejan dos zonas
- **Problema**: Al abrir dos clientes web (pestañas) se confunde la interfaz
- **Recomendación**: Solo trabajar un usuario a la vez - no es buena práctica tener múltiples sesiones simultáneas
- **DECISIÓN TOMADA**: El sistema debe permitir una sola sesión a la vez
- **Acción**: Implementar control de sesión única (bloquear sesiones múltiples)

### Filtro por Año - Vista Coordinador
- **Problema**: En el usuario de coordinador no aparece el filtro de año
- **Necesidad**: Quieren poder filtrar por año
- **ACLARACIÓN**: El filtro de año existe en vista administrador, falta en vista coordinador
- **✅ COMPLETADO Y VERIFICADO**: Filtros completos implementados y funcionando para coordinadores (año, mes, municipio, tipo)

### Problema con Kardex - Material No Suma
- **Queja**: El material no suma en el registro de kardex
- **Necesidad**: Confirmación de que el registro de kardex fue exitoso
- **Acción**: 
  1. Revisar por qué el material no se está sumando correctamente en kardex
  2. Implementar mensaje de confirmación exitosa para registro de kardex

### URGENTE: Visualización de Fotos de Báscula
- **Problema**: No permite visualizar las fotos de báscula después de subidas
- **Alcance**: En todo el sistema
- **✅ VERIFICADO**: Las fotos SÍ se visualizan correctamente
- **Aclaración para coordinadores**: Solo se pueden ver las fotos en los registros que tienen foto. Si un registro no tiene foto, no aparece nada (es el comportamiento esperado)

### Confirmación de Registro de Actividades
- **Necesidad**: Confirmación de que el registro de actividades fue exitoso
- **Acción**: Implementar mensaje de confirmación exitosa para registro de actividades

### Confirmación de Registro de Kardex
- **Necesidad**: Confirmación de que el registro de kardex fue exitoso
- **Necesidad**: Mostrar el consecutivo asignado
- **Necesidad**: Resumen de datos como en el bot
- **✅ COMPLETADO**: Modal de confirmación implementado con:
  - Consecutivo destacado del Kardex
  - Resumen completo: fecha, tipo de movimiento, materiales, totales
  - Estado de pago y gestor/centro según corresponda
  - Diseño similar a la experiencia del bot

