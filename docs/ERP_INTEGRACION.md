# Integración con ERP / Sistema Contable

Fecha: 2026-04-21
Autor: Leonardo + análisis Claude

## Contexto

Hoy el portal CampoLimpio gestiona operación (coordinadores, actividades, kardex, caja menor, órdenes de servicio, certificados) pero los datos **contables** (gastos aprobados, retenciones, IVA, movimientos) se pasan manualmente a un sistema contable muy básico.

Se está evaluando implementar un ERP (ej. Odoo) que se integre con el portal actual.

## Por qué tiene sentido

Lo que registra hoy el portal son **transacciones contables** que eventualmente deben reflejarse en:

- Libro diario / mayor
- Impuestos (IVA, retenciones en la fuente, ReteICA)
- Facturación electrónica DIAN
- Estados financieros
- Nómina electrónica

Replicar todo eso en el portal = reinventar la rueda. Un ERP ya lo resuelve y además cumple normativa colombiana.

## Opciones evaluadas para Colombia

| Herramienta | Costo aproximado | Pros | Contras |
|---|---|---|---|
| **Odoo Community** (self-hosted) | Solo VPS (~$20/mes) | Open source, API REST, localización CO (OCA/partners), muy completo, sin licencias recurrentes | DevOps propio, curva aprendizaje alta, localización CO varía por partner |
| **Odoo Online/Enterprise** | ~$30 USD/usuario/mes | Sin DevOps, soporte oficial, actualizaciones | Pagas por usuario activo, personalización limitada |
| **Siigo** (SaaS) | ~$50-200 USD/mes plan pyme | Muy popular en CO, facturación electrónica nativa DIAN, contadores lo conocen | API menos flexible, menos módulos que un ERP completo |
| **World Office** | Licencia única ~$1.5M COP + mantenimiento | Muy usado en CO, contadores lo conocen bien | API limitada, cliente-servidor tradicional |
| **Alegra** (SaaS) | ~$30-100 USD/mes | Fácil de usar, facturación electrónica, API REST decente | Menos profundo contablemente, pensado para pymes pequeñas |

## Recomendación inicial: Odoo Community self-hosted

### Por qué

1. **API REST/XML-RPC robusta** → integración directa con el portal Next.js actual
2. **Open source** → sin licencias recurrentes, ideal para fundación/NGO
3. **Localización Colombia** disponible vía OCA o partners (DIAN, retenciones, PUC)
4. **Módulos listos para lo que se necesita**:
   - Contabilidad (core)
   - Compras (órdenes de servicio ↔ purchase orders)
   - Inventario (kardex ↔ stock)
   - Gastos (caja menor ↔ hr_expense)
   - Terceros (vendors/customers)
   - Facturación electrónica (add-on de partner DIAN)

## Arquitectura propuesta

**No migrar el portal.** Mantenerlo como fuente de verdad operativa y que Odoo sea destino contable.

```
Portal (Next.js + Airtable)            Odoo (ERP)
─────────────────────                  ─────────
Coordinadores crean gastos        →    Journal entries / account.move
Kardex movimientos                →    Stock moves
Órdenes de servicio               →    Purchase orders
Terceros                          ↔    res.partner (bidireccional)
Legalizaciones mensuales          →    Expense reports consolidados
Certificados / facturas clientes  →    account.move (ventas)
```

### Sincronización

- Webhook Airtable → endpoint portal → crea/actualiza en Odoo
- Reconciliación mensual manual
- Retry queue para fallos

## Preguntas pendientes antes de decidir

1. **¿Cuántos usuarios** necesitarían acceso al ERP? (contabilidad, tesorería, auditoría externa)
2. **¿Facturación electrónica** la emiten hoy? ¿Con qué proveedor DIAN?
3. **¿Hay contador interno** que opera el sistema contable o es externo?
4. **Presupuesto** mensual disponible para el stack contable (servidor + soporte + partner localización)
5. **Migración histórica**: ¿cuántos años de datos contables hay que cargar al ERP nuevo?
6. **Cronograma**: ¿hay fechas duras (cierre fiscal, auditoría, etc.)?

## Plan de implementación sugerido (si se procede con Odoo)

### Fase 0 — Decisión y diseño (1-2 semanas)
- Responder las 6 preguntas anteriores
- Elegir partner/consultor de Odoo en Colombia para localización
- Documento de mapeo detallado: qué campo de Airtable → qué objeto/campo en Odoo

### Fase 1 — Entorno Odoo base (2-3 semanas)
- Levantar instancia Odoo (VPS o SaaS)
- Instalar módulos: Accounting, Purchase, Inventory, HR Expense, Contacts
- Instalar localización Colombia (OCA/partner)
- Configuración inicial: empresa, PUC, impuestos (IVA, retenciones), secuencias

### Fase 2 — Integración de datos maestros (2 semanas)
- Migrar Terceros → res.partner
- Migrar rubros → product.category / account.account
- Migrar coordinadores → hr.employee / res.partner
- Sincronización bidireccional de maestros

### Fase 3 — Sincronización transaccional (3-4 semanas)
- Gasto de caja menor aprobado → journal entry + hr.expense
- Orden de servicio → purchase.order
- Kardex movimiento → stock.move
- Tests de conciliación con data real

### Fase 4 — Facturación electrónica DIAN (2 semanas)
- Add-on de partner DIAN (Carvajal, FactorC, etc.)
- Pruebas en sandbox
- Salida a producción

### Fase 5 — Capacitación y go-live (1-2 semanas)
- Capacitación contadora/tesorería
- Piloto con 1 mes de datos reales
- Ajustes y cierre de mes

**Total estimado: 3-4 meses** para un go-live productivo.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Localización CO de Odoo inconsistente | Usar partner certificado colombiano desde el inicio |
| Dependencia de DevOps para self-hosted | Plan B: pagar Odoo Online si es viable |
| Reconciliación ambiente portal↔ERP se desincroniza | Diseño de idempotencia + logs + reportes de reconciliación |
| Rechazo por parte de contabilidad (cambio cultural) | Capacitación, involucrar contador desde Fase 0 |
| Retrocompatibilidad con datos históricos | Definir fecha de corte, no migrar todo, solo saldos iniciales |

## Alternativa simple (Plan B)

Si Odoo resulta muy ambicioso, el plan mínimo sería:

1. **Seguir con el sistema contable actual** + mejorar exportación desde el portal
2. Generar mensualmente archivos CSV/Excel desde el portal con formato exacto para ingreso masivo al contable actual
3. Automatizar lo más posible sin cambiar de ERP

Costo: bajo. Beneficio: reducción de trabajo manual, pero sin ganar en cumplimiento normativo ni reportería.

## Próximos pasos concretos

- [ ] Responder las 6 preguntas pendientes
- [ ] Entrevista con contador/a actual para entender pain points
- [ ] Cotizar 2-3 partners Odoo Colombia (incluye localización)
- [ ] Decidir: Odoo vs Siigo vs seguir actual
- [ ] Definir presupuesto y cronograma

## Referencias

- Odoo Colombia: https://www.odoo.com/es_ES/page/localizations
- OCA módulos LATAM: https://github.com/OCA/l10n-colombia
- DIAN facturación electrónica: https://www.dian.gov.co/impuestos/factura-electronica
