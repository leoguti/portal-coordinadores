/**
 * Resuelve la identidad del agricultor a partir de su teléfono de WhatsApp.
 *
 * Reglas (esquema rol — 2026-05-29):
 *   1. Si el número está en GENERADOR.movil → rol = "titular".
 *      Trae TODAS las fincas del generador (no solo las que matchean por
 *      movil), porque el titular es dueño/representante del generador entero.
 *   2. Si el número NO está en generador pero SÍ en una o más FINCAS.movil
 *      → rol = "admin_finca". Solo se exponen las fincas matcheadas
 *      (no las demás del mismo generador). Bloqueado de editar generador.
 *   3. Caso 1=1 (titular cuyo número también está copiado en la finca):
 *      gana el rol "titular" por la regla 1.
 *   4. Si no aparece en ninguna tabla → rol = "desconocido".
 *
 * `estado` se mantiene como compat: derivado de rol + fincas.
 */

import { normalizarMovilCO } from "@/lib/validacionesCO";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

export type EstadoAgricultor =
  | "conocido_con_fincas"
  | "conocido_sin_finca"
  | "desconocido";

export type RolAgricultor = "titular" | "admin_finca" | "desconocido";

export interface FincaInfo {
  id: string;
  nombre: string;
  generadorId: string;
  estado: string;
  completitudOk: boolean;
  /** IDs de los cultivos linked. El consumer resuelve a nombres con
   *  getCultivosMap() según necesite. */
  cultivoIds: string[];
  /** IDs de certificados linked (reverse lookup en FINCAS). Usado para
   *  listar procesos pendientes en el menú del bot. */
  certIds: string[];
}

export interface GeneradorInfo {
  id: string;
  nombre: string;
  estado: string;
  /** "natural" | "juridica" (o vacío si legacy). */
  tipopersona: string;
}

