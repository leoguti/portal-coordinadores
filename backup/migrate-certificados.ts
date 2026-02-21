/**
 * Script de migración: Certificados Airtable → Neon PostgreSQL
 * PDFs se suben por separado vía rclone (DO → R2)
 *
 * Uso:
 *   npx tsx backup/migrate-certificados.ts --test     # Solo 10 registros (prueba)
 *   npx tsx backup/migrate-certificados.ts --full     # Migración completa (2021-2024)
 *
 * Requisitos en .env.local:
 *   AIRTABLE_API_KEY, AIRTABLE_BASE_ID
 *   NEON_DATABASE_URL
 */

import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });

// --- Config ---
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL!;

const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ||
  "https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev";

const isTest = process.argv.includes("--test");
const MAX_YEAR = 2024; // Archivar hasta este año inclusive
const CONCURRENCY = 20; // Inserts paralelos a Neon

// --- Airtable ---
interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

async function fetchCertificados(
  limit?: number
): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  const formula = `YEAR({fechadevolucion})<=${MAX_YEAR}`;

  do {
    const params = new URLSearchParams({
      filterByFormula: formula,
      "sort[0][field]": "fechadevolucion",
      "sort[0][direction]": "asc",
      pageSize: "100",
    });
    if (offset) params.set("offset", offset);

    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados?${params.toString()}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!response.ok) {
      throw new Error(
        `Airtable error: ${response.status} ${await response.text()}`
      );
    }

    const data = await response.json();
    allRecords.push(...data.records);
    offset = data.offset;

    console.log(`  Fetched ${allRecords.length} records...`);

    if (limit && allRecords.length >= limit) {
      return allRecords.slice(0, limit);
    }
  } while (offset);

  return allRecords;
}

// --- Neon PostgreSQL ---
async function createTable(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS certificados (
      id SERIAL PRIMARY KEY,
      airtable_id TEXT UNIQUE NOT NULL,
      consecutivo INTEGER,
      pre_consecutivo INTEGER,
      -- Generador
      nombregenerador TEXT,
      cedulagenerador TEXT,
      emailgenerador TEXT,
      movilgenerador TEXT,
      tipogenerador TEXT,
      cultivogenerador TEXT,
      direcciongenerador TEXT,
      municipiogenerador TEXT,
      -- Coordinador
      coordinador_airtable_id TEXT,
      nombrecoordinador TEXT,
      emailcoordinador TEXT,
      movilcoordinador TEXT,
      -- Devolución
      fechadevolucion DATE,
      lugardevolucion TEXT,
      municipiodevolucion TEXT,
      idmunicipiodevolucion_airtable TEXT,
      -- Cantidades (kg)
      rigidos NUMERIC(10,3) DEFAULT 0,
      flexibles NUMERIC(10,3) DEFAULT 0,
      metalicos NUMERIC(10,3) DEFAULT 0,
      embalaje NUMERIC(10,3) DEFAULT 0,
      total NUMERIC(10,3) DEFAULT 0,
      -- Otros
      triplelavado TEXT,
      departamento TEXT,
      ano INTEGER,
      -- PDF
      certificadopdf_filename TEXT,
      certificadopdf_r2_url TEXT,
      certificadopdf_size INTEGER,
      -- Metadata
      airtable_created_time TIMESTAMPTZ,
      migrated_at TIMESTAMPTZ DEFAULT NOW(),
      -- Columnas extra para CSV
      fechageneracion TIMESTAMPTZ,
      observaciones TEXT,
      fuente TEXT DEFAULT 'airtable'
    );
  `);

  // Índices para consultas comunes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_certificados_ano ON certificados(ano);
    CREATE INDEX IF NOT EXISTS idx_certificados_consecutivo ON certificados(consecutivo);
    CREATE INDEX IF NOT EXISTS idx_certificados_fechadevolucion ON certificados(fechadevolucion);
    CREATE INDEX IF NOT EXISTS idx_certificados_coordinador ON certificados(nombrecoordinador);
    CREATE INDEX IF NOT EXISTS idx_certificados_generador ON certificados(nombregenerador);
    CREATE INDEX IF NOT EXISTS idx_certificados_fuente ON certificados(fuente);
  `);

  console.log("✓ Tabla e índices creados/verificados en Neon");
}

