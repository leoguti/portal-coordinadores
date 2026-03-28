# Depuración tabla `ubicaciones`

## Diagnóstico (2026-03-28)

**Total registros:** 12,253

### Problemas identificados

| Problema | Cantidad | Acción sugerida |
|----------|----------|-----------------|
| Sin nombre / cédula / móvil | ~47-48 | Revisar manualmente |
| Sin ningún certificado (nunca usados) | 1,784 | Revisar — posible basura |
| Móvil = `"0"` (dato inválido) | 740 | Limpiar — inutilizable para WhatsApp |
| Móvil `3107623699` repetido | 510 | Revisar — probablemente número de coordinador usado como default |
| Móvil `3122500713` repetido | 93 | Revisar |
| Móvil `8280422` repetido | 57 | Revisar — número fijo, no celular |

### Cédulas con muchas fincas (posibles empresas/cooperativas)

| Cédula | Fincas | Tipo probable |
|--------|--------|---------------|
| 830010738 | 63 | Empresa/cooperativa |
| 832001292 | 57 | Empresa/cooperativa |
| 901161983 | 43 | Empresa/cooperativa |
| 800059030 | 38 | Empresa/cooperativa |
| 800141506 | 36 | Empresa/cooperativa |

Estos NITs con 30-60+ fincas son probablemente empresas, no agricultores individuales. El flujo de WhatsApp con selección de finca puede ser problemático para ellos.

---

## Impacto en el flujo WhatsApp

La identificación del agricultor se hace por `telefonousuario` (lookup de `movilgenerador` con código 57). Los registros con `movilgenerador = "0"` o números repetidos falsos **no funcionarán** para autenticación.

**740 registros con móvil = "0"** son inutilizables para el bot.

---

## Pendiente decidir

- [ ] ¿Eliminar registros sin certificados? ¿O conservarlos (pueden ser nuevos agricultores)?
- [ ] ¿Qué hacer con móvil = "0"? ¿Eliminar el campo o el registro?
- [ ] ¿Los NITs con 50+ fincas entran al flujo de WhatsApp o se excluyen?
- [ ] Generar CSV de registros problemáticos para revisión del equipo

---

## Estado

- [ ] Pendiente decisión sobre reglas de limpieza
- [ ] Pendiente generación de reporte CSV para revisión
