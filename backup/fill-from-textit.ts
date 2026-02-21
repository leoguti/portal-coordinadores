/**
 * Rellena registros drive-solo-pdf en Neon con datos de TextIt archives.
 *
 * 1. Descarga todos los archivos de runs de TextIt
 * 2. Extrae runs de certificados con consecutivo
 * 3. Actualiza registros drive-solo-pdf en Neon
 *
 * Uso:
 *   npx tsx backup/fill-from-textit.ts --test     # Solo muestra stats, no actualiza
 *   npx tsx backup/fill-from-textit.ts --full     # Actualiza Neon
 */

import { config } from "dotenv";
import { Client } from "pg";
import { createGunzip } from "zlib";
import { Readable } from "stream";
import { createInterface } from "readline";

config({ path: ".env.local" });

const TEXTIT_TOKEN = process.argv[2] === "--token" ? process.argv[3] : "bfe6fe930e078ddfeac32f8ebccbf2428d0f43e0";
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL!;
const isTest = process.argv.includes("--test");
const BATCH_SIZE = 200;

interface TextItValue {
  value: string;
  name: string;
}

interface TextItRun {
  flow: { uuid: string; name: string };
  exit_type: string;
  values: Record<string, TextItValue>;
  created_on: string;
}

interface CertData {
  consecutivo: number;
  cedulagenerador: string | null;
  rigidos: number;
  flexibles: number;
  metalicos: number;
  embalaje: number;
  triplelavado: string | null;
  fechadevolucion: string | null;
  lugardevolucion: string | null;
  municipiodevolucion: string | null;
  tipocertificado: string | null;
  observaciones: string | null;
  created_on: string;
}

function extractCertData(run: TextItRun): CertData | null {
  const v = run.values;
  if (!v.consecutivo) return null;

  const cons = parseInt(v.consecutivo.value);
  if (isNaN(cons)) return null;

  const num = (val?: TextItValue) => {
    if (!val) return 0;
    const n = parseFloat(val.value);
    return isNaN(n) ? 0 : n;
  };

  const str = (val?: TextItValue) => val?.value?.trim() || null;

  let fechadevolucion: string | null = null;
  if (v.fechadevolucion) {
    const d = new Date(v.fechadevolucion.value);
    if (!isNaN(d.getTime())) {
      fechadevolucion = d.toISOString().split("T")[0];
    }
  }

  return {
    consecutivo: cons,
    cedulagenerador: str(v.cedulagenerador),
    rigidos: num(v.rigidos),
    flexibles: num(v.flexibles),
    metalicos: num(v.metalicos),
    embalaje: num(v.embalaje),
    triplelavado: str(v.triplelavado),
    fechadevolucion,
    lugardevolucion: str(v.lugardevolucion),
    municipiodevolucion: str(v.municipiodevolucion),
    tipocertificado: str(v.tipocertificado),
    observaciones: str(v.observaciones),
    created_on: run.created_on,
  };
}

