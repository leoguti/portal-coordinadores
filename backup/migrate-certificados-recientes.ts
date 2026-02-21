/**
 * Script de migración: Certificados RECIENTES (2025-2026) Airtable → Neon PostgreSQL
 * Backup de seguridad — estos NO se borran de Airtable
 *
 * Uso:
 *   npx tsx backup/migrate-certificados-recientes.ts
 */

import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL!;
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ||
  "https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev";

const CONCURRENCY = 20;

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

async function fetchCertificados(): Promise<AirtableRecord[]> {
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  const formula = `YEAR({fechadevolucion})>=2025`;

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
  } while (offset);

  return allRecords;
}

async function insertCertificado(client: Client, record: AirtableRecord) {
  const f = record.fields;
  const first = (val: unknown) => (Array.isArray(val) ? val[0] : val);

  const pdfField = f.certificadopdf as
    | Array<{ filename: string; size: number }>
    | undefined;
  let pdfFilename: string | null = null;
  let r2Url: string | null = null;
  let pdfSize: number | null = null;

  if (pdfField && pdfField.length > 0) {
    pdfFilename = pdfField[0].filename;
    pdfSize = pdfField[0].size;
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

async function main() {
  console.log("\n=== Backup Certificados Recientes (2025-2026) ===\n");

  console.log("1. Descargando de Airtable...");
  const records = await fetchCertificados();
  console.log(`   Total: ${records.length} registros\n`);

  console.log("2. Conectando a Neon...");
  const pgClient = new Client({ connectionString: NEON_DATABASE_URL });
  await pgClient.connect();
  console.log("   ✓ Conectado\n");

  console.log(`3. Insertando (concurrencia: ${CONCURRENCY})...\n`);
  let totalSuccess = 0;
  let totalErrors = 0;

  for (let i = 0; i < records.length; i += CONCURRENCY) {
    const batch = records.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (record) => {
      try {
        await insertCertificado(pgClient, record);
        totalSuccess++;
      } catch (err) {
        totalErrors++;
        console.error(`   ✗ Error #${record.fields.consecutivo}: ${err}`);
      }
    });
    await Promise.all(promises);

    const pct = Math.round(((i + batch.length) / records.length) * 100);
    console.log(`   [${i + batch.length}/${records.length}] ${pct}% — ${totalSuccess} ok, ${totalErrors} err`);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`   Insertados: ${totalSuccess}`);
  console.log(`   Errores:    ${totalErrors}`);

  const count = await pgClient.query(
    "SELECT fuente, COUNT(*) FROM certificados GROUP BY fuente"
  );
  console.log("   En Neon:");
  count.rows.forEach((r: { fuente: string; count: string }) =>
    console.log(`     ${r.fuente}: ${r.count}`)
  );

  const total = await pgClient.query("SELECT COUNT(*) FROM certificados");
  console.log(`   Total: ${total.rows[0].count}`);

  await pgClient.end();
  console.log("\n✓ Backup recientes completado\n");
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
