/**
 * Escanea los PDFs del repositorio de documentos de terceros y detecta los
 * que piden contraseña para abrir (o están dañados). Sin IA — pdfjs.
 *
 * A los "protegido"/"ilegible" les escribe una nota en `verificacion_ia`
 * para que la bandeja de revisión los muestre con la alerta 🔒.
 *
 * Uso: npx tsx scripts/escanear-pdfs-protegidos.ts [--dry]
 */

import { listarTodosDocumentos, leerArchivoR2, TABLA_DOCUMENTOS } from "../lib/documentosTerceros";
import { analizarPdf, esPdf } from "../lib/pdfProtegido";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;
const DRY = process.argv.includes("--dry");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const docs = await listarTodosDocumentos();
  const pdfs = docs.filter((d) => esPdf(d.archivoNombre));
  console.log(`${docs.length} documentos · ${pdfs.length} PDFs a escanear\n`);

  const problemas: Array<{ doc: (typeof docs)[number]; analisis: string }> = [];
  let abiertos = 0;
  let restringidos = 0;

  for (const d of pdfs) {
    const archivo = await leerArchivoR2(d.archivoKey);
    if (!archivo) {
      console.log(`✗ no legible en R2: ${d.archivoNombre}`);
      continue;
    }
    const analisis = await analizarPdf(Buffer.from(archivo.body));
    if (analisis === "abierto") abiertos++;
    else if (analisis === "restringido") restringidos++;
    else {
      problemas.push({ doc: d, analisis });
      console.log(`🔒 ${analisis.toUpperCase()}: ${d.tipo} · ${d.archivoNombre} (${d.id})`);
      if (!DRY) {
        const nota =
          analisis === "protegido"
            ? "🔒 PDF protegido con contraseña — no se puede abrir para revisión (detección automática)"
            : "⚠ PDF ilegible o dañado (detección automática)";
        await fetch(`https://api.airtable.com/v0/${BASE}/${TABLA_DOCUMENTOS}/${d.id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { verificacion_ia: nota } }),
        });
        await sleep(250);
      }
    }
  }

  console.log(
    `\nResumen: ${abiertos} abren normal · ${restringidos} con restricciones de permisos (aceptables) · ${problemas.length} con problema`
  );
  if (problemas.length) {
    console.log("\nCon problema (rechazar desde la bandeja pidiendo versión sin clave):");
    for (const p of problemas) {
      console.log(` - ${p.doc.tipo} v${p.doc.version} · ${p.doc.archivoNombre} · ${p.analisis}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
