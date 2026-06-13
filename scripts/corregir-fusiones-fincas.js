/**
 * scripts/corregir-fusiones-fincas.js
 *
 * Revierte las fusiones ERRÓNEAS de fincas distintas hechas en la depuración
 * de abril 2026 (ver memory/project_fusion_fincas_erronea.md).
 *
 * Mecanismo del daño: la depuración fusionó como "MISMA_FINCA" ubicaciones del
 * mismo generador con direcciones muy distintas (sim_direccion baja). La finca
 * "duplicada" se borró y sus certificados quedaron apuntando a la finca
 * "principal" equivocada.
 *
 * Estrategia de corrección (segura, basada en el PDF como verdad):
 *   1. Lee docs/ubicaciones_gemelos_analisis.csv, filtra FUSIONAR + sim < SIM.
 *   2. Por cada caso, mira la ubicación PRINCIPAL (superviviente) y SUS certs
 *      actuales.
 *   3. Para cada cert, descarga su PDF y lee la dirección REAL impresa
 *      (congelada al emitir). NO confía en los cert_ids del CSV (desactualizados).
 *   4. Los certs cuya dirección de PDF coincide con la dir DUPLICADA → se mueven
 *      a una FINCA + ubicación recreadas con la dirección correcta.
 *   5. Los certs cuya dirección coincide con la PRINCIPAL → se dejan.
 *   6. Si un cert no matchea ninguna → se reporta y NO se toca (revisión manual).
 *
 * Guarda un log JSON con todo lo hecho (incl. valores previos) para poder revertir.
 *
 * Uso:
 *   node scripts/corregir-fusiones-fincas.js            # DRY-RUN (no escribe)
 *   node scripts/corregir-fusiones-fincas.js --apply    # aplica
 *   node scripts/corregir-fusiones-fincas.js --max=5    # límite de casos (piloto)
 *   node scripts/corregir-fusiones-fincas.js --sim=0.3  # umbral de similitud
 *   node scripts/corregir-fusiones-fincas.js --cedula=860048015  # un solo caso
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
const MAX = Number((ARGS.find((a) => a.startsWith("--max=")) || "").split("=")[1] || 5);
const SIM = Number((ARGS.find((a) => a.startsWith("--sim=")) || "").split("=")[1] || 0.3);
const CEDULA = (ARGS.find((a) => a.startsWith("--cedula=")) || "").split("=")[1] || null;

const CSV = "docs/ubicaciones_gemelos_analisis.csv";
const TMP = "/tmp/fix-fincas";
fs.mkdirSync(TMP, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function at(method, pathUrl, body) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}${pathUrl}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${method} ${pathUrl} → ${res.status} ${t}`);
  }
  return res.json();
}

// Normaliza una dirección para comparar (minúsculas, sin tildes/espacios extra).
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Nº de tokens de prefijo común entre dos strings normalizados.
// El valor del PDF suele venir TRUNCADO (celda estrecha → wrap), así que es
// un prefijo de la dirección real. Comparamos por prefijo de tokens.
function prefixScore(aNorm, bNorm) {
  const a = aNorm.split(" ").filter(Boolean);
  const b = bNorm.split(" ").filter(Boolean);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Decide a qué finca pertenece un cert según la dirección impresa en su PDF.
 * Devuelve "dup" | "prin" | "ambiguo".
 * Regla: gana el candidato con más tokens de prefijo común, exigiendo
 * ventaja clara (>=1 token más) y un mínimo de 2 tokens coincidentes.
 */
function clasificarDir(dirPdf, dirDup, dirPrin) {
  const p = norm(dirPdf);
  if (!p) return "ambiguo";
  const sDup = prefixScore(p, norm(dirDup));
  const sPrin = prefixScore(p, norm(dirPrin));
  if (sDup >= 2 && sDup > sPrin) return "dup";
  if (sPrin >= 2 && sPrin > sDup) return "prin";
  return "ambiguo";
}

// Parser CSV simple que respeta comillas.
function parseCsv(text) {
  const rows = [];
  let i = 0, field = "", row = [], inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\n" || c === "\r") {
      if (field !== "" || row.length) { row.push(field); rows.push(row); row = []; field = ""; }
      while (text[i] === "\n" || text[i] === "\r") i++;
      continue;
    }
    field += c; i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx]])));
}

