/**
 * scripts/asignar-coordinador-finca.js
 *
 * Inicializa FINCAS.coordinador_asignado con el coordinador que ha emitido
 * más certificados para la finca (sumando todas sus ubicaciones).
 *
 * Uso:
 *   node scripts/asignar-coordinador-finca.js --dry
 *   node scripts/asignar-coordinador-finca.js
 */

require("dotenv").config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry");
const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!API_KEY || !BASE_ID) {
  console.error("Faltan AIRTABLE_API_KEY o AIRTABLE_BASE_ID en .env.local");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAll(table, fields) {
  const records = [];
  let offset = "";
  const fp = fields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  do {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${table}?${fp}&pageSize=100${offset ? "&offset=" + offset : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (!res.ok) {
      console.error(`[fetch ${table}]`, await res.text());
      process.exit(1);
    }
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset || "";
    if (offset) await sleep(220);
  } while (offset);
  return records;
}

(async () => {
  console.log(DRY_RUN ? "🧪 DRY RUN" : "⚙️  Aplicando cambios a Airtable");
  console.log("");

  // 1. Traer todas las FINCAS
  console.log("→ Cargando FINCAS...");
  const fincas = await fetchAll("FINCAS", ["nombre"]);
  console.log(`  ${fincas.length} fincas`);

  // 2. Traer todas las ubicaciones (finca → ubicacionId, certificados)
  console.log("→ Cargando ubicaciones...");
  const ubicaciones = await fetchAll("ubicaciones", ["finca", "Certificados"]);
  console.log(`  ${ubicaciones.length} ubicaciones`);

  // 3. Mapear finca → lista de certificadoIds (unificando las ubis de esa finca)
  const fincaToCertIds = new Map();
  for (const u of ubicaciones) {
    const fincaId = u.fields.finca?.[0];
    if (!fincaId) continue;
    const certs = u.fields.Certificados || [];
    if (!fincaToCertIds.has(fincaId)) fincaToCertIds.set(fincaId, []);
    fincaToCertIds.get(fincaId).push(...certs);
  }

  // 4. Cargar coordinador de cada certificado
  console.log("→ Cargando Certificados (campo coordinador)...");
  const certs = await fetchAll("Certificados", ["coordinador"]);
  const certToCoord = new Map();
  for (const c of certs) {
    const coord = c.fields.coordinador?.[0];
    if (coord) certToCoord.set(c.id, coord);
  }
  console.log(`  ${certs.length} certificados`);

  // 5. Para cada finca, contar certificados por coordinador
  let sinUbi = 0;
  let sinCerts = 0;
  const asignaciones = []; // { fincaId, coordinadorId, count }
  for (const finca of fincas) {
    const certIds = fincaToCertIds.get(finca.id) || [];
    if (certIds.length === 0) {
      if (!fincaToCertIds.has(finca.id)) sinUbi++;
      else sinCerts++;
      continue;
    }
    const counts = new Map();
    for (const cid of certIds) {
      const coord = certToCoord.get(cid);
      if (!coord) continue;
      counts.set(coord, (counts.get(coord) || 0) + 1);
    }
    if (counts.size === 0) { sinCerts++; continue; }
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const [winnerId, winnerCount] = sorted[0];
    asignaciones.push({
      fincaId: finca.id,
      nombre: finca.fields.nombre || "—",
      coordinadorId: winnerId,
      count: winnerCount,
      totalCoords: counts.size,
    });
  }

  console.log("");
  console.log("─── Análisis ───");
  console.log(`  Fincas total:                   ${fincas.length}`);
  console.log(`  Fincas sin ubicaciones:         ${sinUbi}`);
  console.log(`  Fincas sin certificados:        ${sinCerts}`);
  console.log(`  Fincas con asignación inferida: ${asignaciones.length}`);
  console.log("");

  // Estadística por coordinador
  const byCoord = new Map();
  for (const a of asignaciones) {
    byCoord.set(a.coordinadorId, (byCoord.get(a.coordinadorId) || 0) + 1);
  }
  console.log("Distribución — fincas por coordinador:");
  const sortedByCoord = Array.from(byCoord.entries()).sort((a, b) => b[1] - a[1]);
  for (const [cid, n] of sortedByCoord) {
    console.log(`  ${String(n).padStart(5)}  ${cid}`);
  }
  console.log("");

  // Muestra de algunos "ambiguos" (finca con >1 coordinadores distintos)
  const ambiguas = asignaciones.filter((a) => a.totalCoords > 1);
  console.log(`  Fincas con >1 coordinador en sus certs: ${ambiguas.length} (se asigna al que más tiene)`);
  if (ambiguas.length > 0) {
    console.log("  Ejemplos:");
    for (const a of ambiguas.slice(0, 5)) {
      console.log(`    [${a.fincaId}] ${a.nombre} → ${a.coordinadorId} (${a.count} de ${a.totalCoords} coord.)`);
    }
  }

  if (DRY_RUN) {
    console.log("");
    console.log("  (DRY RUN — no se aplicó nada)");
    return;
  }

  // 6. Aplicar: PATCH FINCAS en batches de 10
  console.log("");
  console.log("→ Aplicando asignaciones...");
  const BATCH = 10;
  let aplicadas = 0, errores = 0;
  for (let i = 0; i < asignaciones.length; i += BATCH) {
    const chunk = asignaciones.slice(i, i + BATCH);
    const body = {
      records: chunk.map((a) => ({
        id: a.fincaId,
        fields: { coordinador_asignado: [a.coordinadorId] },
      })),
    };
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/FINCAS`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      aplicadas += chunk.length;
      if (i % 100 === 0) process.stdout.write(`\r  ${aplicadas}/${asignaciones.length}`);
    } else {
      const err = await res.text();
      console.error(`\n[batch ${i}] ${err}`);
      errores++;
    }
    if (i + BATCH < asignaciones.length) await sleep(250);
  }
  console.log("");
  console.log("");
  console.log("─── Resultado ───");
  console.log(`  Asignaciones aplicadas: ${aplicadas}`);
  console.log(`  Batches con error:      ${errores}`);
})();
