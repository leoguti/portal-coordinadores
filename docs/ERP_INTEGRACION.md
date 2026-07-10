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

---

# ADDENDUM — Investigación Odoo Community en Colombia (2026-04-21)

## Casos reales y ecosistema colombiano

### Partners colombianos trabajando Community
- Odoo lista **29 partners certificados en Colombia** (7 Gold, 5 Silver, 17 Ready)
- La mayoría vende Enterprise (mayor comisión). Community es minoritario
- **ConsultoresOdooColombia** confirma explícitamente que trabaja Community ("suficiente para muchas pymes")
- Gold Partners relevantes: Pragmatic (Medellín), ODONE, PETI, Sinova, Progsum, DOOIT, MI ERP
- Freelancers/boutiques más flexibles con Community: Backendevs, GarKeM, Navegasoft

### Localización OCA l10n-colombia
Repo activo (commits abril 2026, rama 18.0). Solo 4 módulos:
- `l10n_co_currency_rate_update` (TRM Superfinanciera)
- `l10n_co_electronic_invoice` + `_self` (factura electrónica DIAN, conexión directa)
- `l10n_co_withholding_advance` (retenciones anticipadas)

**PUC oficial** viene con el módulo `l10n_co` de Odoo (no OCA). Retenciones/IVA/ICA cubiertos entre l10n_co + OCA. Medios magnéticos los cobran partners aparte.

### Facturación electrónica DIAN — 3 rutas en Community
1. **Odoo 18 conexión directa DIAN "Software Propio"** (gratis, desde v18). Requiere certificado digital ONAC + registro DIAN + módulo `l10n_co_dian`
2. **Jorels SAS** (LGPL, gratis, v12–19 Community): la opción comunitaria más madura. Incluye POS, nómina electrónica. jorels.com/edi
3. **Proveedores pagos**: Carvajal (doc oficial Odoo), Cadena, The Factory HKA. Pago por transacción.

### Casos públicos de ONGs colombianas
**No se encontraron casos públicos verificables** de ONGs colombianas usando Odoo Community en producción. Los artículos de "Odoo para ONGs" son marketing de partners españoles, no casos colombianos. 🚩 Red flag.

### Costos reales año 1 (10-20 usuarios)
- ConsultoresOdooColombia: paquete desde **$4.9M COP**
- Backendevs "Paquete Profesional": USD 300/año + implementación aparte
- Rango realista con partner serio: **$15-60M COP** ($3.500-14.000 USD)
- Hosting VPS self-hosted: USD 30-100/mes

### Riesgos documentados
- 60-70% de proyectos ERP no logran beneficios esperados (estadística general)
- **Causa principal de fracaso en Colombia**: freelancers baratos sin metodología
- Dependencia del partner para actualizaciones anuales DIAN (resoluciones cambian cada 1-3 meses)
- Uso excesivo de Odoo Studio = deuda técnica

## ¿Implementarlo nosotros (Leonardo + Claude) o contratar partner?

### Lo que SÍ podemos hacer bien juntos

Con la experiencia del portal (Next.js + Airtable + Neon + R2 + PDFs + auth + flujos de negocio complejos con roles):

- **Python + framework Odoo**: curva de aprendizaje ~2-3 semanas guiada
- **Módulos custom (Python + XML)**: dominio más acotado que lo ya hecho
- **Integraciones REST/XML-RPC**: experiencia fuerte
- **Modelado de datos** con relaciones complejas: sí
- **PDFs, flujos con estado, validaciones**: pan comido
- **Deployment (VPS, Docker, Postgres)**: salto pequeño desde Vercel

### Lo que NO podemos hacer solos

1. **Conocimiento contable profundo** — Claude no es contador. Preguntas tipo "¿retención va a cuenta 2365 o 2366?", "¿cómo se imputa anticipo de viajes en el PUC?" requieren contador que entienda CampoLimpio
2. **Normativa DIAN cambiante** — resoluciones 1-3 veces/año. Un partner vive de estar al día; equipo interno se rezaga
3. **Responsabilidad legal** — facturación mal calculada = multas DIAN. Un partner tiene SLA/contrato