// Extrae la "Dirección/Finca" impresa en el PDF de un cert.
function dirDesdePdf(pdfUrl, tag) {
  const f = path.join(TMP, `${tag}.pdf`);
  try {
    execSync(`curl -s -o "${f}" "${pdfUrl}"`, { stdio: "ignore" });
    const txt = execSync(`pdftotext -layout "${f}" - 2>/dev/null`, {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    const line = txt.split("\n").find((l) => /Direcci.n\/Finca/i.test(l));
    if (!line) return null;
    // "  Dirección/Finca   vereda la balsa finca Fredonia   Cultivo: flores"
    let v = line.replace(/.*Direcci.n\/Finca/i, "");
    v = v.split(/Cultivo:/i)[0];
    return v.replace(/\s+/g, " ").trim();
  } catch {
    return null;
  } finally {
    try { fs.unlinkSync(f); } catch {}
  }
}

async function main() {
  console.log(`\n=== Corrección de fusiones erróneas de fincas ===`);
  console.log(`Modo: ${APPLY ? "APPLY (escribe)" : "DRY-RUN (no escribe)"} | sim<${SIM} | max=${MAX}${CEDULA ? ` | cedula=${CEDULA}` : ""}\n`);

  const filas = parseCsv(fs.readFileSync(CSV, "utf8"))
    .filter((r) => (r.accion || "").trim().toUpperCase() === "FUSIONAR")
    .filter((r) => {
      const s = parseFloat(r.sim_direccion);
      return !isNaN(s) && s < SIM;
    })
    .filter((r) => (CEDULA ? r.cedula === CEDULA : true));

  console.log(`Casos candidatos (FUSIONAR, sim<${SIM}): ${filas.length}. Procesando hasta ${MAX}.\n`);

  const log = { startedAt: new Date().toISOString(), apply: APPLY, sim: SIM, casos: [] };
  let procesados = 0;

  for (const fila of filas) {
    if (procesados >= MAX) break;
    procesados++;

    const dirDup = fila.dir_duplicado;
    const dirPrin = fila.dir_principal;
    const idPrincipal = fila.id_principal; // ubicación superviviente
    console.log(`\n────────────────────────────────────────`);
    console.log(`Caso ${procesados}: ${fila.nombre} (céd ${fila.cedula}) | sim=${fila.sim_direccion}`);
    console.log(`  Finca borrada: "${dirDup}"  ←→  Finca principal: "${dirPrin}"`);

    const casoLog = { cedula: fila.cedula, nombre: fila.nombre, dirDup, dirPrin, idPrincipal, sim: fila.sim_direccion };

    // 1. Ubicación principal (superviviente) + su finca + generador
    let ubicPrin;
    try {
      ubicPrin = await at("GET", `/ubicaciones/${idPrincipal}`);
    } catch (e) {
      console.log(`  ⚠️  Ubicación principal ${idPrincipal} no existe — skip. (${e.message.slice(0, 60)})`);
      casoLog.skipped = "ubicacion_principal_no_existe";
      log.casos.push(casoLog);
      continue;
    }
    const fincaPrincipalId = (ubicPrin.fields.finca || [])[0];
    const certIds = ubicPrin.fields.Certificados || [];
    if (!fincaPrincipalId) {
      console.log(`  ⚠️  La ubicación principal no tiene FINCA vinculada — skip.`);
      casoLog.skipped = "sin_finca_principal";
      log.casos.push(casoLog);
      continue;
    }
    const fincaPrincipal = await at("GET", `/FINCAS/${fincaPrincipalId}`);
    const generadorId = (fincaPrincipal.fields.generador || [])[0];
    const municipioId = (fincaPrincipal.fields.municipio || [])[0];
    console.log(`  Generador: ${generadorId || "—"} | Finca principal: ${fincaPrincipalId} | certs en ubicación: ${certIds.length}`);

    if (!generadorId) {
      console.log(`  ⚠️  Finca principal sin generador — skip.`);
      casoLog.skipped = "sin_generador";
      log.casos.push(casoLog);
      continue;
    }

    // 2. Clasificar cada cert por la dirección impresa en su PDF
    const normDup = norm(dirDup);
    const normPrin = norm(dirPrin);
    const aMover = [];     // certs cuyo PDF == dir duplicada
    const seQuedan = [];   // PDF == dir principal
    const ambiguos = [];   // no matchea ninguna

    for (const cid of certIds) {
      const cert = await at("GET", `/Certificados/${cid}`);
      const cons = cert.fields.consecutivo;
      const att = (cert.fields.certificadopdf || [])[0];
      if (!att) { ambiguos.push({ cid, cons, motivo: "sin_pdf" }); continue; }
      const dirPdf = dirDesdePdf(att.url, cid);
      const cls = clasificarDir(dirPdf, dirDup, dirPrin);
      if (cls === "dup") aMover.push({ cid, cons, dirPdf });
      else if (cls === "prin") seQuedan.push({ cid, cons, dirPdf });
      else ambiguos.push({ cid, cons, dirPdf, motivo: "no_match" });
      await sleep(60);
    }

    console.log(`  → Mover a finca recreada "${dirDup}": ${aMover.map((c) => "#" + c.cons).join(", ") || "(ninguno)"}`);
    console.log(`  → Se quedan en "${dirPrin}": ${seQuedan.map((c) => "#" + c.cons).join(", ") || "(ninguno)"}`);
    if (ambiguos.length) {
      console.log(`  → ⚠️ AMBIGUOS (no se tocan, revisión manual): ${ambiguos.map((c) => "#" + (c.cons || "?") + "[" + (c.dirPdf || c.motivo) + "]").join(", ")}`);
    }

    casoLog.generadorId = generadorId;
    casoLog.fincaPrincipalId = fincaPrincipalId;
    casoLog.aMover = aMover;
    casoLog.seQuedan = seQuedan;
    casoLog.ambiguos = ambiguos;

    if (aMover.length === 0) {
      console.log(`  ℹ️ Nada que mover en este caso.`);
      log.casos.push(casoLog);
      continue;
    }

    if (!APPLY) {
      console.log(`  [DRY] Crearía finca "${dirDup}" (gen ${generadorId}, mun ${municipioId || "?"}) + ubicación, y movería ${aMover.length} cert(s).`);
      log.casos.push(casoLog);
      continue;
    }

    // 3. APLICAR: crear finca + ubicación nuevas y re-vincular los certs
    const nuevaFinca = await at("POST", `/FINCAS`, {
      fields: {
        nombre: dirDup,
        generador: [generadorId],
        ...(municipioId ? { municipio: [municipioId] } : {}),
        ...(fincaPrincipal.fields.cultivos ? { cultivos: fincaPrincipal.fields.cultivos } : {}),
        ...(fincaPrincipal.fields.movil ? { movil: fincaPrincipal.fields.movil } : {}),
        ...(fincaPrincipal.fields.email ? { email: fincaPrincipal.fields.email } : {}),
        ...(fincaPrincipal.fields.coordinador_asignado ? { coordinador_asignado: fincaPrincipal.fields.coordinador_asignado } : {}),
        estado: "aprobado",
      },
      typecast: true,
    });
    console.log(`  ✓ Finca creada: ${nuevaFinca.id}`);

    const nuevaUbic = await at("POST", `/ubicaciones`, {
      fields: {
        direcciongenerador: dirDup,
        nombregenerador: ubicPrin.fields.nombregenerador,
        cedulagenerador: ubicPrin.fields.cedulagenerador,
        cultivogenerador: ubicPrin.fields.cultivogenerador,
        movilgenerador: ubicPrin.fields.movilgenerador,
        emailgenerador: ubicPrin.fields.emailgenerador,
        tipogenerador: ubicPrin.fields.tipogenerador,
        ...(ubicPrin.fields.CODIGOMUN ? { CODIGOMUN: ubicPrin.fields.CODIGOMUN } : {}),
        finca: [nuevaFinca.id],
      },
      typecast: true,
    });
    console.log(`  ✓ Ubicación creada: ${nuevaUbic.id}`);

    casoLog.nuevaFincaId = nuevaFinca.id;
    casoLog.nuevaUbicId = nuevaUbic.id;
    casoLog.movidos = [];

    for (const c of aMover) {
      // Guardar valores previos para revertir
      const cert = await at("GET", `/Certificados/${c.cid}`);
      const prev = {
        cid: c.cid,
        cons: c.cons,
        FINCAS: cert.fields.FINCAS || [],
        link_ubicacion: cert.fields.link_ubicacion || [],
      };
      await at("PATCH", `/Certificados/${c.cid}`, {
        fields: { FINCAS: [nuevaFinca.id], link_ubicacion: [nuevaUbic.id] },
        typecast: true,
      });
      casoLog.movidos.push(prev);
      console.log(`    ✓ cert #${c.cons} → finca nueva`);
      await sleep(80);
    }

    log.casos.push(casoLog);
  }

  log.finishedAt = new Date().toISOString();
  const logPath = `docs/correccion-fusiones-log-${Date.now()}.json`;
  if (APPLY) {
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    console.log(`\n✅ Log de cambios (para revertir): ${logPath}`);
  }
  console.log(`\n=== Fin. Casos procesados: ${procesados} ===\n`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
