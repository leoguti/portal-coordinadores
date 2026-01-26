# Reunión con Coordinadores - 26 de Enero 2026

**Fecha**: 26 de enero de 2026
**Participantes**: Todos los coordinadores (usuarios del portal)

## Notas de la Reunión

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
- **✅ COMPLETADO**: Filtros implementados para coordinadores (Mes, Año, Municipio, Tipo)

### Correos - Gestores y Proveedores
- **Johan**: El correo debe llegar al gestor
- **Johan**: Falta agregar correo a los proveedores (aunque crees que sí está)
- **Acción**: Revisar flujo de correos a gestores y proveedores

### Problema con PDF de Orden de Servicio
- **Reporte**: En la vista de PDF no aparece en qué registro está
- **Reporte**: No abre el PDF de la orden de servicio
- **Reporte**: No aparece activado
- **Acción**: Revisar funcionalidad de generación/visualización de PDF de órdenes de servicio

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
- **✅ COMPLETADO**: Filtros completos implementados para coordinadores (año, mes, municipio, tipo)

### Problema con Kardex - Material No Suma
- **Queja**: El material no suma en el registro de kardex
- **Necesidad**: Confirmación de que el registro de kardex fue exitoso
- **Acción**: 
  1. Revisar por qué el material no se está sumando correctamente en kardex
  2. Implementar mensaje de confirmación exitosa para registro de kardex

### URGENTE: Visualización de Fotos de Báscula
- **Problema**: No permite visualizar las fotos de báscula después de subidas
- **Alcance**: En todo el sistema
- **Acción**: Revisar funcionalidad de visualización de fotos de báscula en Kardex

### Confirmación de Registro de Actividades
- **Necesidad**: Confirmación de que el registro de actividades fue exitoso
- **Acción**: Implementar mensaje de confirmación exitosa para registro de actividades

