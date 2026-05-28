/**
 * Detecta y opcionalmente fusiona generadores con mismo nombre y mismo NIT
 * base (9 dígitos), donde un registro tiene el NIT con guión-DV
 * (`123456789-0`) y el otro sin guión (`123456789`).
 *
 * Criterio para elegir el SOBREVIVIENTE:
 *   1. El que tenga más FINCAS vinculadas.
 *   2. Si empatan, el que tenga formato con guión-DV (más completo).
 *   3. Si empatan, el más antiguo (createdTime).
 *
 * Modos:
 *   node scripts/fusionar-generadores-nit-con-sin-dv.js              # dry-run
 *   node scripts/fusionar-generadores-nit-con-sin-dv.js --aplicar    # aplica
 *
 * Reusa el endpoint /api/revisiones/generadores/merge mediante llamadas
 * directas a Airtable (PATCH FINCAS.generador + DELETE del duplicado).
 */

require("dotenv").config({ path: ".env.local" });

const KEY = process.env.AIRTABLE_API_KEY;
const BASE = process.env.AIRTABLE_BASE_ID;
const APLICAR = process.argv.includes("--aplicar");

if (!KEY || !BASE) {
  console.error("Faltan AIRTABLE_API_KEY / AIRTABLE_BASE_ID en .env.local");
  process.exit(1);
}

function normalizarNombre(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function digitos(s) {
  return String(s || "").replace(/[^0-9]/g, "");
}

function tieneGuion(s) {
  return /\d-\d/.test(String(s || ""));
}

async function listarTodosGeneradores() {
  let all = [];
  let offset;
  do {
    const p = new URLSearchParams();
    p.set("pageSize", "100");
    for (const f of ["nombre", "nit", "tipopersona", "FINCAS"])
      p.append("fields[]", f);
    if (offset) p.set("offset", offset);
    const r = await fetch(
      `https://api.airtable.com/v0/${BASE}/GENERADORES?${p}`,
      { headers: { Authorization: `Bearer ${KEY}` } }
    );
    const d = await r.json();
    all.push(...(d.records || []));
    offset = d.offset;
  } while (offset);
  return all;
}

async function patchFincasGenerador(fincaIds, survivorId) {
  const BATCH = 10;
  for (let i = 0; i < fincaIds.length; i += BATCH) {
    const chunk = fincaIds.slice(i, i + BATCH);
    const body = {
      records: chunk.map((id) => ({
        id,
        fields: { generador: [survivorId] },
      })),
      typecast: false,
    };
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/FINCAS`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      throw new Error(`PATCH FINCAS: ${r.status} ${await r.text()}`);
    }
    if (i + BATCH < fincaIds.length) await new Promise((res) => setTimeout(res, 250));
  }
}

async function listarFincasDelGen(genId, genNombre) {
  // Usar FIND por nombre del primary del generador (linked record en formula → display, no id)
  // Más confiable: usar campo lookup si existe, sino comparar después de traer
  const formula = `FIND("${genNombre.replace(/"/g, '\\"')}", ARRAYJOIN({generador}&""))>0`;
  const p = new URLSearchParams();
  p.set("filterByFormula", formula);
  p.append("fields[]", "generador");
  p.set("pageSize", "100");
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/FINCAS?${p}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const d = await r.json();
  // Filtrar por id real
  return (d.records || [])
    .filter((rec) =>
      Array.isArray(rec.fields.generador) &&
      rec.fields.generador.includes(genId)
    )
    .map((rec) => rec.id);
}

async function eliminarGenerador(id) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/GENERADORES/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`DELETE: ${r.status} ${await r.text()}`);
}

