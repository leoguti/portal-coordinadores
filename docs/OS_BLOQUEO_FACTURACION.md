# Bloqueo de Órdenes de Servicio por facturación pendiente

**Fecha:** 2026-06-17
**Participantes:** Leonardo, Ángela (clienta), análisis Claude
**Estado:** Plan acordado (Camino B). Pendiente: decisiones finales con Ángela + decidir si se construye ya o se valida primero.

---

## 1. El problema (reportado por Ángela)

- Los coordinadores crean Órdenes de Servicio (OS) pero **son responsables también de monitorear su facturación**, y no cierran el ciclo: las órdenes quedan colgadas en estado `Enviada` por meses.
- La naturaleza de la OS es ser **la orden que dispara la facturación**.
- **Aclaración importante (Ángela):** NO hay facturas huérfanas. Lo que ocurre es que la OS se crea casi al tiempo que la factura — el procedimiento va "un poco al revés", pero el administrador exige que la OS exista y la crea el coordinador. Eso **no se puede ni se necesita cambiar**.
- **Propuesta de Ángela:** bloquear la generación de nuevas OS si el coordinador tiene OS sin resolver en facturación con más de **2 meses** de antigüedad, hasta que se resuelvan.

---

## 2. Cómo funciona hoy (estado del código)

### Ciclo de vida de la OS (`Estado` en tabla `Ordenes`)
```
Borrador → Enviada → Facturada → Pagada
                  ↘ Rechazada
```
- **Crea:** el coordinador, wizard de 4 pasos en `app/ordenes-servicio-v2/nueva`. En la práctica nace en `Enviada`.
- **Factura y paga:** acción **solo de Administrador** — `app/api/ordenes-servicio/[id]/route.ts` (PATCH `subir-factura` y `cambiar-estado`). El coordinador NO sube factura ni marca pagada.
- La factura del proveedor se adjunta en el campo `Factura` (attachment) de la orden, con `NumeroFactura`, `FechaFactura` e impuestos (IVA, ReteFuente, ReteICA, ReteIVA).

### Validaciones que YA existen al crear (`createOrdenServicio`, `lib/airtable.ts:944`)
1. Tercero beneficiario completo (RazonSocial, NIT, dirección, email, móvil, municipio).
2. Si Persona Natural: planilla de SS del mes con PDF.
3. Bloqueo por fecha ("regla de los 7 días"): no crear/editar/eliminar en meses cerrados.
4. No se permiten fechas futuras.
5. Cada Kardex "Por Pagar" → "En Orden" (relación estricta 1 Kardex = 1 Orden).

### Lo que NO existe hoy
Ninguna validación que mire el **historial de facturación pendiente** del coordinador. Cada orden se crea aislada.

### Archivos clave
| Archivo | Rol |
|---|---|
| `lib/airtable.ts:944` `createOrdenServicio` | Punto de enforcement (servidor) |
| `lib/airtable.ts` `getOrdenesCoordinador` | Trae órdenes del coordinador |
| `app/ordenes-servicio/page.tsx` | Lista de órdenes (UI semáforo) |
| `app/ordenes-servicio-v2/nueva/page.tsx` + `components/wizard-orden/*` | Wizard de creación |
| `app/api/ordenes-servicio/[id]/route.ts` | Facturación / cambio de estado (admin) |
| `docs/Orden de Servicio.md` | Reglas de negocio completas |

---

## 3. Caminos evaluados

- **A — Bloqueo duro** (propuesta de Ángela tal cual): bloquea de inmediato si hay pendientes > umbral. Simple y fuerte, pero alta fricción y puede castigar al coordinador por atascos de Bogotá.
- **B — Bloqueo escalonado (semáforo)** ✅ **ELEGIDO**: aviso amarillo + bloqueo rojo con dos umbrales. Más justo, educa, avisa antes de castigar.
- **C — Solo visibilidad + alertas, sin bloqueo**: cero fricción, pero si ya ignoran el pendiente puede no mover la aguja.
- **D — OS como canal obligatorio (contra facturas huérfanas)**: ❌ **DESCARTADO** — Ángela confirmó que no hay facturas huérfanas.

