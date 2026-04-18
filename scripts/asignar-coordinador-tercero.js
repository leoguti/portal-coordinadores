/**
 * scripts/asignar-coordinador-tercero.js
 *
 * Inicializa Terceros.coordinador_responsable con el coordinador que más
 * Órdenes de Servicio ha hecho con ese tercero (como beneficiario).
 *
 * Uso:
 *   node scripts/asignar-coordinador-tercero.js --dry
 *   node scripts/asignar-coordinador-tercero.js
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
  console.log(DRY_RUN ? "🧪 DRY RUN" : "⚙️  Modo real");
  console.log("");

  console.log("→ Cargando Terceros...");
  const terceros = await fetchAll("Terceros", ["RazonSocial", "coordinador_responsable"]);
  console.log(`  ${terceros.length} terceros`);

  console.log("→ Cargando Ordenes...");
  const ordenes = await fetchAll("Ordenes", ["Beneficiario", "Coordinador"]);
  console.log(`  ${ordenes.length} órdenes`);

  // Mapear tercero → {coordId: count}
  const counts = new Map();
  for (const ord of ordenes) {
    const tercero = ord.fields.Beneficiario?.[0];
    const coord = ord.fields.Coordinador?.[0];
    if (!tercero || !coord) continue;
    if (!counts.has(tercero)) counts.set(tercero, new Map());
    const m = counts.get(tercero);
    m.set(coord, (m.get(coord) || 0) + 1);
  }

  // Decidir asignación por tercero
  const asignaciones = [];
  let sinOrdenes = 0;
  let yaAsignados = 0;
  let ambiguos = 0;
  for (const t of terceros) {
    if ((t.fields.coordinador_responsable || []).length > 0) {
      yaAsignados++;
      continue; // respetar asignaciones ya existentes
    }
    const m = counts.get(t.id);
    if (!m || m.size === 0) {
      sinOrdenes++;
      continue;
    }
    const sorted = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    const [winnerId, winnerCount] = sorted[0];
    if (m.size > 1) ambiguos++;
    asignaciones.push({
      terceroId: t.id,
      razonSocial: t.fields.RazonSocial || "—",
      coordinadorId: winnerId,
      count: winnerCount,
      coordinadoresDistintos: m.size,
    });
  }

  console.log("");
  console.log("─── Análisis ───");
  console.log(`  Terceros total:              ${terceros.length}`);
  console.log(`  Ya asignados (se respetan):  ${yaAsignados}`);
  console.log(`  Sin órdenes (sin inferir):   ${sinOrdenes}`);
  console.log(`  A asignar:                   ${asignaciones.length}`);
  console.log(`  Ambiguos (>1 coord):         ${ambiguos} (se asigna al de más órdenes)`);
  console.log("");

  // Distribución
  const byCoord = new Map();
  for (const a of asignaciones) byCoord.set(a.coordinadorId, (byCoord.get(a.coordinadorId) || 0) + 1);
  console.log("Distribución — terceros por coordinador:");
  for (const [cid, n] of Array.from(byCoord.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${cid}`);
  }

  if (ambiguos > 0) {
    console.log("");
    console.log("Ejemplos ambiguos:");
    for (const a of asignaciones.filter((x) => x.coordinadoresDistintos > 1).slice(0, 5)) {
      console.log(`  ${a.razonSocial.slice(0, 30).padEnd(30)} → ${a.coordinadorId} (${a.count} de ${a.coordinadoresDistintos} coord.)`);
    }
  }

  if (DRY_RUN) {
    console.log("");
    console.log("  (DRY RUN — nada aplicado)");
    return;
  }

  console.log("");
  console.log("→ Aplicando...");
  const BATCH = 10;
  let ok = 0, err = 0;
  for (let i = 0; i < asignaciones.length; i += BATCH) {
    const chunk = asignaciones.slice(i, i + BATCH);
    const body = {
      records: chunk.map((a) => ({
        id: a.terceroId,
        fields: { coordinador_responsable: [a.coordinadorId] },
      })),
    };
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/Terceros`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { ok += chunk.length; process.stdout.write(`\r  ${ok}/${asignaciones.length}`); }
    else { console.error(`\n[batch ${i}]`, await res.text()); err++; }
    if (i + BATCH < asignaciones.length) await sleep(250);
  }
  console.log("");
  console.log("");
  console.log("─── Resultado ───");
  console.log(`  Asignaciones aplicadas: ${ok}`);
  console.log(`  Errores:                ${err}`);
})();
