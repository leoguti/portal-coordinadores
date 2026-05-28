/**
 * Helpers comunes para los endpoints de aprobar/rechazar generadores y fincas.
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

export async function airtableGetRecord(
  table: string,
  id: string
): Promise<{ id: string; fields: Record<string, unknown>; createdTime: string } | null> {
  const r = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}/${id}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
  );
  if (!r.ok) return null;
  return r.json();
}

export async function airtablePatchRecord(
  table: string,
  id: string,
  fields: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}/${id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields, typecast: true }),
    }
  );
  if (!r.ok) {
    return { ok: false, error: await r.text() };
  }
  return { ok: true };
}

/**
 * Para fincas en estado=pendiente_revision: aplica los cambios pendientes
 * (almacenados en `cambios_pendientes` como JSON) al record. Se llama desde
 * el flujo de aprobación.
 */
export function aplicarCambiosPendientes(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const raw = fields.cambios_pendientes;
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    const cambios = parsed?.cambios;
    if (cambios && typeof cambios === "object") {
      return cambios as Record<string, unknown>;
    }
  } catch {
    /* ignore parse errors */
  }
  return {};
}
