/**
 * scripts/corregir-fusiones-fase2.js
 *
 * FASE 2 de la corrección de fusiones erróneas de fincas
 * (ver memory/project_fusion_fincas_erronea.md).
 *
 * A diferencia de la Fase 1 (par-por-par según el CSV), aquí el enfoque es
 * PDF-puro y resuelve los casos multi-finca y las cadenas:
 *   - Toma una lista de FINCAS que aún MEZCLAN certificados de direcciones
 *     distintas (las que quedaron con "ambiguos" en el log de Fase 1).
 *   - Para cada finca, descarga el PDF de TODOS sus certs y agrupa por la
 *     dirección impresa (verdad congelada).
 *   - La dirección que mejor coincide con el NOMBRE de la finca es la canónica
 *     (se queda). Cada OTRA dirección distinta se separa: crea finca + ubicación
 *     nuevas y mueve esos certs.
 *
 * Seguro (PDF = verdad) y reversible (log JSON con valores previos).
 * NO toca Neon.
 *
 * Uso:
 *   node scripts/corregir-fusiones-fase2.js                 # DRY-RUN
 *   node scripts/corregir-fusiones-fase2.js --apply
 *   node scripts/corregir-fusiones-fase2.js --fincas=/tmp/fase2-fincas.txt
 *   node scripts/corregir-fusiones-fase2.js --finca=recXXXX  # una sola
 */

require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
if (!API_KEY || !BASE_ID) {
  console.error("Faltan AIRTABLE_API_KEY / AIRTABLE_BASE_ID");
  process.exit(1);
}

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes("--apply");
const FINCAS_FILE = (ARGS.find((a) => a.startsWith("--fincas=")) || "").split("=")[1] || "/tmp/fase2-fincas.txt";
const FINCA_ONE = (ARGS.find((a) => a.startsWith("--finca=")) || "").split("=")[1] || null;

const TMP = "/tmp/fix-fincas2";
fs.mkdirSync(TMP, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function at(method, pathUrl, body) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}${pathUrl}`, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${pathUrl} → ${res.status} ${await res.text()}`);
  return res.json();
}

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function prefixScore(aNorm, bNorm) {
  const a = aNorm.split(" ").filter(Boolean), b = bNorm.split(" ").filter(Boolean);
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i;
}

// Nombre de finca = tokens tras la última aparición de "finca" (ej.
// "km 5 via ... finca garzonas" → "garzonas"). null si no hay "finca".
function nombreFincaDe(nrm) {
  const t = nrm.split(" ").filter(Boolean);
  let idx = -1;
  for (let i = 0; i < t.length; i++) if (t[i] === "finca") idx = i;
  if (idx === -1 || idx === t.length - 1) return null;
  return t.slice(idx + 1).join(" ");
}

// ¿Dos direcciones (normalizadas) son la MISMA finca escrita distinto?
//  - una es prefijo fuerte de la otra (truncamiento del PDF), o
//  - ambas mencionan el mismo "nombre de finca".
function mismaFinca(a, b) {
  if (a === b) return true;
  const ta = a.split(" ").filter(Boolean), tb = b.split(" ").filter(Boolean);
  const pre = prefixScore(a, b);
  if (pre >= 3 && pre >= Math.min(ta.length, tb.length) * 0.6) return true;
  const na = nombreFincaDe(a), nb = nombreFincaDe(b);
  if (na && nb && na === nb) return true;
  return false;
}