---

## 4. Decisiones tomadas (2026-06-17)

| Decisión | Valor |
|---|---|
| Camino | **B — semáforo escalonado + bloqueo** |
| "Sin resolver" = | Orden en estado **`Enviada` SIN adjunto en campo `Factura`** |
| NO cuentan | `Facturada`-sin-pagar (eso es atasco de tesorería, no del coordinador) |
| Antigüedad se mide desde | `Fecha de pedido` |
| 🟡 Amarillo (aviso) | **40 días** — banner de advertencia, aún puede crear |
| 🔴 Rojo (bloqueo) | **60 días / 2 meses** — bloquea crear nuevas OS |
| Responsable de resolver | El **coordinador hace seguimiento**; el Admin ejecuta la facturación |
| Liberación del bloqueo | Automática cuando la orden pasa a `Facturada` |
| Arranque / órdenes ya vencidas | **Bloqueo inmediato, SIN periodo de gracia** — al desplegar aplica a todas las órdenes existentes |

**Tensión asumida:** el coordinador no controla la facturación (es admin-only), pero el bloqueo lo presiona para que haga seguimiento. Aceptado por Ángela.

---

## 5. Plan de implementación (Camino B)

**No requiere cambios de esquema en Airtable.** Los datos ya existen.

1. **Helper de detección (compartido).** Función que, para un coordinador, mire sus órdenes `Enviada` sin adjunto en `Factura`, calcule antigüedad desde `Fecha de pedido` y clasifique cada una en verde / amarillo (≥40 d) / rojo (≥60 d). Devuelve también el conteo y el listado de `NumeroOrden` + fechas.

2. **Enforcement server-side** en `createOrdenServicio` (`lib/airtable.ts:944`), antes de crear: si hay ≥1 orden en rojo, lanza error con mensaje claro que lista los `NumeroOrden` y fechas a resolver. Mismo patrón que las validaciones de tercero/planilla SS (no se puede saltar desde el cliente).

3. **UI coordinador:**
   - Lista de órdenes (`app/ordenes-servicio/page.tsx`): badge de antigüedad 🟡/🔴 en las `Enviada` sin factura.
   - Botón "Nueva Orden" / wizard: deshabilitado en rojo (con listado de pendientes); banner de advertencia en amarillo.

4. **UI admin:** mismo semáforo por coordinador (el Admin es quien destraba moviendo a `Facturada`; debe ver a quién está bloqueando y por qué).

5. **Fase 2 (opcional):** alerta por WhatsApp/chatbot (canal ya existente) cuando una orden entra en amarillo.

---

## 6. Decisiones que faltan (para la conversación con Ángela)

1. ~~Arranque / órdenes ya vencidas~~ ✅ **RESUELTO (2026-06-17): bloqueo inmediato, sin periodo de gracia.** Al desplegar aplica a todas las órdenes existentes.
2. **Vista del admin:** ¿se construye el semáforo por coordinador para el admin en esta entrega o queda para después?
3. **Alertas WhatsApp (Fase 2):** ¿se incluyen o se posponen?
4. **¿Las órdenes en `Borrador` cuentan?** En la práctica nacen en `Enviada`, pero confirmar que solo `Enviada`-sin-factura dispara el semáforo.
5. **¿Construir ya o validar primero con Ángela?** (pendiente explícito)

---

## 7. Referencias
- `docs/Orden de Servicio.md` — reglas de negocio consolidadas de OS.
- `docs/AIRTABLE_SCHEMA.md` — esquema de tablas.
- `CLAUDE.md` — arquitectura general del portal.
- Memoria: `memory/project_os_bloqueo_facturacion.md`.
