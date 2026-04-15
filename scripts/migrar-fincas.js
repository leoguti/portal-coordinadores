/**
 * scripts/migrar-fincas.js
 * Migración: crea GENERADORES y FINCAS desde ubicaciones (tabla legacy)
 *
 * Ejecutar: node scripts/migrar-fincas.js
 * Dry run:  node scripts/migrar-fincas.js --dry
 */

require("dotenv").config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry");
const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!API_KEY || !BASE_ID) {
  console.error("Faltan AIRTABLE_API_KEY o AIRTABLE_BASE_ID en .env.local");
  process.exit(1);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nitPrefix(cedula) {
  const d = (cedula || "").replace(/\D/g, "");
  return d.length >= 5 ? d.slice(0, -1) : d;
}

function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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

function isWeirdNit(nit) {
  if (!nit?.trim()) return true;
  const d = nit.replace(/\D/g, "");
  return d.length < 5 || d.length > 12;
}

/** Intenta mapear texto libre de cultivo a IDs del catálogo CULTIVOS */
function mapCultivos(texto, catalog) {
  if (!texto?.trim()) return { ids: [], notas: null };

  const parts = texto
    .split(/[,\/]|\s+-\s+|\s+y\s+|\s+Y\s+|\s+\+\s+/i)
    .map((p) => norm(p.trim()))
    .filter((p) => p.length > 2);

  const matched = new Set();
  const unmatched = [];

  for (const part of parts) {
    let found = false;
    for (const c of catalog) {
      const cn = norm(c.nombre);
      if (part === cn || part.includes(cn) || cn.includes(part)) {
        matched.add(c.id);
        found = true;
        break;
      }
    }
    if (!found) unmatched.push(part);
  }

  return {
    ids: Array.from(matched),
    notas: unmatched.length > 0 ? `cultivo_no_mapeado: "${texto}"` : null,
  };
}

// ─── Airtable API ────────────────────────────────────────────────────────────

async function fetchAll(table, fields) {
  const records = [];
  let offset = "";
  const fp = fields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  do {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${table}?${fp}&pageSize=100${offset ? "&offset=" + offset : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    const data = await res.json();
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
    return records.map((_, i) => ({ id: `dry_${table}_${i}`, fields: records[i].fields }));
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
      console.error(`\n[batchCreate ${table}] ${JSON.stringify(data.error)}`);
      // push placeholders so indexes stay aligned
      created.push(...batch.map(() => null));
    } else {
      created.push(...data.records);
    }
    process.stderr.write(".");
    await sleep(220);
  }
  return created;
}

async function batchPatch(table, records) {
  if (DRY_RUN) {
    process.stderr.write(`[DRY] would patch ${records.length} in ${table}\n`);
    return;
  }
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${table}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: batch }),
    });
    const data = await res.json();
    if (data.error) {
      console.error(`\n[batchPatch ${table}] ${JSON.stringify(data.error)}`);
    }
    process.stderr.write(".");
    await sleep(220);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== MIGRACIÓN REAL ===");

  // 1. Fetch datos fuente
  console.log("\nFetching ubicaciones...");
  const ubicaciones = await fetchAll("ubicaciones", [
    "nombregenerador",
    "cedulagenerador",
    "direcciongenerador",
    "CODIGOMUN",
    "cultivogenerador",
    "movilgenerador",
    "emailgenerador",
    "tipogenerador",
    "Certificados",
  ]);
  console.log(`\n→ ${ubicaciones.length} ubicaciones`);

  console.log("\nFetching catálogo CULTIVOS...");
  const cultivosRaw = await fetchAll("CULTIVOS", ["nombre"]);
  const cultivos = cultivosRaw.map((r) => ({ id: r.id, nombre: r.fields.nombre }));
  console.log(`\n→ ${cultivos.length} cultivos en catálogo`);

  // 2. Agrupar por NIT prefix → GENERADORES
  const byNit = new Map();
  for (const r of ubicaciones) {
    const prefix = nitPrefix(r.fields.cedulagenerador);
    const key = prefix || `__sin_nit_${r.id}`;
    if (!byNit.has(key)) byNit.set(key, []);
    byNit.get(key).push(r);
  }
  console.log(`\n→ ${byNit.size} grupos NIT (futuros GENERADORES)`);

  // 3. Preparar registros GENERADORES
  const generadorDefs = [];
  for (const [nitKey, recs] of byNit) {
    // nombre más frecuente
    const nombreCounts = {};
    for (const r of recs) {
      const n = (r.fields.nombregenerador || "").trim();
      if (n) nombreCounts[n] = (nombreCounts[n] || 0) + 1;
    }
    const nombre =
      Object.entries(nombreCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Sin nombre";

    // NIT más limpio
    const nit =
      recs
        .map((r) => (r.fields.cedulagenerador || "").trim())
        .filter(Boolean)
        .sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length)[0] || "";

    // tipo más frecuente
    const tipoCounts = {};
    for (const r of recs) {
      const t = (r.fields.tipogenerador || "").trim();
      if (t) tipoCounts[t] = (tipoCounts[t] || 0) + 1;
    }
    const tipo = normalizarTipo(
      Object.entries(tipoCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "AGRICOLA"
    );

    const fields = { nombre, nit, tipo };
    generadorDefs.push({ fields, nitKey });
  }

  // 4. Crear GENERADORES
  console.log("\nCreando GENERADORES...");
  const createdGeneradores = await batchCreate(
    "GENERADORES",
    generadorDefs.map((d) => ({ fields: d.fields }))
  );
  console.log(`\n→ ${createdGeneradores.filter(Boolean).length} GENERADORES creados`);

  // Mapa nitKey → ID Airtable del GENERADOR
  const nitToGenId = new Map();
  for (let i = 0; i < generadorDefs.length; i++) {
    if (createdGeneradores[i]) {
      nitToGenId.set(generadorDefs[i].nitKey, createdGeneradores[i].id);
    }
  }

  // 5. Preparar y crear FINCAS
  console.log("\nCreando FINCAS...");
  const fincaDefs = [];
  const stats = { sinMunicipio: 0, sinNombre: 0, cultivoNoMapeado: 0, nitRaro: 0 };

  for (const r of ubicaciones) {
    const nitKey = nitPrefix(r.fields.cedulagenerador) || `__sin_nit_${r.id}`;
    const genId = nitToGenId.get(nitKey);
    const { ids: cultivoIds, notas: cultivoNotas } = mapCultivos(r.fields.cultivogenerador, cultivos);

    // Detectar flags
    const notasParts = [];
    if (!r.fields.CODIGOMUN?.length) { notasParts.push("SIN_MUNICIPIO"); stats.sinMunicipio++; }
    if (!r.fields.direcciongenerador?.trim()) { notasParts.push("SIN_NOMBRE"); stats.sinNombre++; }
    if (cultivoNotas) { notasParts.push(cultivoNotas); stats.cultivoNoMapeado++; }
    if (isWeirdNit(r.fields.cedulagenerador)) { notasParts.push("NIT_RARO"); stats.nitRaro++; }

    const fields = {
      nombre:
        r.fields.direcciongenerador?.trim() ||
        r.fields.nombregenerador?.trim() ||
        "Sin nombre",
      ...(genId ? { generador: [genId] } : {}),
      ...(r.fields.CODIGOMUN?.length ? { municipio: r.fields.CODIGOMUN } : {}),
      ...(cultivoIds.length ? { cultivos: cultivoIds } : {}),
      ...(r.fields.movilgenerador?.trim() ? { movil: r.fields.movilgenerador.trim() } : {}),
      ...(r.fields.emailgenerador?.trim() ? { email: r.fields.emailgenerador.trim() } : {}),
      ...(r.fields.Certificados?.length ? { Certificados: r.fields.Certificados } : {}),
      ...(notasParts.length ? { notas_migracion: notasParts.join(" | ") } : {}),
    };

    fincaDefs.push({ fields, ubicacionId: r.id });
  }

  const createdFincas = await batchCreate(
    "FINCAS",
    fincaDefs.map((d) => ({ fields: d.fields }))
  );
  console.log(`\n→ ${createdFincas.filter(Boolean).length} FINCAS creadas`);

  // 6. Enlazar ubicaciones → fincas
  console.log("\nEnlazando ubicaciones → FINCAS...");
  const patches = [];
  for (let i = 0; i < fincaDefs.length; i++) {
    if (createdFincas[i]) {
      patches.push({
        id: fincaDefs[i].ubicacionId,
        fields: { finca: [createdFincas[i].id] },
      });
    }
  }
  await batchPatch("ubicaciones", patches);
  console.log(`\n→ ${patches.length} ubicaciones enlazadas`);

  // 7. Resumen
  console.log("\n════════════════════════════════");
  console.log("RESUMEN MIGRACIÓN");
  console.log("════════════════════════════════");
  console.log(`GENERADORES creados : ${createdGeneradores.filter(Boolean).length}`);
  console.log(`FINCAS creadas      : ${createdFincas.filter(Boolean).length}`);
  console.log(`Sin municipio       : ${stats.sinMunicipio}`);
  console.log(`Sin nombre/dir      : ${stats.sinNombre}`);
  console.log(`Cultivo no mapeado  : ${stats.cultivoNoMapeado}`);
  console.log(`NIT raro            : ${stats.nitRaro}`);
  console.log(DRY_RUN ? "\n(DRY RUN — nada fue creado en Airtable)" : "\n¡Migración completada!");
}

main().catch((err) => {
  console.error("\nERROR:", err.message);
  process.exit(1);
});
