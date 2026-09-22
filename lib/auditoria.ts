/**
 * Registro de auditoría de ediciones (generadores y fincas).
 *
 * Guarda "quién editó qué ficha y cuándo" en la tabla Airtable "Auditoría"
 * y actualiza los campos ultima_edicion_por / ultima_edicion_fecha en la
 * propia ficha. NO detalla campo por campo (por decisión del negocio).
 *
 * Es best-effort: cualquier fallo se registra en consola pero NUNCA rompe
 * la operación de edición que lo invoca.
 */
const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

const AUDITORIA_TABLE_ID = "tblC5wRSTS2KVG1Lp";
const TABLE_ID: Record<"generador" | "finca", string> = {
  generador: "tblYaIreXLlmqQd5K", // GENERADORES
  finca: "tblv0vjvpXjKhMEv9", // FINCAS
};

export async function registrarEdicion(opts: {
  tipo: "generador" | "finca";
  fichaId: string;
  fichaNombre?: string;
  coordinador: string; // nombre o email del coordinador de la sesión
}): Promise<void> {
  const { tipo, fichaId, fichaNombre = "", coordinador } = opts;
  if (!fichaId || !coordinador) return;
  const ahora = new Date().toISOString();
  const nombreTxt = fichaNombre || fichaId;

  try {
    // 1) Renglón en la tabla Auditoría (historial completo)
    await fetch(`https://api.airtable.com/v0/${BASE}/${AUDITORIA_TABLE_ID}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          detalle: `${coordinador} editó ${tipo} ${nombreTxt}`,
          fecha: ahora,
          coordinador,
          tipo,
          ficha_id: fichaId,
          ficha_nombre: nombreTxt,
        },
      }),
    });

    // 2) Última edición sobre la propia ficha (vistazo rápido)
    await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE_ID[tipo]}/${fichaId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: { ultima_edicion_por: coordinador, ultima_edicion_fecha: ahora },
      }),
    });
  } catch (e) {
    console.error("[auditoria] no se pudo registrar la edición:", e);
  }
}
