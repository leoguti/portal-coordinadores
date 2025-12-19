# Reuniones y Requisitos del Cliente

## Notas de Reuniones

(Agrega aquí las notas de las reuniones)

Resumen preliminar del modelo de datos y necesidades de interfaz del Portal Campolimpio
Durante la reunión con Ángela (Campolimpio) se revisó el estado actual del sistema y las tablas que ya están estructuradas en Airtable. La organización ha decidido avanzar con la construcción del Portal de Campolimpio, un sistema web que permita gestionar actividades internas, trámites administrativos, certificados y procesos operativos a partir de la base de datos existente.
Si bien inicialmente se contempló desarrollar esta interfaz con Softr (SOFTR.io), se identificaron limitaciones para el desarrollo rápido y la integración con herramientas modernas como GitHub Copilot, así como la necesidad de mayor flexibilidad para incorporar lógica personalizada y procesos automatizados.

 Por esta razón, se está evaluando una alternativa que mantenga Airtable como base de datos, pero permita una construcción más ágil, expansible y adaptable a los flujos propios de Campolimpio.

1. Tablas existentes en Airtable
La base actual contiene múltiples tablas organizadas por función. A continuación se presenta un inventario con énfasis en aquellas que requieren interfaz en el portal:
1.1 Tablas operativas principales (requieren interfaz en el portal)
• Usuarios
Usuarios que interactúan con el sistema principalmente por WhatsApp.


Base para autenticación, permisos y trazabilidad.


• Actividades  (si en portal) 
Tabla prioritaria.


Registro de actividades diarias/operativas de Campolimpia.


Debe contar con una interfaz clara para consulta, creación, actualización y asignación.


• Coordinadores (
Personas responsables de supervisar actividades y procesos.


Necesitan un módulo específico donde puedan ver sus tareas, pendientes y reportes asociados.
Esta tabla maneja los permisos 
Caso Andrea - tendria varios usuarios 
Oscar - tiene varios usuarios 
Se ha pensado en tener zonas por aparte de coordinadores, pero hay que evaluarlo 
En este momento seria la base de la autenticacion -- se revisa 
• Certificados ( si en portal) 
Base de los certificados emitidos dentro del programa.
La interfaz ya es en chatbot… solo es visualizacion separada por usuario 
• KARDEX
Visualizacion de Registro de movimientos logísticos
Necesita una vista estructurada para consultas . solo se visualiza 


• Órdenes de Servicio (nueva tabla)
En proceso de creación.



1.2 Tablas administrativas y de soporte
Estas tablas complementan el flujo principal:
Municipios — catálogo de municipios atendidos.


Ubicaciones — puntos o sitios específicos dentro de los municipios.


Terceros — proveedores, aliados o entidades externas.


Puntos Logísticos — registros de comunicación o alertas operativas.


Licencias — permisos o licencias relacionadas con los procesos.


Convenios — acuerdos con entidades externas.


Catalogo Servicios — catálogo de ítems o servicios utilizados en órdenes y actividades.


2. Prioridades del Portal
La reunión concluyó que las primeras interfaces a desarrollar son:
Actividades


Coordinadores


Certificados


KARDEX


Órdenes de Servicio


Módulo general de Usuarios (para autenticación y permisos)


El portal debe permitir que cada usuario vea únicamente los registros asociados a él, dependiendo de su rol (coordinador, operador, auditor, etc.).

3. Requisito clave técnico
La solución debe:
Conectarse directamente a Airtable,
Permitir desarrollo rápido,
Ser compatible con VSCode, GitHub y Copilot,
Ofrecer flexibilidad para lógica personalizada que Softr no permite.