export interface IdentidadAgricultor {
  estado: EstadoAgricultor;
  rol: RolAgricultor;
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

function mapFincaRecord(r: { id: string; fields: Record<string, unknown> }): FincaInfo {
  const ff = r.fields;
  const generadorIds = Array.isArray(ff.generador) ? (ff.generador as string[]) : [];
  const cultivoIds = Array.isArray(ff.cultivos)
    ? (ff.cultivos as string[]).map(String)
    : [];
  // Reverse lookup de certificados: el nombre exacto del campo varía
  // ("Certificados", "certificados", …) — detectamos por contenido.
  let certIds: string[] = [];
  for (const [key, val] of Object.entries(ff)) {
    if (
      /certificado/i.test(key) &&
      Array.isArray(val) &&
      val.length > 0 &&
      typeof val[0] === "string" &&
      (val[0] as string).startsWith("rec")
    ) {
      certIds = (val as string[]).map(String);
      break;
    }
  }
  return {
    id: r.id,
    nombre: String(ff.nombre || "").trim(),
    generadorId: generadorIds[0] || "",
    estado: String(ff.estado || "aprobado"),
    completitudOk: Boolean(ff.municipio && cultivoIds.length > 0),
    cultivoIds,
    certIds,
  };
}

function mapGeneradorRecord(
  r: { id: string; fields: Record<string, unknown> }
): GeneradorInfo {
  return {
    id: r.id,
    nombre: String(r.fields.nombre || "").trim(),
    estado: String(r.fields.estado || "aprobado"),
    tipopersona: String(r.fields.tipopersona || "").trim().toLowerCase(),
  };
}

async function buscarFincasPorTelefono(tel10: string): Promise<FincaInfo[]> {
  const formula = `RIGHT(REGEX_REPLACE({movil}&'', '[^0-9]', ''), 10) = '${tel10}'`;
  const url = `/FINCAS?filterByFormula=${encodeURIComponent(formula)}&pageSize=100`;
  const data = (await airtableFetch(url)) as {
    records: Array<{ id: string; fields: Record<string, unknown> }>;
  };
  return (data.records || []).map(mapFincaRecord);
}

interface GeneradorPorTelefonoRes {
  info: GeneradorInfo;
  fincaIds: string[];
}

async function buscarGeneradorPorTelefono(
  tel10: string
): Promise<GeneradorPorTelefonoRes | null> {
  const formula = `RIGHT(REGEX_REPLACE({movil}&'', '[^0-9]', ''), 10) = '${tel10}'`;
  const url = `/GENERADORES?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
  const data = (await airtableFetch(url)) as {
    records: Array<{ id: string; fields: Record<string, unknown> }>;
  };
  const r = data.records?.[0];
  if (!r) return null;
  const fincaIds = Array.isArray(r.fields.FINCAS)
    ? (r.fields.FINCAS as string[]).map(String)
    : [];
  return { info: mapGeneradorRecord(r), fincaIds };
}

async function buscarGeneradorPorId(id: string): Promise<GeneradorInfo | null> {
  try {
    const data = (await airtableFetch(`/GENERADORES/${id}`)) as {
      id: string;
      fields: Record<string, unknown>;
    };
    return mapGeneradorRecord(data);
  } catch {
    return null;
  }
}

/**
 * Trae las fincas dado el array de IDs (típicamente del campo lookup
 * `FINCAS` del generador padre). Usa `OR(RECORD_ID()='id1', ...)` en
 * filterByFormula. Reemplaza la fórmula vieja que usaba ARRAYJOIN sobre
 * el linked record `generador` — esa devolvía el display name, no el ID,
 * y por eso fallaba silenciosamente.
 */
async function traerFincasPorIds(ids: string[]): Promise<FincaInfo[]> {
  if (ids.length === 0) return [];
  const orParts = ids.map((id) => `RECORD_ID()='${id}'`).join(",");
  const formula = `OR(${orParts})`;
  const url = `/FINCAS?filterByFormula=${encodeURIComponent(formula)}&pageSize=100`;
  const data = (await airtableFetch(url)) as {
    records: Array<{ id: string; fields: Record<string, unknown> }>;
  };
  return (data.records || []).map(mapFincaRecord);
}

async function listarFincasDeGenerador(generadorId: string): Promise<FincaInfo[]> {
  // Fallback usado SOLO en admin_finca (no llega acá normalmente). Misma
  // fórmula vieja por ahora — bug conocido si el linked record no muestra
  // el ID. Para titular se usa traerFincasPorIds() vía el campo FINCAS
  // del generador.
  const formula = `FIND('${generadorId}', ARRAYJOIN({generador}, ',')) > 0`;
  const url = `/FINCAS?filterByFormula=${encodeURIComponent(formula)}&pageSize=100`;
  const data = (await airtableFetch(url)) as {
    records: Array<{ id: string; fields: Record<string, unknown> }>;
  };
  return (data.records || []).map(mapFincaRecord);
}

export async function identificarAgricultor(
  telefono: string
): Promise<IdentidadAgricultor> {
  const tel10 = normalizarMovilCO(telefono);
  if (!tel10 || tel10.length < 10) {
    return {
      estado: "desconocido",
      rol: "desconocido",
      telefonoNormalizado: tel10,
      generador: null,
      fincas: [],
    };
  }

  // Búsqueda paralela en ambas tablas.
  const [generadorPorMovil, fincasPorMovil] = await Promise.all([
    buscarGeneradorPorTelefono(tel10),
    buscarFincasPorTelefono(tel10),
  ]);

  // CASO 1: número en GENERADOR → rol titular, traer todas sus fincas.
  // Usamos el campo lookup `FINCAS` del generador (array de record IDs)
  // en vez de filtrar FINCAS por el linked record `generador` — esa fórmula
  // fallaba porque ARRAYJOIN sobre linked records devuelve display names.
  if (generadorPorMovil) {
    const todasLasFincas = await traerFincasPorIds(generadorPorMovil.fincaIds);
    const fincasAprobadas = todasLasFincas.filter((f) => f.estado === "aprobado");
    return {
      estado:
        fincasAprobadas.length > 0 ? "conocido_con_fincas" : "conocido_sin_finca",
      rol: "titular",
      telefonoNormalizado: tel10,
      generador: generadorPorMovil.info,
      fincas: todasLasFincas,
    };
  }

  // CASO 2: número solo en FINCAS → rol admin_finca.
  if (fincasPorMovil.length > 0) {
    const generadorId = fincasPorMovil[0].generadorId;
    const generador = generadorId ? await buscarGeneradorPorId(generadorId) : null;
    const fincasAprobadas = fincasPorMovil.filter((f) => f.estado === "aprobado");
    return {
      estado:
        fincasAprobadas.length > 0 ? "conocido_con_fincas" : "conocido_sin_finca",
      rol: "admin_finca",
      telefonoNormalizado: tel10,
      generador,
      fincas: fincasPorMovil,
    };
  }

  // CASO 3: nada.
  return {
    estado: "desconocido",
    rol: "desconocido",
    telefonoNormalizado: tel10,
    generador: null,
    fincas: [],
  };
}
