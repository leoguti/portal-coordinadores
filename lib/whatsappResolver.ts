/**
 * Resuelve la identidad del agricultor a partir de su teléfono de WhatsApp.
 *
 * Busca primero en FINCAS.movil (normalizado a 10 dígitos). Si no encuentra,
 * fallback en GENERADORES.movil (un agricultor que aún no tiene fincas).
 *
 * Devuelve la información necesaria para que el bot arme el menú adaptado:
 *   - conocido_con_fincas: tiene generador + ≥1 finca aprobada
 *   - conocido_sin_finca:  tiene generador pero 0 fincas (o todas pendientes)
 *   - desconocido:         no aparece en ninguna tabla
 */

import { normalizarMovilCO } from "@/lib/validacionesCO";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

export type EstadoAgricultor =
  | "conocido_con_fincas"
  | "conocido_sin_finca"
  | "desconocido";

export interface FincaInfo {
  id: string;
  nombre: string;
  generadorId: string;
  estado: string; // "aprobado" | "pendiente" | etc — campo nuevo del V4
  completitudOk: boolean;
}

export interface GeneradorInfo {
  id: string;
  nombre: string;
  estado: string;
}

export interface IdentidadAgricultor {
  estado: EstadoAgricultor;
  telefonoNormalizado: string;
  generador: GeneradorInfo | null;
  fincas: FincaInfo[];
}

async function airtableFetch(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Busca fincas cuyo `movil` termina en los últimos 10 dígitos del teléfono dado.
 * Tolerante a formatos sucios en data legacy (espacios, +57, etc).
 */
async function buscarFincasPorTelefono(tel10: string): Promise<FincaInfo[]> {
  const formula = `RIGHT(REGEX_REPLACE({movil}&'', '[^0-9]', ''), 10) = '${tel10}'`;
  const url = `/FINCAS?filterByFormula=${encodeURIComponent(formula)}&pageSize=100`;
  const data = (await airtableFetch(url)) as {
    records: Array<{ id: string; fields: Record<string, unknown> }>;
  };
  return (data.records || []).map((r) => {
    const ff = r.fields;
    const generadorIds = Array.isArray(ff.generador) ? (ff.generador as string[]) : [];
    return {
      id: r.id,
      nombre: String(ff.nombre || "").trim(),
      generadorId: generadorIds[0] || "",
      estado: String(ff.estado || "aprobado"), // si el campo aún no existe, asumir aprobado
      completitudOk: Boolean(ff.municipio && Array.isArray(ff.cultivos) && ff.cultivos.length > 0),
    };
  });
}

async function buscarGeneradorPorTelefono(tel10: string): Promise<GeneradorInfo | null> {
  const formula = `RIGHT(REGEX_REPLACE({movil}&'', '[^0-9]', ''), 10) = '${tel10}'`;
  const url = `/GENERADORES?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
  const data = (await airtableFetch(url)) as {
    records: Array<{ id: string; fields: Record<string, unknown> }>;
  };
  const r = data.records?.[0];
  if (!r) return null;
  return {
    id: r.id,
    nombre: String(r.fields.nombre || "").trim(),
    estado: String(r.fields.estado || "aprobado"),
  };
}

async function buscarGeneradorPorId(id: string): Promise<GeneradorInfo | null> {
  try {
    const data = (await airtableFetch(`/GENERADORES/${id}`)) as {
      id: string;
      fields: Record<string, unknown>;
    };
    return {
      id: data.id,
      nombre: String(data.fields.nombre || "").trim(),
      estado: String(data.fields.estado || "aprobado"),
    };
  } catch {
    return null;
  }
}

export async function identificarAgricultor(
  telefono: string
): Promise<IdentidadAgricultor> {
  const tel10 = normalizarMovilCO(telefono);
  if (!tel10 || tel10.length < 10) {
    return {
      estado: "desconocido",
      telefonoNormalizado: tel10,
      generador: null,
      fincas: [],
    };
  }

  // 1. Buscar por FINCAS.movil
  const fincas = await buscarFincasPorTelefono(tel10);

  if (fincas.length > 0) {
    const generadorId = fincas[0].generadorId;
    const generador = generadorId ? await buscarGeneradorPorId(generadorId) : null;
    const fincasAprobadas = fincas.filter((f) => f.estado === "aprobado");
    return {
      estado: fincasAprobadas.length > 0 ? "conocido_con_fincas" : "conocido_sin_finca",
      telefonoNormalizado: tel10,
      generador,
      fincas,
    };
  }

  // 2. Fallback: buscar por GENERADORES.movil
  const generador = await buscarGeneradorPorTelefono(tel10);
  if (generador) {
    return {
      estado: "conocido_sin_finca",
      telefonoNormalizado: tel10,
      generador,
      fincas: [],
    };
  }

  // 3. Desconocido
  return {
    estado: "desconocido",
    telefonoNormalizado: tel10,
    generador: null,
    fincas: [],
  };
}