(async () => {
  console.log(APLICAR ? "MODO APLICAR" : "MODO DRY-RUN");
  console.log("Cargando todos los generadores…");
  const all = await listarTodosGeneradores();
  console.log(`  ${all.length} generadores cargados.\n`);

  // Indexar por (nombre normalizado + base 9 dígitos)
  const byKey = new Map();
  for (const g of all) {
    const name = normalizarNombre(g.fields.nombre);
    const d = digitos(g.fields.nit);
    if (!name || !d) continue;
    // Tomar SOLO base de 9 dígitos: típico NIT colombiano. Cédulas naturales
    // suelen ser 6-10 dígitos. Para no clasificar erróneamente cédulas, exigimos
    // que sea persona Jurídica O que el NIT tenga 9 o 10 dígitos con guion-DV en alguno.
    const tipo = g.fields.tipopersona;
    let base;
    if (d.length === 9) base = d;
    else if (d.length === 10) base = d.slice(0, 9); // asumimos DV pegado
    else continue;
    const key = `${name}::${base}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(g);
  }

  // Encontrar pares con MISMO key y donde haya combinación con/sin guión-DV
  const planes = [];
  for (const [key, arr] of byKey) {
    if (arr.length < 2) continue;
    const formatos = arr.map((g) => ({
      g,
      raw: String(g.fields.nit || ""),
      digits: digitos(g.fields.nit),
      conGuion: tieneGuion(g.fields.nit),
      fincas: (g.fields.FINCAS || []).length,
    }));
    // Caso seguro: hay al menos uno con guión Y al menos uno sin guión
    const conG = formatos.filter((f) => f.conGuion);
    const sinG = formatos.filter((f) => !f.conGuion);
    if (conG.length === 0 || sinG.length === 0) continue;

    // Elegir sobreviviente: más fincas; si empate, el conGuion; si empate, más viejo
    const sorted = [...formatos].sort((a, b) => {
      if (b.fincas !== a.fincas) return b.fincas - a.fincas;
      if (a.conGuion !== b.conGuion) return a.conGuion ? -1 : 1;
      return (
        new Date(a.g.createdTime).getTime() -
        new Date(b.g.createdTime).getTime()
      );
    });
    const survivor = sorted[0];
    const duplicates = sorted.slice(1);
    planes.push({ key, survivor, duplicates, todos: formatos });
  }

  console.log(`Pares detectados: ${planes.length}\n`);
  for (const p of planes) {
    console.log(`▶ ${p.survivor.g.fields.nombre}`);
    console.log(
      `  SOBREVIVIENTE: ${p.survivor.g.id} | nit:"${p.survivor.raw}" | fincas:${p.survivor.fincas}`
    );
    for (const d of p.duplicates) {
      console.log(
        `  ELIMINAR:     ${d.g.id} | nit:"${d.raw}" | fincas:${d.fincas} → reasignar a sobreviviente`
      );
    }
    console.log("");
  }

  if (!APLICAR) {
    console.log("Dry-run. Para aplicar usa --aplicar.");
    return;
  }

  // Aplicar
  console.log("=== APLICANDO MERGES ===\n");
  let totalFincasMovidas = 0;
  let totalEliminados = 0;
  for (const p of planes) {
    const survivor = p.survivor.g;
    for (const dup of p.duplicates) {
      try {
        console.log(`Fusionando ${dup.g.id} → ${survivor.id}…`);
        const fincaIds = await listarFincasDelGen(
          dup.g.id,
          dup.g.fields.nombre
        );
        console.log(`  ${fincaIds.length} fincas a reasignar.`);
        if (fincaIds.length > 0) {
          await patchFincasGenerador(fincaIds, survivor.id);
          totalFincasMovidas += fincaIds.length;
          console.log(`  ✓ Fincas reasignadas.`);
        }
        await eliminarGenerador(dup.g.id);
        totalEliminados++;
        console.log(`  ✓ Generador duplicado eliminado.\n`);
      } catch (err) {
        console.error(`  ✗ ERROR en este merge:`, err.message);
        console.error("  Continuando con los siguientes…\n");
      }
    }
  }

  console.log("=== RESUMEN ===");
  console.log(`Fincas reasignadas: ${totalFincasMovidas}`);
  console.log(`Generadores duplicados eliminados: ${totalEliminados}`);
})().catch((err) => {
  console.error("ERROR FATAL:", err);
  process.exit(1);
});
