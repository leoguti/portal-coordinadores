/**
 * scripts/fusionar-generadores-duplicados.js
 *
 * Detecta GENERADORES duplicados (mismo prefijo NIT — ignorando último dígito de verificación)
 * y los fusiona: reasigna todas las FINCAS al sobreviviente y elimina los duplicados.
 *
 * Regla para elegir sobreviviente:
 *   1. El que tiene más fincas
 *   2. Si hay empate: el que tiene nombre más completo
 *   3. Si hay empate: el primero creado (createdTime)
 *
 * Uso:
 *   node scripts/fusionar-generadores-duplicados.js --dry    # solo imprime, no modifica
 *   node scripts/fusionar-generadores-duplicados.js          # ejecuta
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

function nitPrefix(nit) {
  const d = (nit || "").replace(/\D/g, "");
  return d.length >= 5 ? d.slice(0, -1) : "";
}

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

async function updateFincasBatch(fincaIds, survivorGeneradorId) {
  const BATCH = 10;
  for (let i = 0; i < fincaIds.length; i += BATCH) {
    const chunk = fincaIds.slice(i, i + BATCH);
    const body = {
      records: chunk.map((id) => ({ id, fields: { generador: [survivorGeneradorId] } })),
    };
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/FINCAS`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`error PATCH fincas: ${err}`);
    }
    if (i + BATCH < fincaIds.length) await sleep(250);
  }
}

async function deleteGeneradores(ids) {
  // Airtable permite DELETE en batch con records[] querystring hasta 10
  const BATCH = 10;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const qs = chunk.map((id) => `records[]=${id}`).join("&");
    const url = `https://api.airtable.com/v0/${BASE_ID}/GENERADORES?${qs}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`error DELETE GENERADORES: ${err}`);
    }
    if (i + BATCH < ids.length) await sleep(250);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log(DRY_RUN ? "🧪 DRY RUN — no se modifica nada" : "⚙️  Modo real — se modifican registros en Airtable");
  console.log("");

  // 1. Traer todos los GENERADORES
  console.log("→ Cargando GENERADORES...");
  const generadores = await fetchAll("GENERADORES", ["nombre", "nit", "tipo", "FINCAS"]);
  console.log(`  ${generadores.length} generadores`);

  // 2. Agrupar por prefijo NIT
  const gruposByPrefix = new Map();
  for (const g of generadores) {
    const nit = g.fields?.nit || "";
    const key = nitPrefix(nit);
    if (!key) continue;
    if (!gruposByPrefix.has(key)) gruposByPrefix.set(key, []);
    gruposByPrefix.get(key).push(g);
  }

  // 3. Filtrar grupos con duplicados
  const gruposConDupes = Array.from(gruposByPrefix.entries()).filter(([_, arr]) => arr.length > 1);
  console.log(`  ${gruposConDupes.length} prefijos NIT con duplicados`);
  const totalDupes = gruposConDupes.reduce((sum, [, arr]) => sum + (arr.length - 1), 0);
  console.log(`  ${totalDupes} generadores duplicados a eliminar`);
  console.log("");

  if (gruposConDupes.length === 0) {
    console.log("✓ No hay duplicados — nada que hacer");
    return;
  }

  // 4. Procesar cada grupo
  let totalEliminados = 0;
  let totalFincasReasignadas = 0;
  let errores = 0;

  for (const [prefix, group] of gruposConDupes) {
    // Elegir sobreviviente:
    // orden: por cantidad de fincas desc, luego nombre más largo, luego createdTime asc
    const sorted = [...group].sort((a, b) => {
      const aFincas = (a.fields.FINCAS || []).length;
      const bFincas = (b.fields.FINCAS || []).length;
      if (aFincas !== bFincas) return bFincas - aFincas;
      const aNombre = (a.fields.nombre || "").length;
      const bNombre = (b.fields.nombre || "").length;
      if (aNombre !== bNombre) return bNombre - aNombre;
      return a.createdTime.localeCompare(b.createdTime);
    });

    const survivor = sorted[0];
    const dupes = sorted.slice(1);

    console.log(`NIT prefix ${prefix} (${group.length} generadores):`);
    console.log(`  ✓ conservar: ${survivor.fields.nombre || "—"} [${survivor.id}] NIT=${survivor.fields.nit || "—"} fincas=${(survivor.fields.FINCAS || []).length}`);
    for (const d of dupes) {
      console.log(`  ✗ eliminar : ${d.fields.nombre || "—"} [${d.id}] NIT=${d.fields.nit || "—"} fincas=${(d.fields.FINCAS || []).length}`);
    }

    if (DRY_RUN) continue;

    try {
      // Reasignar fincas de cada duplicado al sobreviviente
      for (const dupe of dupes) {
        const fincaIds = dupe.fields.FINCAS || [];
        if (fincaIds.length > 0) {
          await updateFincasBatch(fincaIds, survivor.id);
          totalFincasReasignadas += fincaIds.length;
        }
      }
      // Eliminar todos los duplicados del grupo
      await deleteGeneradores(dupes.map((d) => d.id));
      totalEliminados += dupes.length;
      console.log(`  ✓ fusionado`);
    } catch (e) {
      errores++;
      console.error(`  ✗ error: ${e.message}`);
    }

    // Respetar rate limit global
    await sleep(300);
  }

  console.log("");
  console.log("─── Resumen ────────────────────────────");
  console.log(`  Generadores eliminados:   ${totalEliminados}`);
  console.log(`  Fincas reasignadas:       ${totalFincasReasignadas}`);
  console.log(`  Errores:                  ${errores}`);
  console.log(DRY_RUN ? "  (DRY RUN — nada se aplicó)" : "  ✓ aplicado");
})();