async function fetchArchiveList(): Promise<Array<{ download_url: string; start_date: string; record_count: number }>> {
  const all: Array<{ download_url: string; start_date: string; record_count: number }> = [];
  let url: string | null = "https://textit.com/api/v2/archives.json?archive_type=run&limit=250";

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${TEXTIT_TOKEN}` },
    });
    const data = await res.json();
    for (const a of data.results) {
      if (a.record_count > 0 && a.download_url) {
        all.push(a);
      }
    }
    url = data.next || null;
  }

  return all;
}

async function processArchive(
  downloadUrl: string,
  certMap: Map<number, CertData>
): Promise<number> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to download archive: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const gunzip = createGunzip();
  const readable = Readable.from(buffer);
  readable.pipe(gunzip);

  const rl = createInterface({ input: gunzip });
  let count = 0;

  for await (const line of rl) {
    try {
      const run: TextItRun = JSON.parse(line);
      if (run.exit_type !== "completed") continue;
      if (!run.values?.consecutivo) continue;

      const cert = extractCertData(run);
      if (!cert) continue;

      // Keep the most recent run for each consecutivo
      const existing = certMap.get(cert.consecutivo);
      if (!existing || cert.created_on > existing.created_on) {
        certMap.set(cert.consecutivo, cert);
      }
      count++;
    } catch {
      // skip malformed lines
    }
  }

  return count;
}

async function main() {
  console.log(`\n=== Relleno desde TextIt ${isTest ? "(TEST - sin escritura)" : "(FULL)"} ===\n`);

  // Step 1: Get archive list
  console.log("1. Obteniendo lista de archivos...");
  const archives = await fetchArchiveList();
  console.log(`   ${archives.length} archivos con datos\n`);

  // Step 2: Download and process all archives
  console.log("2. Descargando y procesando archivos...\n");
  const certMap = new Map<number, CertData>();
  let totalRuns = 0;

  for (let i = 0; i < archives.length; i++) {
    const a = archives[i];
    try {
      const count = await processArchive(a.download_url, certMap);
      totalRuns += count;

      if ((i + 1) % 10 === 0 || i === archives.length - 1) {
        console.log(
          `   [${i + 1}/${archives.length}] ${a.start_date} — ${totalRuns} runs certificado, ${certMap.size} consecutivos únicos`
        );
      }
    } catch (err) {
      console.error(`   ✗ Error ${a.start_date}: ${err}`);
    }
  }

  console.log(`\n   Total: ${totalRuns} runs → ${certMap.size} consecutivos únicos\n`);

  // Step 3: Connect to Neon and find drive-solo-pdf records
  console.log("3. Conectando a Neon...");
  const pgClient = new Client({ connectionString: NEON_DATABASE_URL });
  await pgClient.connect();

  const driveRecords = await pgClient.query(
    "SELECT consecutivo FROM certificados WHERE fuente = 'drive-solo-pdf' ORDER BY consecutivo"
  );
  console.log(`   ${driveRecords.rows.length} registros drive-solo-pdf\n`);

  // Step 4: Match
  let matched = 0;
  let unmatched = 0;
  const toUpdate: CertData[] = [];

  for (const row of driveRecords.rows) {
    const cons = row.consecutivo;
    const cert = certMap.get(cons);
    if (cert) {
      matched++;
      toUpdate.push(cert);
    } else {
      unmatched++;
    }
  }

  console.log(`   Match: ${matched} | Sin match: ${unmatched}\n`);

  if (isTest) {
    console.log("   (TEST — no se actualizan registros)\n");

    // Show sample
    if (toUpdate.length > 0) {
      console.log("   Ejemplo de datos a rellenar:");
      const sample = toUpdate[0];
      console.log(`     Consecutivo: ${sample.consecutivo}`);
      console.log(`     Cédula: ${sample.cedulagenerador}`);
      console.log(`     Rígidos: ${sample.rigidos} | Flexibles: ${sample.flexibles}`);
      console.log(`     Municipio: ${sample.municipiodevolucion}`);
      console.log(`     Fecha: ${sample.fechadevolucion}`);
    }

    await pgClient.end();
    console.log("\n✓ Test completado\n");
    return;
  }

  // Step 5: Update Neon in batches
  console.log(`4. Actualizando ${toUpdate.length} registros en Neon...\n`);
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (cert) => {
      try {
        const total = cert.rigidos + cert.flexibles + cert.metalicos + cert.embalaje;
        await pgClient.query(
          `UPDATE certificados SET
            cedulagenerador = COALESCE($2, cedulagenerador),
            rigidos = $3,
            flexibles = $4,
            metalicos = $5,
            embalaje = $6,
            total = $7,
            triplelavado = COALESCE($8, triplelavado),
            fechadevolucion = COALESCE($9, fechadevolucion),
            lugardevolucion = COALESCE($10, lugardevolucion),
            municipiodevolucion = COALESCE($11, municipiodevolucion),
            tipogenerador = COALESCE($12, tipogenerador),
            observaciones = COALESCE($13, observaciones),
            fuente = 'textit'
          WHERE consecutivo = $1 AND fuente = 'drive-solo-pdf'`,
          [
            cert.consecutivo,
            cert.cedulagenerador,
            cert.rigidos,
            cert.flexibles,
            cert.metalicos,
            cert.embalaje,
            total,
            cert.triplelavado,
            cert.fechadevolucion,
            cert.lugardevolucion,
            cert.municipiodevolucion,
            cert.tipocertificado,
            cert.observaciones,
          ]
        );
        updated++;
      } catch (err) {
        errors++;
        if (errors <= 10) console.error(`   ✗ #${cert.consecutivo}: ${err}`);
      }
    });
    await Promise.all(promises);

    if ((i + batch.length) % 1000 === 0 || i + batch.length === toUpdate.length) {
      const pct = Math.round(((i + batch.length) / toUpdate.length) * 100);
      console.log(`   [${i + batch.length}/${toUpdate.length}] ${pct}% — ${updated} ok, ${errors} err`);
    }
  }

  // Step 6: Summary
  console.log(`\n=== Resumen ===`);
  console.log(`   Actualizados: ${updated}`);
  console.log(`   Errores: ${errors}`);

  const byFuente = await pgClient.query(
    "SELECT fuente, COUNT(*) FROM certificados GROUP BY fuente ORDER BY fuente"
  );
  console.log("   En Neon:");
  byFuente.rows.forEach((r: { fuente: string; count: string }) =>
    console.log(`     ${r.fuente}: ${r.count}`)
  );

  const total = await pgClient.query("SELECT COUNT(*) FROM certificados");
  console.log(`   Total: ${total.rows[0].count}`);

  await pgClient.end();
  console.log("\n✓ Relleno completado\n");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
