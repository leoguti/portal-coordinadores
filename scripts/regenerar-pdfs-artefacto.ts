/**
 * Regenera los PDFs de certificados cuyo `total` tiene artefactos de punto
 * flotante (ej. 30.299999999999997 kg impreso en el PDF) — bug 2026-07-08.
 *
 * Hace SOLO: render PDF (con roundKg ya integrado) → R2 (sobrescribe el
 * permanente) → PATCH adjunto en Airtable → UPDATE total en Neon.
 * NO envía emails ni mensajes de WhatsApp (a diferencia de generarYAdjuntarPDF).
 *
 * Uso:
 *   npx tsx scripts/regenerar-pdfs-artefacto.ts                # dry-run: lista afectados
 *   npx tsx scripts/regenerar-pdfs-artefacto.ts --solo=95020   # regenera SOLO ese consecutivo
 *   npx tsx scripts/regenerar-pdfs-artefacto.ts --apply        # regenera TODOS los afectados
 */
import fs from "fs";
import path from "path";

// Cargar .env.local ANTES de importar módulos que leen env al cargar
const envPath = path.join(__dirname, "..", ".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!m) continue;
  let v = m[2];
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

const APPLY = process.argv.includes("--apply");
const SOLO = (process.argv.find((a) => a.startsWith("--solo=")) || "").split("=")[1];

const K = process.env.AIRTABLE_API_KEY!;
const B = process.env.AIRTABLE_BASE_ID!;
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL || "https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev";

async function main() {
  // Imports dinámicos (después de cargar env)
  const React = (await import("react")).default;
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const CertificadoPDF = (await import("../components/pdf/CertificadoPDF")).default;
  const { construirPdfProps } = await import("../lib/certificadosCore");
  const { resolveGeneradorDataFromFinca } = await import("../lib/fincaGeneradorResolver");
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { Client: PgClient } = await import("pg");

  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  // 1. Buscar afectados (total con más de 3 decimales = artefacto)
  const formula = SOLO
    ? `{consecutivo}=${SOLO}`
    : "ROUND({total},3)!={total}";
  const afectados: Array<{ id: string; createdTime: string; fields: Record<string, unknown> }> = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams({ filterByFormula: formula, pageSize: "100" });
    if (offset) p.set("offset", offset);
    const d = await fetch(`https://api.airtable.com/v0/${B}/Certificados?${p}`, {
      headers: { Authorization: `Bearer ${K}` },
    }).then((r) => r.json());
    if (d.error) throw new Error(JSON.stringify(d.error));
    afectados.push(...(d.records || []));
    offset = d.offset;
  } while (offset);

  console.log(`Certificados a regenerar: ${afectados.length} ${SOLO ? `(solo #${SOLO})` : ""}`);
  if (!APPLY && !SOLO) {
    afectados.slice(0, 20).forEach((r) =>
      console.log(` #${r.fields.consecutivo} total=${r.fields.total} (${r.id})`)
    );
    console.log("\nDry-run. Usa --solo=<consecutivo> para probar uno, --apply para todos.");
    return;
  }

  const pg = new PgClient({ connectionString: process.env.NEON_DATABASE_URL! });
  await pg.connect();

  let ok = 0, fail = 0;
  const errores: string[] = [];
  for (const rec of afectados) {
    const f = rec.fields;
    const cons = Number(f.consecutivo) || 0;
    try {
      // Resolver datos de finca si es cert vía FINCAS (igual que /aprobar)
      const fincaIds = Array.isArray(f.FINCAS) ? (f.FINCAS as string[]) : [];
      const resolved = fincaIds[0]
        ? await resolveGeneradorDataFromFinca(K, B, fincaIds[0])
        : null;

      // Fechas del pie: conservar las originales del record
      const pdfProps = construirPdfProps(f, resolved, {
        generacion: String(f.fecha_solicitud || "") || rec.createdTime,
        aprobacion: String(f.fecha_aprobacion || "") || rec.createdTime,
      });
      if (!pdfProps.consecutivo) throw new Error("sin consecutivo");

      // Render + R2 (sobrescribe el permanente) + PATCH adjunto
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(CertificadoPDF as any, pdfProps as any) as any;
      const pdfBuffer = await renderToBuffer(element);
      const filename = `certificado_${cons}.pdf`;
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: `pdfs/${filename}`,
          Body: pdfBuffer,
          ContentType: "application/pdf",
        })
      );
      const r2Url = `${R2_PUBLIC_URL}/pdfs/${filename}`;

      const patch = await fetch(`https://api.airtable.com/v0/${B}/Certificados/${rec.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${K}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: { certificadopdf: [{ url: r2Url, filename }] } }),
      });
      if (!patch.ok) throw new Error(`PATCH Airtable ${patch.status}: ${await patch.text()}`);

      // Neon: corregir el total guardado
      await pg.query(
        `UPDATE certificados SET total = ROUND(total::numeric, 3),
           rigidos = ROUND(rigidos::numeric, 3), flexibles = ROUND(flexibles::numeric, 3),
           metalicos = ROUND(metalicos::numeric, 3), embalaje = ROUND(embalaje::numeric, 3)
         WHERE airtable_id = $1`,
        [rec.id]
      );

      ok++;
      console.log(`✅ #${cons} regenerado (total ${f.total} → ${pdfProps.total}) — ${ok + fail}/${afectados.length}`);
      // Throttle: Airtable 5 req/s
      await new Promise((r) => setTimeout(r, 350));
    } catch (e) {
      fail++;
      const msg = `#${cons}: ${e instanceof Error ? e.message : e}`;
      errores.push(msg);
      console.error(`❌ ${msg}`);
    }
  }

  await pg.end();
  console.log(`\nRESUMEN: ${ok} regenerados, ${fail} errores de ${afectados.length}`);
  if (errores.length) {
    fs.writeFileSync("/tmp/regenerar-pdfs-errores.log", errores.join("\n"));
    console.log("Errores en /tmp/regenerar-pdfs-errores.log");
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
