/**
 * fusionar-gemelos.ts
 *
 * Procesa el CSV de revisión de gemelos y ejecuta las fusiones marcadas como FUSIONAR:
 *   1. Reasigna todos los Certificados del registro duplicado al principal
 *   2. Elimina el registro duplicado de la tabla `ubicaciones`
 *
 * Uso:
 *   npx tsx scripts/fusionar-gemelos.ts --dry-run   (simulación, sin cambios)
 *   npx tsx scripts/fusionar-gemelos.ts              (ejecuta los cambios)
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const DRY_RUN = process.argv.includes("--dry-run");
const CSV_PATH = path.join(process.cwd(), "revision gemelos - revision_gemelos_probable.csv");

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error("ERROR: Faltan variables de entorno AIRTABLE_API_KEY y/o AIRTABLE_BASE_ID");
  process.exit(1);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- Airtable helpers ---

async function airtableFetch(url: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Airtable ${response.status}: ${text}`);
  }
  return response.json();
}

/** Obtiene IDs de todos los Certificados vinculados a una ubicación
 *  Leyendo directamente el campo `Certificados` del registro ubicación.
 *  (Más confiable que filtrar por fórmula en la tabla Certificados)
 */
async function getCertificadosDeUbicacion(ubicacionId: string): Promise<string[]> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ubicaciones/${ubicacionId}`;
  const data = (await airtableFetch(url)) as { fields?: { Certificados?: string[] } };
  return data.fields?.Certificados ?? [];
}

/** Actualiza link_ubicacion de un Certificado al registro principal */
async function reasignarCertificado(certId: string, idPrincipal: string): Promise<void> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${certId}`;
  await airtableFetch(url, {
    method: "PATCH",
    body: JSON.stringify({ fields: { link_ubicacion: [idPrincipal] } }),
  });
}

/** Elimina un registro de la tabla ubicaciones */
async function eliminarUbicacion(ubicacionId: string): Promise<void> {
  const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ubicaciones/${ubicacionId}`;
  await airtableFetch(url, { method: "DELETE" });
}

// --- CSV parser simple (maneja campos con comas entre comillas) ---

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

interface FilaGemelo {
  decision: string;
  cedula: string;
  nombre: string;
  dirDup: string;
  munDup: string;
  dirPrin: string;
  munPrin: string;
  idDup: string;
  idPrin: string;
}

function parseCsv(content: string): FilaGemelo[] {
  const lines = content.split("\n").filter((l) => l.trim());
  // Omitir header
  return lines.slice(1).map((line) => {
    const p = parseCsvLine(line);
    return {
      decision: p[0] || "",
      cedula: p[1] || "",
      nombre: p[2] || "",
      dirDup: p[3] || "",
      munDup: p[4] || "",
      dirPrin: p[6] || "",
      munPrin: p[7] || "",
      idDup: p[10] || "",
      idPrin: p[11] || "",
    };
  });
}

// --- Main ---

async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  FUSIONAR GEMELOS - UBICACIONES`);
  console.log(`  Modo: ${DRY_RUN ? "DRY RUN (sin cambios)" : "EJECUCIÓN REAL"}`);
  console.log(`${"=".repeat(60)}\n`);

  const content = fs.readFileSync(CSV_PATH, "utf-8");
  const todas = parseCsv(content);
  const filas = todas.filter((f) => f.decision === "FUSIONAR" && f.idDup && f.idPrin);

  console.log(`Total filas en CSV: ${todas.length}`);
  console.log(`Filas FUSIONAR a procesar: ${filas.length}`);
  console.log(`Filas sin decisión (omitidas): ${todas.filter((f) => !f.decision).length}\n`);

  if (!DRY_RUN) {
    // Confirmación antes de ejecutar
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await new Promise<void>((resolve) => {
      rl.question(
        `¿Confirmar ejecución de ${filas.length} fusiones? (escribe 'si' para continuar): `,
        (answer) => {
          rl.close();
          if (answer.trim().toLowerCase() !== "si") {
            console.log("Cancelado.");
            process.exit(0);
          }
          resolve();
        }
      );
    });
    console.log();
  }

  let procesados = 0;
  let errores = 0;
  let certsReasignados = 0;

  for (let i = 0; i < filas.length; i++) {
    const fila = filas[i];
    const tag = `[${i + 1}/${filas.length}]`;

    console.log(`${tag} ${fila.nombre} (cédula: ${fila.cedula})`);
    console.log(`       DUP:  ${fila.dirDup} | ${fila.munDup} | ${fila.idDup}`);
    console.log(`       PRIN: ${fila.dirPrin} | ${fila.munPrin} | ${fila.idPrin}`);

    try {
      await delay(200);
      const certIds = await getCertificadosDeUbicacion(fila.idDup);
      console.log(`       Certificados vinculados al duplicado: ${certIds.length}`);

      if (DRY_RUN) {
        if (certIds.length > 0) {
          console.log(`       [DRY] Reasignaría ${certIds.length} cert(s) → ${fila.idPrin}`);
        }
        console.log(`       [DRY] Eliminaría ubicación: ${fila.idDup}`);
      } else {
        // Reasignar certificados
        for (const certId of certIds) {
          await reasignarCertificado(certId, fila.idPrin);
          console.log(`       ✓ Cert ${certId} → ${fila.idPrin}`);
          await delay(220);
        }
        certsReasignados += certIds.length;

        // Eliminar duplicado
        await eliminarUbicacion(fila.idDup);
        console.log(`       ✓ Eliminado: ${fila.idDup}`);
      }

      procesados++;
    } catch (err) {
      console.error(`       ✗ ERROR:`, err instanceof Error ? err.message : err);
      errores++;
    }

    console.log();
    await delay(220);
  }

  console.log(`${"=".repeat(60)}`);
  console.log(`  RESUMEN`);
  console.log(`  Procesados:           ${procesados}`);
  console.log(`  Errores:              ${errores}`);
  if (!DRY_RUN) {
    console.log(`  Certs reasignados:    ${certsReasignados}`);
    console.log(`  Ubicaciones eliminadas: ${procesados - errores}`);
  }
  console.log(`${"=".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
