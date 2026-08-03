/**
 * Migración de documentos de terceros: adjuntos legacy (campos *_pdf y
 * otros_documentos de la tabla Terceros) → repositorio versionado
 * (R2 + tabla DOCUMENTOS_TERCEROS).
 *
 * - Cada adjunto se descarga de Airtable, se sube a R2 y se crea su registro
 *   (v1..vN en el orden del array; la última queda `vigente`).
 * - estado = "pendiente" (decisión 2026-08-03: lo existente entra a revisión).
 * - Los adjuntos originales NO se tocan (quedan de respaldo en Airtable).
 * - Idempotente: si el tercero ya tiene documentos de un tipo en la tabla
 *   nueva, ese tipo se salta.
 *
 * Uso: npx tsx scripts/migrar-documentos-terceros.ts [--dry]
 */

import {
  construirKeyR2,
  crearRegistroDocumento,
  listarTodosDocumentos,
  sha256Hex,
  subirArchivoR2,
  TipoDocumento,
} from "../lib/documentosTerceros";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;
const DRY = process.argv.includes("--dry");

const CAMPO_A_TIPO: Array<[string, TipoDocumento]> = [
  ["rut_pdf", "RUT"],
  ["certificacion_bancaria_pdf", "Certificación bancaria"],
  ["cedula_pdf", "Cédula"],
  ["certificado_camara_pdf", "Cámara de Comercio"],
  ["otros_documentos", "Otro"],
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1) Terceros con sus adjuntos (URLs frescas).
  const terceros: any[] = [];
  let offset = "";
  do {
    const url = `https://api.airtable.com/v0/${BASE}/Terceros?pageSize=100${offset ? "&offset=" + offset : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
    const data = await res.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    terceros.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  // 2) Lo ya migrado (idempotencia por tercero+tipo).
  const existentes = await listarTodosDocumentos();
  const yaMigrado = new Set(existentes.map((d) => `${d.terceroId}|${d.tipo}`));

  let migrados = 0;
  let saltados = 0;
  let errores = 0;

  for (const t of terceros) {
    const nombre = String(t.fields?.RazonSocial || t.id);
    for (const [campo, tipo] of CAMPO_A_TIPO) {
      const adjuntos: any[] = t.fields?.[campo] || [];
      if (adjuntos.length === 0) continue;
      if (yaMigrado.has(`${t.id}|${tipo}`)) {
        saltados += adjuntos.length;
        continue;
      }

      let versionesCreadas: string[] = [];
      for (let i = 0; i < adjuntos.length; i++) {
        const a = adjuntos[i];
        const version = i + 1;
        try {
          if (DRY) {
            console.log(`[dry] ${nombre} · ${tipo} v${version} · ${a.filename}`);
            migrados++;
            continue;
          }
          const fileRes = await fetch(a.url);
          if (!fileRes.ok) throw new Error(`descarga HTTP ${fileRes.status}`);
          const buffer = Buffer.from(await fileRes.arrayBuffer());
          const key = construirKeyR2(t.id, tipo, version, a.filename || "documento.pdf");
          await subirArchivoR2(key, buffer, a.type || "application/octet-stream");
          const docId = await crearRegistroDocumento({
            terceroId: t.id,
            terceroNombre: nombre,
            tipo,
            version,
            archivoKey: key,
            archivoNombre: a.filename || `documento-v${version}`,
            archivoHash: sha256Hex(buffer),
            archivoSize: buffer.length,
            origen: "migracion",
            desmarcarVigentes: versionesCreadas.length ? [versionesCreadas[versionesCreadas.length - 1]] : [],
          });
          versionesCreadas.push(docId);
          migrados++;
          console.log(`✓ ${nombre} · ${tipo} v${version} · ${a.filename} (${buffer.length} bytes)`);
          await sleep(250); // rate limit Airtable
        } catch (err) {
          errores++;
          console.error(`✗ ${nombre} · ${tipo} v${version}:`, (err as Error).message);
        }
      }
    }
  }

  console.log(`\nResumen: ${migrados} migrados · ${saltados} saltados (ya migrados) · ${errores} errores`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
