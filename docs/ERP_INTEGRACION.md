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

---

# ACTUALIZACIÓN — Retoma del proyecto (2026-08-19)

## Novedades

- **Ángela está animada y quiere activar el ERP en CampoLimpio.** Hay respaldo institucional para avanzar — esto despeja parcialmente la pregunta de compromiso organizacional de la Fase 0.
- **El sistema contable actual es Helisa** (el doc original lo llamaba "sistema contable muy básico" sin nombrarlo). Ver sección "Helisa" abajo.

## Helisa — investigación (2026-08-19)

### Qué es hoy

- Software de **Proasistemas S.A.** (Bogotá, desde 1988). Vivo y con releases en 2026, pero de estirpe escritorio: cliente-servidor Windows sobre **Firebird** (en jun-2026 apenas migraron de Firebird 2.5 → 3.0, motor de 2016 — ilustra el ritmo tecnológico). Producto principal actual: **Helisa N.I.** (NIIF + fiscal); "Helisa GW" es el nombre histórico. Existe **Helisa Cloud** (mismo software hospedado por ellos, no app web nativa): Básico $192.780 / Estándar $249.480 / Plus $396.900 COP/mes.
- **Cumplimiento normativo completo**: facturación electrónica integrada (ATEB Colombia S.A.S., empresa de Proasistemas, es **proveedor tecnológico habilitado DIAN** desde 2017), nómina electrónica, documento soporte, e **Información Exógena** (producto aparte que genera/valida el XML para MUISCA).
- Percepción: tercero en rankings CO 2026, valorado por profundidad contable "tradicional"; Siigo/Alegra dominan la conversación. No hay herramienta oficial de migración Helisa→otro; la vía estándar es exportar a Excel.

### 🔑 HALLAZGO CLAVE: Helisa tiene API oficial — "Helisa Conekta"

- **Bidireccional y documentada** (helisa.com/producto/helisa-conekta, helisa.com/api):
  - **POST**: inserción de **documentos contables/asientos** (con cuenta PUC, débito/crédito, tercero NIT/CC, centro de costo, concepto, base gravable), órdenes de compra, productos, creación/actualización de terceros.
  - **GET**: saldos, cartera, existencias, balance general, estado de resultados, cartillas.
  - JSON vía HTTP POST + autenticación **HMAC** del payload. El servidor **valida partida doble y rechaza duplicados** (códigos de error específicos: asiento descuadrado, documento duplicado).
  - Endpoint de ejemplo en la doc: `http://webconekta.helisa.com:9590/...` — ⚠️ aparece en HTTP con puerto no estándar; **confirmar HTTPS con Proasistemas antes de enviar datos reales**.
- **Costo: $211.680 COP/mes** (un mes gratis pagando año anticipado).
- **Plan B gratuito**: módulo "Transferencia de Datos → Importar → Movimiento Contable" — carga asientos desde **Excel .xls** (formato 97-2003) con mapeo de columnas y validación previa; restricción: un archivo = un mes. También importa cartillas de cuentas y terceros.
- **Pendiente confirmar con Proasistemas**: HTTPS, si Conekta aplica a la edición/licencia que tiene CampoLimpio, versión mínima de Helisa requerida, SLA.

### Implicación: la decisión ahora tiene TRES rutas

| | **Ruta 0: Quedarse en Helisa + Conekta** | **Ruta A: Odoo Online** | **Ruta B: Odoo Community self-hosted** |
|---|---|---|---|
| Cambio para contabilidad | **Ninguno** (siguen en Helisa) | Alto (nuevo sistema, capacitación, migración saldos) | Alto (ídem) |
| Trabajo técnico nuestro | Solo el conector portal→Conekta (JSON+HMAC desde API route) — semanas, no meses | Conector + configuración Odoo + migración | Todo lo anterior + VPS/DevOps + fact. electrónica OCA/Jorels |
| Costo recurrente | ~$212k COP/mes Conekta (o $0 con importador .xls) + licencia Helisa actual | ~$8.95 USD/us/mes + partner por horas | VPS + API Jorels por consumo + retainer partner |
| Cumplimiento DIAN | Ya resuelto (ATEB habilitado, exógena, nómina) | Odoo lo mantiene (`l10n_co_dian`) | Responsabilidad propia ("software propio") |
| Lo que NO gana | Sigue siendo escritorio/Firebird; sin compras/inventario/reportería moderna integrada | — | — |
| Riesgo | Bajo | Medio | Alto |

