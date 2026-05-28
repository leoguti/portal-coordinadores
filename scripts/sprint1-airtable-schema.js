/**
 * Sprint 1 T1+T2 — crea los campos del flujo de aprobación en Airtable
 * (Certificados, GENERADORES, FINCAS) y opcionalmente migra los registros
 * existentes a estado="aprobado".
 *
 * Requiere un Personal Access Token con scope `schema.bases:write` además
 * del `data.records:read/write` que ya usamos.
 *
 * Variables de entorno (en .env.local):
 *   AIRTABLE_API_KEY=patXXX (con schema.bases:write)
 *   AIRTABLE_BASE_ID=appniHwKiUMS0imXD
 *
 * Modos:
 *   node scripts/sprint1-airtable-schema.js               # dry-run (solo lista lo que falta)
 *   node scripts/sprint1-airtable-schema.js --crear       # crea los campos faltantes
 *   node scripts/sprint1-airtable-schema.js --migrar      # PATCH masivo estado=aprobado
 *   node scripts/sprint1-airtable-schema.js --crear --migrar
 *
 * Idempotente: salta campos / registros ya migrados.
 */

require("dotenv").config({ path: ".env.local" });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error("ERROR: AIRTABLE_API_KEY y AIRTABLE_BASE_ID requeridos en .env.local");
  process.exit(1);
}

const DRY_RUN = !process.argv.includes("--crear") && !process.argv.includes("--migrar");
const DO_CREATE = process.argv.includes("--crear");
const DO_MIGRATE = process.argv.includes("--migrar");

// ────────────────── Definición de campos por tabla ──────────────────

const SELECT_ESTADOS_CERT = [
  { name: "pendiente", color: "yellowLight2" },
  { name: "aprobado", color: "greenLight2" },
  { name: "rechazado", color: "redLight2" },
  { name: "anulado", color: "grayLight2" },
];

const SELECT_ESTADOS_GEN_FINCA = [
  { name: "pendiente", color: "yellowLight2" },
  { name: "aprobado", color: "greenLight2" },
  { name: "rechazado", color: "redLight2" },
];

const SELECT_ESTADOS_FINCA = [
  ...SELECT_ESTADOS_GEN_FINCA,
  { name: "pendiente_revision", color: "orangeLight2" },
];

const SELECT_ORIGEN = [
  { name: "portal", color: "blueLight2" },
  { name: "whatsapp", color: "greenLight2" },
  { name: "telegram", color: "purpleLight2" },
];

/** Cada elemento: { name, type, options? } siguiendo el schema de Airtable Metadata API. */
const CAMPOS_CERTIFICADOS = [
  { name: "estado", type: "singleSelect", options: { choices: SELECT_ESTADOS_CERT } },
  { name: "solicitud_origen", type: "singleSelect", options: { choices: SELECT_ORIGEN } },
  { name: "fecha_solicitud", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "fecha_aprobacion", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "fecha_rechazo", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "fecha_anulacion", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "motivo_rechazo", type: "multilineText" },
  { name: "motivo_anulacion", type: "multilineText" },
  { name: "aprobado_por", type: "multipleRecordLinks", options: { linkedTableId: null /* se resuelve abajo */ }, _linkTo: "Coordinadores" },
  { name: "rechazado_por", type: "multipleRecordLinks", options: { linkedTableId: null }, _linkTo: "Coordinadores" },
  { name: "anulado_por", type: "multipleRecordLinks", options: { linkedTableId: null }, _linkTo: "Coordinadores" },
];

const CAMPOS_GENERADORES = [
  { name: "estado", type: "singleSelect", options: { choices: SELECT_ESTADOS_GEN_FINCA } },
  { name: "solicitud_origen", type: "singleSelect", options: { choices: SELECT_ORIGEN } },
  { name: "fecha_solicitud", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "fecha_aprobacion", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "fecha_rechazo", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "motivo_rechazo", type: "multilineText" },
  { name: "cambios_pendientes", type: "multilineText" },
  { name: "aprobado_por", type: "multipleRecordLinks", options: { linkedTableId: null }, _linkTo: "Coordinadores" },
  { name: "rechazado_por", type: "multipleRecordLinks", options: { linkedTableId: null }, _linkTo: "Coordinadores" },
  { name: "coordinador_solicitado", type: "multipleRecordLinks", options: { linkedTableId: null }, _linkTo: "Coordinadores" },
];

const CAMPOS_FINCAS = [
  { name: "estado", type: "singleSelect", options: { choices: SELECT_ESTADOS_FINCA } },
  { name: "solicitud_origen", type: "singleSelect", options: { choices: SELECT_ORIGEN } },
  { name: "fecha_solicitud", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "fecha_aprobacion", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "fecha_rechazo", type: "dateTime", options: { dateFormat: { name: "iso" }, timeFormat: { name: "24hour" }, timeZone: "America/Bogota" } },
  { name: "motivo_rechazo", type: "multilineText" },
  { name: "cambios_pendientes", type: "multilineText" },
  { name: "aprobado_por", type: "multipleRecordLinks", options: { linkedTableId: null }, _linkTo: "Coordinadores" },
  { name: "rechazado_por", type: "multipleRecordLinks", options: { linkedTableId: null }, _linkTo: "Coordinadores" },
];

// ────────────────── Helpers Airtable ──────────────────

async function metaFetch(path, options = {}) {
  const res = await fetch(`https://api.airtable.com/v0/meta${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Meta API ${res.status}: ${body}`);
  }
  return res.json();
}