## Recomendación: modelo HÍBRIDO (no partner full, no solos)

### Fase 1 — Implementación inicial (~3 meses)
- **Leonardo + Claude** hacen el trabajo técnico: VPS, instalación Odoo, módulos custom, integración portal↔Odoo
- **Partner colombiano por horas** (no proyecto cerrado) para:
  - Configuración localización CO (PUC, impuestos, secuencias)
  - Setup facturación electrónica DIAN (Jorels u otro)
  - Revisión que el mapeo contable esté correcto
- **Contador de CampoLimpio** revisa cada flujo contable antes de aprobarlo

**Costo estimado Fase 1: $5-15M COP** (vs. $15-60M de partner full)

### Fase 2 — Operación (ongoing)
- Leonardo + Claude mantienen el 80% (bugs, cambios menores, integración portal↔Odoo)
- **Retainer con partner**: 10-20 horas/mes para updates DIAN, upgrades Odoo anuales, troubleshooting raro
- Contador revisa estados financieros mensualmente

**Costo estimado Fase 2: $1-3M COP/mes**

### Por qué funciona este modelo

Ventajas reales de hacerlo así:
- Claude entiende el negocio de CampoLimpio (kardex, coordinadores, legalizaciones) a detalle
- La integración portal↔Odoo la hacemos mejor que ningún partner externo (conocemos el portal)
- El 80% del valor de un partner colombiano es "localización + DIAN + configuración inicial" — pagamos solo por esas horas específicas, no por proyecto completo

## Preguntas pendientes específicas para decidir modelo híbrido vs full partner

1. ¿Contador de CampoLimpio es interno o externo? ¿Disposición a involucrarse en el proyecto?
2. ¿Hay alguien en el equipo (además de Leonardo) que pueda operar un VPS Linux básico para soporte?
3. Tolerancia al riesgo: ¿prefieres "todo funciona con partner costoso" o "nosotros aprendemos con backup experto"?
4. ¿Hay alguien que pueda dedicar ~10h/semana durante 2-3 meses para el arranque?

## Conclusión final

**Odoo Community self-hosted es técnicamente viable para CampoLimpio**, pero NO con enfoque "solo nosotros" ni "solo partner". El modelo híbrido (nosotros + partner por horas + contador interno) aprovecha la experiencia acumulada del portal y reduce el costo a una fracción de la implementación tradicional.

**Si no hay contador comprometido con el proyecto**, entonces cambia la recomendación: ir por **Siigo o Alegra (SaaS colombiano)**. Menos ambicioso pero más sostenible sin expertise contable interna.

## Fuentes investigación
- OCA/l10n-colombia: https://github.com/OCA/l10n-colombia
- Partners Odoo Colombia: https://www.odoo.com/partners/country/colombia-47
- Documentación Odoo 18 Colombia: https://www.odoo.com/documentation/18.0/es_419/applications/finance/fiscal_localizations/colombia.html
- Jorels SAS (facturación electrónica gratuita): https://www.jorels.com/edi
- ConsultoresOdooColombia: https://consultoresodoocolombia.odoo.com/en
- Pragmatic - Factura electrónica Odoo: https://www.pragmatic.com.co/facturacion-electronica-odoo-colombia
- Backendevs: https://www.backendevs.com/paquete-profesional-odoo-colombia
- Vauxoo - Motivos fracaso implementación Odoo: https://www.vauxoo.com/en_US/blog/our-blog-1/principales-motivos-de-fracaso-para-implementacion-de-odoo-y-como-evitarlos-233
- GarKeM - Consejos implementación Colombia: https://garkem.com/blog/odoo-1/6-consejos-claves-para-implementar-con-exito-odoo-erp-en-colombia-79
- Navegasoft - Conexión directa DIAN: https://www.navegasoft.com/documentos-electronicos