**Lectura**: el argumento original del doc para el ERP era que pasar datos a contabilidad era manual. **Conekta elimina ese dolor sin migrar de sistema**: el portal puede empujar asientos automáticamente (con tercero y centro de costo) y Helisa valida partida doble y duplicados. La Ruta 0 captura la mayor parte del valor con una fracción del riesgo y del esfuerzo, y **no cierra la puerta**: si en 1-2 años Helisa queda corto, la integración portal→contabilidad ya construida se re-apunta a Odoo (el mapeo contable ya estaría hecho y probado). El ERP completo (Rutas A/B) solo se justifica si CampoLimpio necesita lo que Helisa no da: compras/inventario integrados, multiusuario web, reportería gerencial moderna.
- Leonardo se inclina por la **implementación propia** (modelo híbrido del addendum: Leonardo + Claude en lo técnico, partner por horas para localización/DIAN, contador validando flujos), apoyado en la experiencia acumulada con el portal.

## Preocupaciones expresadas al retomar

1. **Cambio de tecnología**: el portal es Next.js/TypeScript; Odoo es Python + su propio framework ORM/XML. Riesgo percibido: meterse en terreno difícil.
2. **Comunicación portal ↔ ERP**: cómo se integra lo ya construido (Airtable, kardex, caja menor, OS, certificados) con el ERP sin romper la operación actual.

## Verificación de afirmaciones del addendum de abril (hecha 2026-08-19)

Se verificaron en la web las afirmaciones clave del addendum. Veredictos:

### ⚠️ CORRECCIÓN CRÍTICA: `l10n_co_dian` NO es Community

El addendum decía que Odoo 18 traía conexión directa DIAN "Software Propio" **gratis** vía `l10n_co_dian`. Verificado contra GitHub: ese módulo **no existe en el repo Community** (`odoo/odoo`, ramas 18.0 y 19.0) — es **Enterprise** (vive en `odoo/enterprise`, licencia OEEL). El anuncio oficial lo confirma: disponible en SaaS 17.4+ y Odoo 18 en Odoo.sh/On Premise, modalidades que requieren suscripción Enterprise.

**Rutas reales de facturación electrónica en Community**:
1. Módulo OCA `l10n_co_electronic_invoice_self` (Software Propio, disponible 18.0 y portado a 19.0)
2. Jorels (ver abajo)
3. Proveedores pagos (Carvajal vía `l10n_co_edi`, etc.)

### 💰 A FAVOR: geopricing — Odoo Online cuesta $8.95 USD/usuario/mes en Colombia

El "~$30 USD/usuario/mes" del doc original es el precio de EE.UU. Odoo cobra por país: **Colombia paga Standard $8.95 / Custom $13.60 USD/usuario/mes** (facturación anual). Con 3-5 usuarios contables: ~$27-68 USD/mes, sin DevOps, con `l10n_co_dian` (conexión DIAN oficial) incluido. Esto debilita el argumento económico de Community self-hosted. Trade-off: Odoo Online (Standard) no permite módulos custom propios; para eso se necesita Odoo.sh o Custom/on-premise Enterprise.

### Jorels — CONFIRMADO vivo y activo, con matices

