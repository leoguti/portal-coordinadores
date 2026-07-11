/**
 * Aprobación retroactiva de actividades de Sensibilización (cambio de modelo
 * 2026-07-10: solo las Aprobadas cuentan en cifras).
 *
 * Marca AprobacionSensibilizacion = "Aprobada" (y AprobacionEvaluaciones si la
 * actividad tiene evaluaciones) en toda sensibilización con FECHA DE ACTIVIDAD
 * anterior a la fecha de corte. Respeta:
 *  - las ya Rechazadas (no se tocan),
 *  - las ya Aprobadas (no se tocan),
 *  - las corregidas tras rechazo (Pendiente + motivo): quedan para re-revisión
 *    manual del admin, no se aprueban en bloque.
 *
 * CORRER ANTES de desplegar el código que invierte la regla de cifras.
 *
 * Uso:
 *   node scripts/aprobar-actividades-retroactivo.js --fecha=2026-07-01           (simulación)
 *   node scripts/aprobar-actividades-retroactivo.js --fecha=2026-07-01 --aplicar (escribe)
 */

require("dotenv").config({ path: ".env.local", quiet: true });

const KEY = process.env.AIRTABLE_API_KEY;
const BASE = process.env.AIRTABLE_BASE_ID;
const API = `https://api.airtable.com/v0/${BASE}/Actividades`;

const argFecha = process.argv.find((a) => a.startsWith("--fecha="));
const APLICAR = process.argv.includes("--aplicar");
if (!argFecha || !/^\d{4}-\d{2}-\d{2}$/.test(argFecha.split("=")[1])) {
  console.error("Falta --fecha=YYYY-MM-DD (corte: actividades ANTERIORES a esta fecha se aprueban)");
  process.exit(1);
}
const CORTE = argFecha.split("=")[1];

async function listar() {
  const campos = ["Tipo", "Fecha", "Nombre de la Actividad", "AprobacionSensibilizacion", "AprobacionEvaluaciones", "MotivoRechazoSensibilizacion", "MotivoRechazoEvaluaciones", "Personas Evaluadas", "CantidadEvaluaciones"];
  const qs = campos.map((c) => `fields%5B%5D=${encodeURIComponent(c)}`).join("&") + "&pageSize=100";
  let recs = [], offset;
  do {
    const r = await fetch(`${API}?${qs}${offset ? `&offset=${offset}` : ""}`, { headers: { Authorization: `Bearer ${KEY}` } });
    if (!r.ok) throw new Error(`list -> ${r.status}: ${await r.text()}`);
    const d = await r.json();
    recs = recs.concat(d.records);
    offset = d.offset;
  } while (offset);
  return recs;
}

(async () => {
  const todos = await listar();
  const sens = todos.filter((r) => r.fields.Tipo === "Sensibilización" && (r.fields.Fecha || "") < CORTE);
  console.log(`Sensibilizaciones con fecha < ${CORTE}: ${sens.length}`);

  const cambios = [];
  let saltadasRechazada = 0, saltadasAprobada = 0, saltadasCorregida = 0;
  for (const r of sens) {
    const f = r.fields;
    const fields = {};
    const sinEstadoSens = !f.AprobacionSensibilizacion || f.AprobacionSensibilizacion === "Pendiente";
    const corregidaSens = f.AprobacionSensibilizacion === "Pendiente" && (f.MotivoRechazoSensibilizacion || "").trim();
    if (f.AprobacionSensibilizacion === "Rechazada") saltadasRechazada++;
    else if (f.AprobacionSensibilizacion === "Aprobada") saltadasAprobada++;
    else if (corregidaSens) saltadasCorregida++;
    else if (sinEstadoSens) fields.AprobacionSensibilizacion = "Aprobada";

    const tieneEvals = (f["Personas Evaluadas"] || 0) > 0 || (f.CantidadEvaluaciones || 0) > 0;
    const sinEstadoEval = !f.AprobacionEvaluaciones || f.AprobacionEvaluaciones === "Pendiente";
    const corregidaEval = f.AprobacionEvaluaciones === "Pendiente" && (f.MotivoRechazoEvaluaciones || "").trim();
    if (tieneEvals && sinEstadoEval && !corregidaEval && f.AprobacionEvaluaciones !== "Rechazada") {
      fields.AprobacionEvaluaciones = "Aprobada";
    }

    if (Object.keys(fields).length > 0) cambios.push({ id: r.id, fields, nombre: f["Nombre de la Actividad"], fecha: f.Fecha });
  }

  console.log(`A aprobar: ${cambios.length} | ya rechazadas (intactas): ${saltadasRechazada} | ya aprobadas: ${saltadasAprobada} | corregidas tras rechazo (re-revisión manual): ${saltadasCorregida}`);
  if (!APLICAR) {
    cambios.slice(0, 10).forEach((c) => console.log("  ej:", c.fecha, "|", c.nombre, "|", JSON.stringify(c.fields)));
    console.log("(simulación — ejecutar con --aplicar para escribir)");
    return;
  }

  for (let i = 0; i < cambios.length; i += 10) {
    const lote = cambios.slice(i, i + 10).map(({ id, fields }) => ({ id, fields }));
    const r = await fetch(API, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ records: lote }),
    });
    if (!r.ok) throw new Error(`patch -> ${r.status}: ${await r.text()}`);
    process.stdout.write(`\r${Math.min(i + 10, cambios.length)}/${cambios.length}`);
  }
  console.log("\nListo: aprobación retroactiva aplicada.");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
