/**
 * Resolver de coordinadores por teléfono — para el bot de WhatsApp.
 *
 * Fuente de verdad: tabla `Coordinadores` de Airtable, SOLO registros con
 * Rol = "Coordinador" exacto (decisión 2026-06-12). El grupo "Coordinadores"
 * de TextIt NO se usa: está desactualizado (era del bot de Telegram).
 *
 * Precedencia en el bot: si un número es coordinador Y además aparece como
 * móvil de un GENERADOR/FINCA (pasa cuando el coordinador registró a un
 * agricultor sin celular con su propio número), GANA el rol coordinador.
 */

import { normalizarMovilCO } from "@/lib/validacionesCO";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

/** Roles de la tabla Coordinadores que habilitan el menú de coordinador. */
const ROLES_PERMITIDOS = ["Coordinador"];

export interface CoordinadorWA {
  id: string;
  nombre: string;
  /** Teléfono normalizado a 10 dígitos. */
  telefono: string;
}

export async function identificarCoordinadorPorTelefono(
  telefono: string
): Promise<CoordinadorWA | null> {
  const tel10 = normalizarMovilCO(telefono);
  if (!tel10 || tel10.length < 10) return null;

  const rolesOr = ROLES_PERMITIDOS.map((r) => `{Rol}='${r}'`).join(",");
  const formula = `AND(OR(${rolesOr}), RIGHT(REGEX_REPLACE({telefono}&'', '[^0-9]', ''), 10) = '${tel10}')`;
  const params = new URLSearchParams();
  params.set("filterByFormula", formula);
  params.set("maxRecords", "1");
  params.append("fields[]", "Name");
  params.append("fields[]", "telefono");

  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Coordinadores?${params}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
        cache: "no-store",
      }
    );
    if (!r.ok) {
      console.error(
        `[coordinadorResolver] Airtable ${r.status}: ${await r.text()}`
      );
      return null;
    }
    const d = (await r.json()) as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
    };
    const rec = d.records?.[0];
    if (!rec) return null;
    return {
      id: rec.id,
      nombre: String(rec.fields?.Name || "").trim(),
      telefono: tel10,
    };
  } catch (err) {
    console.error("[coordinadorResolver] Error:", err);
    return null;
  }
}