- Monorepo `jorels-odoo-addons` (GitLab principal, espejo GitHub) con ramas 12.0–19.0, **todas con commits del 2-ago-2026**. Licencia LGPL-3 confirmada. Incluye POS, nómina electrónica, salud.
- **Matiz "gratis"**: los módulos son libres, pero se conectan a la **API de Jorels que se paga por consumo de documentos** (planes "desde $0 COP"; capacitación $312.000 COP + IVA).
- **Jorels NO es proveedor tecnológico habilitado DIAN** (verificado contra el listado oficial DIAN del 6-ago-2026). Opera bajo la figura de **"software propio"**: cada cliente registra el software a su nombre ante la DIAN y la responsabilidad regulatoria recae en el facturador (CampoLimpio), no en Jorels.
- Madurez: 7 años de desarrollo, 8 versiones mantenidas, ~666 descargas, +300 empresas (auto-reportado). Cautela: casi ninguna reseña pública independiente; issues de GitHub sin respuesta desde 2024 (soporte por canales privados).
- Empresa activa: Jorels S.A.S., NIT 901.410.078-1, Bogotá.

### Otros veredictos

| Afirmación (abril) | Veredicto (agosto) |
|---|---|
| PUC oficial viene con `l10n_co` (Community) | ✅ CONFIRMADA |
| OCA l10n-colombia activo, 4 módulos, rama 18.0 | 🔄 Sigue activo (commit jul-2026); ahora **5 módulos** en 18.0 (se sumó `l10n_co_check_vat`, jun-2026); **ya existe rama 19.0** con 3 módulos |
| Versión Odoo | 🔄 La estable actual es **Odoo 19** (sept-2025, localización CO completa); Odoo 20 esperado ~oct-2026 |
| 29 partners Colombia (7G/5S/17R) | 🔄 Ahora **43** (8 Gold / 8 Silver / 27 Ready) — ecosistema creció ~48% |
| ConsultoresOdooColombia desde $4.9M COP | 🚩 **Sitio bloqueado por suscripción vencida** — no verificable; descartarlo como candidato |
| Backendevs USD 300/año | ✅ CONFIRMADA (vigente; implementación aparte) |
| Odoo Online ~$30 USD/us/mes | 🔄 Colombia: **$8.95 / $13.60** (geopricing) |
| Siigo $50-200 USD/mes | 🔄 Real: ~$36-52 USD/mes (146k-208k COP, plan anual); ya no publican precios abiertamente |
| Alegra $30-100 USD/mes | 🔄 Real: ~$18-78 USD/mes (Contabilidad); solo facturación desde ~$4 USD/mes |
| Siigo API "menos flexible" | 🔄 Matizar: ambas tienen API REST pública documentada; Alegra suma webhooks + OpenAPI (la más amigable para integrar) |

### Implicación para la decisión

La disyuntiva ya no es "Community self-hosted vs partner caro". Las dos rutas viables hoy:

| | **A: Odoo Online (Enterprise SaaS)** | **B: Community self-hosted + OCA/Jorels** |
|---|---|---|
| Costo licencias | $8.95 USD/us/mes (~$27-45/mes con 3-5 usuarios) | $0 licencias + VPS $30-100/mes + API Jorels por consumo |
| DevOps | Ninguno (Odoo lo opera) | VPS, backups, upgrades anuales propios |
| Facturación DIAN | `l10n_co_dian` oficial incluido | OCA `_self` o Jorels ("software propio", responsabilidad propia) |
| Módulos custom | ❌ No en Standard (sí en Odoo.sh, más caro) | ✅ Total libertad |
| Integración portal↔ERP | ✅ API XML-RPC/JSON-RPC disponible igual | ✅ Igual |
| Riesgo actualización DIAN | Odoo la mantiene | Depende de OCA/Jorels + nosotros |

La integración portal↔Odoo (el valor diferencial nuestro) funciona igual en ambas rutas — la API externa de Odoo está disponible en Online y Community. La pregunta decisiva pasa a ser: **¿cuánto módulo custom necesitamos dentro de Odoo?** Si la personalización vive en el portal (que sigue siendo la fuente operativa) y Odoo solo recibe transacciones, la ruta A es más barata en esfuerzo total y más segura en DIAN.

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