// Clusteriza direcciones (union-find) en grupos = misma finca real.
function clusterizar(dirsNorm) {
  const parent = {};
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (x, y) => { parent[find(x)] = find(y); };
  for (const d of dirsNorm) parent[d] = d;
  for (let i = 0; i < dirsNorm.length; i++)
    for (let j = i + 1; j < dirsNorm.length; j++)
      if (mismaFinca(dirsNorm[i], dirsNorm[j])) union(dirsNorm[i], dirsNorm[j]);
  const clusters = {};
  for (const d of dirsNorm) (clusters[find(d)] = clusters[find(d)] || []).push(d);
  return Object.values(clusters);
}
function dirDesdePdf(pdfUrl, tag) {
  const f = path.join(TMP, `${tag}.pdf`);
  try {
    execSync(`curl -s -o "${f}" "${pdfUrl}"`, { stdio: "ignore" });
    const txt = execSync(`pdftotext -layout "${f}" - 2>/dev/null`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    const line = txt.split("\n").find((l) => /Direcci.n\/Finca/i.test(l));
    if (!line) return null;
    let v = line.replace(/.*Direcci.n\/Finca/i, "").split(/Cultivo:/i)[0];
    return v.replace(/\s+/g, " ").trim();
  } catch { return null; } finally { try { fs.unlinkSync(f); } catch {} }
}

async function main() {
  let fincaIds;
  if (FINCA_ONE) fincaIds = [FINCA_ONE];
  else fincaIds = fs.readFileSync(FINCAS_FILE, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);

  console.log(`\n=== Fase 2: separar fincas que mezclan direcciones (PDF-puro) ===`);
  console.log(`Modo: ${APPLY ? "APPLY (escribe)" : "DRY-RUN"} | fincas objetivo: ${fincaIds.length}\n`);

  const log = { startedAt: new Date().toISOString(), apply: APPLY, fincas: [] };
  let totFincasNuevas = 0, totMovidos = 0, totSinPdf = 0, fincasLimpias = 0;

  for (const fincaId of fincaIds) {
    let finca;
    try { finca = await at("GET", `/FINCAS/${fincaId}`); }
    catch (e) { console.log(`\n⚠️  Finca ${fincaId} no existe — skip`); continue; }
    const ff = finca.fields;
    const generadorId = (ff.generador || [])[0];
    const municipioId = (ff.municipio || [])[0];
    const certIds = ff.Certificados || [];
    const nombreFinca = ff.nombre || "";
    console.log(`\n────────────────────────────────────────`);
    console.log(`Finca ${fincaId} "${nombreFinca}" | gen ${generadorId || "—"} | ${certIds.length} certs`);
    if (!generadorId) { console.log(`  ⚠️ sin generador — skip`); continue; }

    // 1. Agrupar certs por dirección impresa en el PDF
    const grupos = new Map(); // normDir → { dirRaw, certs:[{cid,cons}] }
    const sinPdf = [];
    let ubicPlantillaId = null;
    for (const cid of certIds) {
      const cert = await at("GET", `/Certificados/${cid}`);
      const cons = cert.fields.consecutivo;
      if (!ubicPlantillaId) ubicPlantillaId = (cert.fields.link_ubicacion || [])[0] || null;
      const att = (cert.fields.certificadopdf || [])[0];
      if (!att) { sinPdf.push({ cid, cons }); continue; }
      const dirPdf = dirDesdePdf(att.url, cid);
      const nd = norm(dirPdf);
      if (!nd) { sinPdf.push({ cid, cons, dirPdf }); continue; }
      if (!grupos.has(nd)) grupos.set(nd, { dirRaw: dirPdf, certs: [] });
      grupos.get(nd).certs.push({ cid, cons });
      await sleep(50);
    }

    const fincaLog = { fincaId, nombreFinca, generadorId, grupos: [], sinPdf, movidos: [] };
    totSinPdf += sinPdf.length;

    // Clusterizar: une truncados del PDF y formas corto/largo de la misma finca.
    const clusters = clusterizar([...grupos.keys()]);
    const gruposFinales = clusters.map((cl) => {
      let dirRaw = "", maxLen = -1; const certs = [];
      for (const nd of cl) {
        const g = grupos.get(nd);
        certs.push(...g.certs);
        if (g.dirRaw.length > maxLen) { maxLen = g.dirRaw.length; dirRaw = g.dirRaw; }
      }
      return { key: norm(dirRaw), dirRaw, certs };
    });

    if (gruposFinales.length <= 1) {
      console.log(`  ✓ Homogénea (1 finca real). Nada que separar.${sinPdf.length ? ` (${sinPdf.length} sin PDF legible)` : ""}`);
      fincasLimpias++;
      log.fincas.push(fincaLog);
      continue;
    }

    // Dirección canónica = la que mejor coincide con el nombre de la finca
    const nf = norm(nombreFinca);
    let canonKey = null, mejor = -1;
    for (const g of gruposFinales) {
      const score = prefixScore(g.key, nf) * 1000 + g.certs.length;
      if (score > mejor) { mejor = score; canonKey = g.key; }
    }
    console.log(`  Fincas reales detectadas: ${gruposFinales.length}`);
    for (const g of gruposFinales) {
      console.log(`    ${g.key === canonKey ? "✔ CANÓNICA " : "→ separar  "} "${g.dirRaw}" (${g.certs.length} certs: ${g.certs.map((c) => "#" + c.cons).slice(0, 6).join(",")}${g.certs.length > 6 ? "…" : ""})`);
    }
    if (sinPdf.length) console.log(`    ⚠️ ${sinPdf.length} certs sin PDF legible (no se tocan)`);

    // Plantilla de ubicación (de los certs actuales) para heredar datos del generador
    let ubicPlantilla = null;
    if (ubicPlantillaId) { try { ubicPlantilla = await at("GET", `/ubicaciones/${ubicPlantillaId}`); } catch {} }

    for (const g of gruposFinales) {
      if (g.key === canonKey) continue;
      fincaLog.grupos.push({ dir: g.dirRaw, certs: g.certs });
      if (!APPLY) {
        console.log(`  [DRY] Crearía finca "${g.dirRaw}" y movería ${g.certs.length} cert(s).`);
        totFincasNuevas++; totMovidos += g.certs.length;
        continue;
      }
      // Crear finca nueva
      const nuevaFinca = await at("POST", `/FINCAS`, {
        fields: {
          nombre: g.dirRaw,
          generador: [generadorId],
          ...(municipioId ? { municipio: [municipioId] } : {}),
          ...(ff.cultivos ? { cultivos: ff.cultivos } : {}),
          ...(ff.movil ? { movil: ff.movil } : {}),
          ...(ff.email ? { email: ff.email } : {}),
          ...(ff.coordinador_asignado ? { coordinador_asignado: ff.coordinador_asignado } : {}),
          estado: "aprobado",
        }, typecast: true,
      });
      // Crear ubicación nueva (para que los lookups del cert sean correctos)
      let nuevaUbicId = null;
      if (ubicPlantilla) {
        const up = ubicPlantilla.fields;
        const nu = await at("POST", `/ubicaciones`, {
          fields: {
            direcciongenerador: g.dirRaw,
            nombregenerador: up.nombregenerador,
            cedulagenerador: up.cedulagenerador,
            cultivogenerador: up.cultivogenerador,
            movilgenerador: up.movilgenerador,
            emailgenerador: up.emailgenerador,
            tipogenerador: up.tipogenerador,
            ...(up.CODIGOMUN ? { CODIGOMUN: up.CODIGOMUN } : {}),
            finca: [nuevaFinca.id],
          }, typecast: true,
        });
        nuevaUbicId = nu.id;
      }
      console.log(`  ✓ Finca ${nuevaFinca.id} + ubicación ${nuevaUbicId || "(sin plantilla)"} — "${g.dirRaw}"`);
      for (const c of g.certs) {
        const cert = await at("GET", `/Certificados/${c.cid}`);
        const prev = { cid: c.cid, cons: c.cons, FINCAS: cert.fields.FINCAS || [], link_ubicacion: cert.fields.link_ubicacion || [] };
        const fields = { FINCAS: [nuevaFinca.id] };
        if (nuevaUbicId) fields.link_ubicacion = [nuevaUbicId];
        await at("PATCH", `/Certificados/${c.cid}`, { fields, typecast: true });
        fincaLog.movidos.push({ ...prev, nuevaFinca: nuevaFinca.id, nuevaUbic: nuevaUbicId });
        await sleep(70);
      }
      totFincasNuevas++; totMovidos += g.certs.length;
    }
    log.fincas.push(fincaLog);
  }

  log.finishedAt = new Date().toISOString();
  console.log(`\n=== RESUMEN Fase 2 ===`);
  console.log(`Fincas objetivo: ${fincaIds.length} | ya limpias: ${fincasLimpias}`);
  console.log(`Fincas nuevas a crear: ${totFincasNuevas} | certs a mover: ${totMovidos} | certs sin PDF (no tocados): ${totSinPdf}`);
  if (APPLY) {
    const lp = `docs/correccion-fusiones-fase2-log-${Date.now()}.json`;
    fs.writeFileSync(lp, JSON.stringify(log, null, 2));
    console.log(`Log reversible: ${lp}`);
  }
  console.log("");
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