async function insertCertificado(
  client: Client,
  record: AirtableRecord
) {
  const f = record.fields;
  const first = (val: unknown) => (Array.isArray(val) ? val[0] : val);

  // Build PDF URL from R2 (PDFs uploaded separately via rclone)
  const pdfField = f.certificadopdf as
    | Array<{ filename: string; size: number }>
    | undefined;
  let pdfFilename: string | null = null;
  let r2Url: string | null = null;
  let pdfSize: number | null = null;

  if (pdfField && pdfField.length > 0) {
    pdfFilename = pdfField[0].filename;
    pdfSize = pdfField[0].size;
    // PDFs are in R2 at /pdfs/<filename> (uploaded via rclone from DO)
    r2Url = `${R2_PUBLIC_URL}/pdfs/${pdfFilename}`;
  }

  await client.query(
    `INSERT INTO certificados (
      airtable_id, consecutivo, pre_consecutivo,
      nombregenerador, cedulagenerador, emailgenerador, movilgenerador,
      tipogenerador, cultivogenerador, direcciongenerador, municipiogenerador,
      coordinador_airtable_id, nombrecoordinador, emailcoordinador, movilcoordinador,
      fechadevolucion, lugardevolucion, municipiodevolucion, idmunicipiodevolucion_airtable,
      rigidos, flexibles, metalicos, embalaje, total,
      triplelavado, departamento, ano,
      certificadopdf_filename, certificadopdf_r2_url, certificadopdf_size,
      airtable_created_time, fuente
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
    ) ON CONFLICT (airtable_id) DO NOTHING`,
    [
      record.id,
      f.consecutivo ?? null,
      f.pre_consecutivo ?? null,
      first(f.nombregenerador) ?? null,
      first(f.cedulagenerador) ?? null,
      first(f.emailgenerador) ?? null,
      first(f.movilgenerador) ?? null,
      first(f.tipogenerador) ?? null,
      first(f.cultivogenerador) ?? null,
      first(f.direcciongenerador) ?? null,
      first(f.municipiogenerador) ?? null,
      first(f.coordinador) ?? null,
      first(f.nombrecoordinador) ?? null,
      first(f.emailcoordinador) ?? null,
      first(f.movilcoordinador) ?? null,
      f.fechadevolucion ?? null,
      f.lugardevolucion ?? null,
      first(f.municipiodevolucion) ?? null,
      first(f.idmunicipiodevolucion) ?? null,
      f.rigidos ?? 0,
      f.flexibles ?? 0,
      f.metalicos ?? 0,
      f.embalaje ?? 0,
      f.total ?? 0,
      f.triplelavado ?? null,
      first(f.Departamento) ?? null,
      f.ano ?? null,
      pdfFilename,
      r2Url,
      pdfSize,
      record.createdTime,
      "airtable",
    ]
  );
}

// --- Batch processing with concurrency ---
async function processBatch(
  client: Client,
  records: AirtableRecord[],
  startIdx: number,
  total: number
): Promise<{ success: number; errors: number }> {
  let success = 0;
  let errors = 0;

  const promises = records.map(async (record, i) => {
    const consecutivo = record.fields.consecutivo ?? "?";
    try {
      await insertCertificado(client, record);
      success++;
    } catch (err) {
      errors++;
      console.error(
        `   [${startIdx + i + 1}/${total}] ✗ Error #${consecutivo}: ${err}`
      );
    }
  });

  await Promise.all(promises);
  return { success, errors };
}

// --- Main ---
async function main() {
  console.log(
    `\n=== Migración Certificados (solo datos) ${isTest ? "(PRUEBA - 10)" : "(COMPLETA)"} ===\n`
  );
  console.log("   PDFs se suben por separado vía rclone (DO → R2)\n");

  // 1. Fetch from Airtable
  console.log("1. Descargando certificados de Airtable...");
  const records = await fetchCertificados(isTest ? 10 : undefined);
  console.log(`   Total: ${records.length} registros\n`);

  // 2. Connect to Neon
  console.log("2. Conectando a Neon PostgreSQL...");
  const pgClient = new Client({ connectionString: NEON_DATABASE_URL });
  await pgClient.connect();
  console.log("   ✓ Conectado\n");

  // 3. Create table
  console.log("3. Verificando tabla en Neon...");
  await createTable(pgClient);
  console.log("");

  // 4. Migrate in batches
  console.log(`4. Insertando registros (concurrencia: ${CONCURRENCY})...\n`);
  let totalSuccess = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  for (let i = 0; i < records.length; i += CONCURRENCY) {
    const batch = records.slice(i, i + CONCURRENCY);
    const beforeCount = totalSuccess + totalErrors;

    const { success, errors } = await processBatch(
      pgClient,
      batch,
      i,
      records.length
    );
    totalSuccess += success;
    totalErrors += errors;

    // Log progress every batch
    const pct = Math.round(((i + batch.length) / records.length) * 100);
    console.log(
      `   [${i + batch.length}/${records.length}] ${pct}% — batch: ${success} ok, ${errors} err`
    );
  }

  // 5. Summary
  console.log(`\n=== Resumen ===`);
  console.log(`   Registros insertados: ${totalSuccess}`);
  console.log(`   Errores:              ${totalErrors}`);

  // 6. Verify
  const countResult = await pgClient.query(
    "SELECT fuente, COUNT(*) FROM certificados GROUP BY fuente ORDER BY fuente"
  );
  console.log(`   Conteo por fuente en Neon:`);
  countResult.rows.forEach((r: { fuente: string; count: string }) =>
    console.log(`     ${r.fuente}: ${r.count}`)
  );

  const totalInDb = await pgClient.query(
    "SELECT COUNT(*) FROM certificados"
  );
  console.log(`   Total en Neon: ${totalInDb.rows[0].count}`);

  await pgClient.end();
  console.log("\n✓ Migración datos completada\n");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