async function dataFetch(path, options = {}) {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Data API ${res.status}: ${body}`);
  }
  return res.json();
}

async function getSchema() {
  return metaFetch(`/bases/${AIRTABLE_BASE_ID}/tables`);
}

function findTable(schema, nombre) {
  const t = schema.tables.find((x) => x.name === nombre);
  if (!t) throw new Error(`Tabla "${nombre}" no encontrada en el schema`);
  return t;
}

async function crearCampo(tableId, campo) {
  const body = { name: campo.name, type: campo.type };
  if (campo.options) body.options = campo.options;
  return metaFetch(`/bases/${AIRTABLE_BASE_ID}/tables/${tableId}/fields`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function listarRecords(tablaNombre, opts = {}) {
  // Pagina todo y devuelve [].
  const all = [];
  let offset = null;
  const fieldsParam = (opts.fields || []).map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  const filter = opts.filterByFormula ? `filterByFormula=${encodeURIComponent(opts.filterByFormula)}` : "";
  do {
    const qs = [fieldsParam, filter, "pageSize=100", offset ? `offset=${offset}` : ""].filter(Boolean).join("&");
    const data = await dataFetch(`/${encodeURIComponent(tablaNombre)}?${qs}`);
    all.push(...data.records);
    offset = data.offset || null;
  } while (offset);
  return all;
}

async function patchBatch(tablaNombre, records) {
  // Airtable limita 10 records por PATCH.
  const chunkSize = 10;
  let total = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    const slice = records.slice(i, i + chunkSize);
    const res = await dataFetch(`/${encodeURIComponent(tablaNombre)}`, {
      method: "PATCH",
      body: JSON.stringify({ records: slice, typecast: true }),
    });
    total += res.records.length;
    if (i % 500 === 0) console.log(`   …${total}/${records.length}`);
    // Pequeña pausa para no saturar rate limit (5 req/s por base).
    await new Promise((r) => setTimeout(r, 220));
  }
  return total;
}

// ────────────────── Crear campos ──────────────────

async function asegurarCampos(tabla, camposDeseados, schema) {
  const existentes = new Set(tabla.fields.map((f) => f.name));
  const coordTable = findTable(schema, "Coordinadores");
  const faltantes = [];
  for (const c of camposDeseados) {
    if (existentes.has(c.name)) continue;
    // Resolver linkedTableId para los multipleRecordLinks.
    if (c.type === "multipleRecordLinks" && c._linkTo === "Coordinadores") {
      c.options = { ...c.options, linkedTableId: coordTable.id };
      delete c._linkTo;
    }
    faltantes.push(c);
  }
  if (faltantes.length === 0) {
    console.log(`   ✓ ${tabla.name}: todos los campos ya existen.`);
    return;
  }
  console.log(`   → ${tabla.name}: faltan ${faltantes.length} campos: ${faltantes.map((f) => f.name).join(", ")}`);
  if (!DO_CREATE) return;
  for (const c of faltantes) {
    try {
      await crearCampo(tabla.id, c);
      console.log(`     + creado: ${c.name}`);
    } catch (err) {
      console.error(`     ✗ error creando ${c.name}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

// ────────────────── Migración masiva estado="aprobado" ──────────────────

async function migrarTabla(nombre, campoOrigenLabel = "portal") {
  console.log(`\n── Migrando ${nombre} a estado="aprobado" ──`);
  // Solo procesar registros que aún NO tengan estado definido.
  const records = await listarRecords(nombre, {
    fields: ["estado"],
    filterByFormula: `{estado} = BLANK()`,
  });
  console.log(`   ${records.length} registros sin estado.`);
  if (records.length === 0) return;
  if (!DO_MIGRATE) {
    console.log("   (dry-run, no se patchea — pasa --migrar para aplicar)");
    return;
  }
  const updates = records.map((r) => ({
    id: r.id,
    fields: {
      estado: "aprobado",
      solicitud_origen: campoOrigenLabel,
    },
  }));
  const total = await patchBatch(nombre, updates);
  console.log(`   ✓ ${total} registros actualizados.`);
}

// ────────────────── Main ──────────────────

(async () => {
  console.log(DRY_RUN ? "MODO DRY-RUN (no escribe nada)" : DO_CREATE && DO_MIGRATE ? "MODO CREAR + MIGRAR" : DO_CREATE ? "MODO CREAR CAMPOS" : "MODO MIGRAR RECORDS");
  console.log(`Base: ${AIRTABLE_BASE_ID}\n`);

  const schema = await getSchema();
  const cert = findTable(schema, "Certificados");
  const gen = findTable(schema, "GENERADORES");
  const finca = findTable(schema, "FINCAS");

  console.log("── Revisando campos ──");
  await asegurarCampos(cert, CAMPOS_CERTIFICADOS, schema);
  await asegurarCampos(gen, CAMPOS_GENERADORES, schema);
  await asegurarCampos(finca, CAMPOS_FINCAS, schema);

  // Para migrar necesitamos que el campo `estado` ya exista. Si DO_CREATE
  // acaba de crearlo, refrescamos schema antes de migrar.
  if (DO_MIGRATE) {
    if (DO_CREATE) {
      console.log("\n(Esperando 3s para que Airtable propague schema…)");
      await new Promise((r) => setTimeout(r, 3000));
    }
    await migrarTabla("Certificados", "portal");
    await migrarTabla("GENERADORES", "portal");
    await migrarTabla("FINCAS", "portal");
  }

  console.log("\nListo.");
})().catch((err) => {
  console.error("\nERROR FATAL:", err);
  process.exit(1);
});
