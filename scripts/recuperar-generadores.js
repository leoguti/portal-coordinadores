/**
 * scripts/recuperar-generadores.js
 * Crea los GENERADORES faltantes para FINCAS que quedaron sin enlazar.
 * Ejecutar: node scripts/recuperar-generadores.js
 * Dry run:  node scripts/recuperar-generadores.js --dry
 */

require("dotenv").config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry");
const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nitPrefix(cedula) {
  const d = (cedula || "").replace(/\D/g, "");
  return d.length >= 5 ? d.slice(0, -1) : d;
}

const TIPOS_VALIDOS = ["AGRICOLA", "PECUARIO", "FLORICULTOR", "OTRO"];

function normalizarTipo(tipo) {
  const t = (tipo || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t.includes("AGRI") || t.includes("CULTOR")) return "AGRICOLA";
  if (t.includes("PECUA") || t.includes("GANAD") || t.includes("VETER")) return "PECUARIO";
  if (t.includes("FLORI") || t.includes("FLOR")) return "FLORICULTOR";
  if (TIPOS_VALIDOS.includes(t)) return t;
  return "OTRO";
}

async function airtableGet(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
  return res.json();
}

async function fetchAll(table, fields) {
  const records = [];
  let offset = "";
  const fp = fields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  do {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${table}?${fp}&pageSize=100${offset ? "&offset=" + offset : ""}`;
    const data = await airtableGet(url);
    if (data.error) throw new Error(`[fetchAll ${table}] ${JSON.stringify(data.error)}`);
    records.push(...data.records);
    offset = data.offset || "";
    process.stderr.write(".");
    await sleep(210);
  } while (offset);
  return records;
}

async function batchCreate(table, records) {
  if (DRY_RUN) {
    process.stderr.write(`[DRY] would create ${records.length} in ${table}\n`);
    return records.map((_, i) => ({ id: `dry_${i}`, fields: records[i].fields }));
  }
  const created = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${table}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch }),
    });
    const data = await res.json();
    if (data.error) {
      console.error(`\n[batchCreate error] ${JSON.stringify(data.error)}`);
      created.push(...batch.map(() => null));
    } else {
      created.push(...data.records);
    }
    process.stderr.write(".");
    await sleep(250);
  }
  return created;
}

async function batchPatch(table, records) {
  if (DRY_RUN) {
    process.stderr.write(`[DRY] would patch ${records.length} in ${table}\n`);
    return;
  }
  let errors = 0;
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${table}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch }),
    });
    const data = await res.json();
    if (data.error) { errors++; console.error(`\n[batchPatch error] ${JSON.stringify(data.error)}`); }
    process.stderr.write(".");
    await sleep(250);
  }
  return errors;
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== RECUPERACIÓN GENERADORES ===");

  // 1. Fetch FINCAS sin generador (que tienen ubicacion enlazada)
  console.log("\nFetching FINCAS sin generador...");
  const todasFincas = await fetchAll("FINCAS", ["generador", "ubicaciones", "nombre"]);
  const sinGen = todasFincas.filter(
    (r) => !r.fields.generador?.length && r.fields.ubicaciones?.length
  );
  console.log(`\n→ ${sinGen.length} FINCAS sin generador`);

  if (sinGen.length === 0) {
    console.log("Nada que recuperar.");
    return;
  }

  // 2. Fetch ubicaciones correspondientes para obtener NIT/nombre/tipo
  const ubicacionIds = sinGen.flatMap((r) => r.fields.ubicaciones || []);
  console.log(`\nFetching ${ubicacionIds.length} ubicaciones...`);

  // Fetch en batches via filterByFormula
  const ubicMap = new Map();
  const CHUNK = 30;
  for (let i = 0; i < ubicacionIds.length; i += CHUNK) {
    const chunk = ubicacionIds.slice(i, i + CHUNK);
    const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    const url = `https://api.airtable.com/v0/${BASE_ID}/ubicaciones?filterByFormula=${encodeURIComponent(formula)}&fields[]=nombregenerador&fields[]=cedulagenerador&fields[]=tipogenerador&pageSize=100`;
    const data = await airtableGet(url);
    if (data.error) { console.error("Error fetching ubicaciones:", data.error); continue; }
    for (const r of data.records) ubicMap.set(r.id, r.fields);
    process.stderr.write(".");
    await sleep(210);
  }
  console.log(`\n→ ${ubicMap.size} ubicaciones cargadas`);

  // 3. Agrupar FINCAS por NIT prefix
  const byNit = new Map();
  for (const finca of sinGen) {
    const ubicId = finca.fields.ubicaciones[0];
    const ubic = ubicMap.get(ubicId) || {};
    const prefix = nitPrefix(ubic.cedulagenerador) || `__sin_nit_${finca.id}`;
    if (!byNit.has(prefix)) byNit.set(prefix, { fincas: [], ubic });
    byNit.get(prefix).fincas.push(finca.id);
  }
  console.log(`\n→ ${byNit.size} grupos NIT a crear como GENERADORES`);

  // 4. Crear GENERADORES faltantes
  console.log("\nCreando GENERADORES faltantes...");
  const generadorDefs = [];
  for (const [nitKey, { fincas, ubic }] of byNit) {
    const nombre = (ubic.nombregenerador || "").trim() || "Sin nombre";
    const nit = (ubic.cedulagenerador || "").trim();
    const tipo = normalizarTipo(ubic.tipogenerador);
    generadorDefs.push({ fields: { nombre, nit, tipo }, nitKey, fincaIds: fincas });
  }

  const createdGeneradores = await batchCreate(
    "GENERADORES",
    generadorDefs.map((d) => ({ fields: d.fields }))
  );
  const createdOk = createdGeneradores.filter(Boolean).length;
  console.log(`\n→ ${createdOk} GENERADORES creados`);

  // 5. Enlazar FINCAS → nuevos GENERADORES
  console.log("\nEnlazando FINCAS → GENERADORES...");
  const patches = [];
  for (let i = 0; i < generadorDefs.length; i++) {
    const genRecord = createdGeneradores[i];
    if (!genRecord) continue;
    for (const fincaId of generadorDefs[i].fincaIds) {
      patches.push({ id: fincaId, fields: { generador: [genRecord.id] } });
    }
  }
  await batchPatch("FINCAS", patches);
  console.log(`\n→ ${patches.length} FINCAS enlazadas`);

  console.log("\n════════════════════════════════");
  console.log("RESUMEN RECUPERACIÓN");
  console.log("════════════════════════════════");
  console.log(`FINCAS sin generador encontradas: ${sinGen.length}`);
  console.log(`GENERADORES creados:              ${createdOk}`);
  console.log(`FINCAS enlazadas:                 ${patches.length}`);
  console.log(DRY_RUN ? "\n(DRY RUN)" : "\n¡Recuperación completada!");
}

main().catch((err) => {
  console.error("\nERROR:", err.message);
  process.exit(1);
});
