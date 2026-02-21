/**
 * Script de migración: CSV sistema viejo → Neon PostgreSQL
 * PDFs ya están en R2 (subidos via rclone desde DO)
 *
 * Uso:
 *   npx tsx backup/migrate-csv.ts --test     # Solo 10 registros
 *   npx tsx backup/migrate-csv.ts --full     # Completo (16,842 registros)
 */

import { config } from "dotenv";
import { Client } from "pg";
import { createReadStream } from "fs";
import { parse } from "csv-parse";

config({ path: ".env.local" });

const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL!;
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ||
  "https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev";

const CSV_PATH = "backup/old/certificados_campolimpio.csv";
const isTest = process.argv.includes("--test");
const CONCURRENCY = 20;

interface CsvRow {
  "consecutivo ": string; // Note: has trailing space in header
  tipocertificado: string;
  nombregenerador: string;
  cedulagenerador: string;
  movilgenerador: string;
  direcciongenerador: string;
  cultivogenerador: string;
  emailgenerador: string;
  municipiogenerador: string;
  rigidos: string;
  flexibles: string;
  metalicos: string;
  embalaje: string;
  totalentregado: string;
  triplelavado: string;
  lugardevolucion: string;
  municipiodevolucion: string;
  fechadevolucion: string;
  fechageneracion: string;
  observaciones: string;
  nombrecoordinador: string;
  movilcoordinador: string;
  emailcoordinador: string;
  fech: string;
}

async function readCsv(limit?: number): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CsvRow[] = [];
    const parser = createReadStream(CSV_PATH).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
    );

    parser.on("data", (row: CsvRow) => {
      rows.push(row);
      if (limit && rows.length >= limit) {
        parser.destroy();
        resolve(rows);
      }
    });

    parser.on("end", () => resolve(rows));
    parser.on("error", reject);
  });
}

async function insertFromCsv(client: Client, row: CsvRow) {
  const num = (val: string) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  };

  // Get consecutivo (trim any whitespace from key)
  const consecutivoRaw = row["consecutivo "] || (row as Record<string, string>)["consecutivo"];
  const consecutivo = parseInt(consecutivoRaw);
  const ano = parseInt(row.fech) || null;

  let fechadevolucion: string | null = null;
  if (row.fechadevolucion) {
    const d = new Date(row.fechadevolucion);
    if (!isNaN(d.getTime())) {
      fechadevolucion = d.toISOString().split("T")[0];
    }
  }

  let fechageneracion: string | null = null;
  if (row.fechageneracion) {
    const d = new Date(row.fechageneracion);
    if (!isNaN(d.getTime())) {
      fechageneracion = d.toISOString();
    }
  }

  // PDF URL — may or may not exist in R2 (only ~92 from this range are in DO/R2)
  const pdfFilename = `certificado_${consecutivo}.pdf`;
  const r2Url = `${R2_PUBLIC_URL}/pdfs/${pdfFilename}`;

  await client.query(
    `INSERT INTO certificados (
      airtable_id, consecutivo,
      nombregenerador, cedulagenerador, emailgenerador, movilgenerador,
      tipogenerador, cultivogenerador, direcciongenerador, municipiogenerador,
      nombrecoordinador, movilcoordinador, emailcoordinador,
      fechadevolucion, lugardevolucion, municipiodevolucion,
      rigidos, flexibles, metalicos, embalaje, total,
      triplelavado, ano,
      fechageneracion, observaciones,
      certificadopdf_filename, certificadopdf_r2_url,
      fuente
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
    ) ON CONFLICT (airtable_id) DO NOTHING`,
    [
      `csv-${consecutivo}`,
      consecutivo,
      row.nombregenerador || null,
      row.cedulagenerador || null,
      row.emailgenerador || null,
      row.movilgenerador || null,
      row.tipocertificado || null,
      row.cultivogenerador || null,
      row.direcciongenerador || null,
      row.municipiogenerador || null,
      row.nombrecoordinador || null,
      row.movilcoordinador || null,
      row.emailcoordinador || null,
      fechadevolucion,
      row.lugardevolucion || null,
      row.municipiodevolucion || null,
      num(row.rigidos),
      num(row.flexibles),
      num(row.metalicos),
      num(row.embalaje),
      num(row.totalentregado),
      row.triplelavado || null,
      ano,
      fechageneracion,
      row.observaciones || null,
      pdfFilename,
      r2Url,
      "csv",
    ]
  );
}

async function main() {
  console.log(
    `\n=== Migración CSV ${isTest ? "(PRUEBA - 10)" : "(COMPLETA)"} ===\n`
  );

  console.log("1. Leyendo CSV...");
  const rows = await readCsv(isTest ? 10 : undefined);
  console.log(`   Total: ${rows.length} registros\n`);

  console.log("2. Conectando a Neon...");
  const pgClient = new Client({ connectionString: NEON_DATABASE_URL });
  await pgClient.connect();
  console.log("   ✓ Conectado\n");

  console.log(`3. Insertando (concurrencia: ${CONCURRENCY})...\n`);
  let totalSuccess = 0;
  let totalErrors = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (row) => {
      try {
        await insertFromCsv(pgClient, row);
        totalSuccess++;
      } catch (err) {
        totalErrors++;
        const cons = row["consecutivo "] || (row as Record<string, string>)["consecutivo"];
        console.error(`   ✗ Error #${cons}: ${err}`);
      }
    });
    await Promise.all(promises);

    if ((i + batch.length) % 500 === 0 || i + batch.length === rows.length) {
      const pct = Math.round(((i + batch.length) / rows.length) * 100);
      console.log(
        `   [${i + batch.length}/${rows.length}] ${pct}% — ${totalSuccess} ok, ${totalErrors} err`
      );
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`   Insertados: ${totalSuccess}`);
  console.log(`   Errores:    ${totalErrors}`);

  const count = await pgClient.query(
    "SELECT fuente, COUNT(*) FROM certificados GROUP BY fuente ORDER BY fuente"
  );
  console.log("   En Neon:");
  count.rows.forEach((r: { fuente: string; count: string }) =>
    console.log(`     ${r.fuente}: ${r.count}`)
  );

  const total = await pgClient.query("SELECT COUNT(*) FROM certificados");
  console.log(`   Total: ${total.rows[0].count}`);

  await pgClient.end();
  console.log("\n✓ Migración CSV completada\n");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
