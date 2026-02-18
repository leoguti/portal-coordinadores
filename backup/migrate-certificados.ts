/**
 * Script de migración: Certificados Airtable → Neon PostgreSQL + Cloudflare R2
 *
 * Uso:
 *   npx tsx backup/migrate-certificados.ts --test     # Solo 10 registros (prueba)
 *   npx tsx backup/migrate-certificados.ts --full     # Migración completa (2021-2024)
 *
 * Requisitos en .env.local:
 *   AIRTABLE_API_KEY, AIRTABLE_BASE_ID
 *   NEON_DATABASE_URL
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCOUNT_ID
 */

import { config } from "dotenv";
import { Client } from "pg";
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

config({ path: ".env.local" });

// --- Config ---
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_ENDPOINT = process.env.R2_ENDPOINT!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;

const isTest = process.argv.includes("--test");
const MAX_YEAR = 2024; // Archivar hasta este año inclusive

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
      throw new Error(`Airtable error: ${response.status} ${await response.text()}`);
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
      migrated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Índices para consultas comunes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_certificados_ano ON certificados(ano);
    CREATE INDEX IF NOT EXISTS idx_certificados_consecutivo ON certificados(consecutivo);
    CREATE INDEX IF NOT EXISTS idx_certificados_fechadevolucion ON certificados(fechadevolucion);
    CREATE INDEX IF NOT EXISTS idx_certificados_coordinador ON certificados(nombrecoordinador);
    CREATE INDEX IF NOT EXISTS idx_certificados_generador ON certificados(nombregenerador);
  `);

  console.log("✓ Tabla e índices creados en Neon");
}

async function insertCertificado(
  client: Client,
  record: AirtableRecord,
  r2Url: string | null,
  pdfFilename: string | null,
  pdfSize: number | null
) {
  const f = record.fields;
  const first = (val: unknown) =>
    Array.isArray(val) ? val[0] : val;

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
      airtable_created_time
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
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
    ]
  );
}

// --- Cloudflare R2 ---
function createR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

async function uploadPdfToR2(
  s3: S3Client,
  record: AirtableRecord
): Promise<{ url: string; filename: string; size: number } | null> {
  const pdfField = record.fields.certificadopdf as
    | Array<{ url: string; filename: string; size: number }>
    | undefined;

  if (!pdfField || pdfField.length === 0) {
    return null;
  }

  const pdf = pdfField[0];
  const ano = record.fields.ano ?? "sin-ano";
  const key = `${ano}/${pdf.filename}`;

  // Descargar PDF de Airtable
  const response = await fetch(pdf.url);
  if (!response.ok) {
    console.error(`  ✗ Error descargando PDF ${pdf.filename}: ${response.status}`);
    return null;
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Subir a R2
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    })
  );

  // URL pública (requiere configurar dominio público en R2, por ahora guardamos la key)
  const r2Url = `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;

  return { url: r2Url, filename: pdf.filename, size: pdf.size };
}

// --- Main ---
async function main() {
  console.log(`\n=== Migración de Certificados ${isTest ? "(PRUEBA - 10 registros)" : "(COMPLETA)"} ===\n`);

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
  console.log("3. Creando tabla en Neon...");
  await createTable(pgClient);
  console.log("");

  // 4. Connect to R2
  console.log("4. Conectando a Cloudflare R2...");
  const s3 = createR2Client();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
    console.log(`   ✓ Bucket '${R2_BUCKET_NAME}' accesible\n`);
  } catch (err) {
    console.error(`   ✗ Error accediendo al bucket: ${err}`);
    await pgClient.end();
    process.exit(1);
  }

  // 5. Migrate each record
  console.log("5. Migrando registros...\n");
  let success = 0;
  let errors = 0;
  let pdfsUploaded = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const consecutivo = record.fields.consecutivo ?? "?";
    const fecha = record.fields.fechadevolucion ?? "?";

    try {
      // Upload PDF to R2
      const pdfResult = await uploadPdfToR2(s3, record);
      if (pdfResult) pdfsUploaded++;

      // Insert into Neon
      await insertCertificado(
        pgClient,
        record,
        pdfResult?.url ?? null,
        pdfResult?.filename ?? null,
        pdfResult?.size ?? null
      );

      success++;
      console.log(
        `   [${i + 1}/${records.length}] ✓ Certificado #${consecutivo} (${fecha})${pdfResult ? " + PDF" : ""}`
      );
    } catch (err) {
      errors++;
      console.error(
        `   [${i + 1}/${records.length}] ✗ Error certificado #${consecutivo}: ${err}`
      );
    }
  }

  // 6. Summary
  console.log(`\n=== Resumen ===`);
  console.log(`   Registros migrados: ${success}`);
  console.log(`   PDFs subidos a R2:  ${pdfsUploaded}`);
  console.log(`   Errores:            ${errors}`);

  // 7. Verify
  const countResult = await pgClient.query("SELECT COUNT(*) FROM certificados");
  console.log(`   Total en Neon:      ${countResult.rows[0].count}`);

  await pgClient.end();
  console.log("\n✓ Migración completada\n");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
