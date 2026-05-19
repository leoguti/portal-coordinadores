/**
 * Resuelve, a partir de una FINCA, todos los datos del generador que el
 * certificado necesita "congelados" al momento de emitir.
 *
 * Esquema nuevo (GENERADORES + FINCAS) — reemplaza la cadena vieja basada en
 * `ubicaciones` + lookups de Certificados vía `link_ubicacion`. Ver
 * memory/project_certificados_migracion_fincas.md.
 *
 * El endpoint resuelve los datos él mismo (no depende de lookups de Airtable):
 *   - nombregenerador     = GENERADORES.nombre
 *   - cedulagenerador     = GENERADORES.nit
 *   - direcciongenerador  = GENERADORES.direccion_sede
 *   - tipogenerador       = GENERADORES.tipo
 *   - cultivogenerador    = nombres de FINCAS.cultivos unidos ", "
 *   - municipiogenerador  = mundep del MUNICIPIOS de la finca
 *   - movil/email         = el de la FINCA y si está vacío el del GENERADOR
 */

import { getCultivosMap } from "./cultivosCache";

export interface ResolvedGeneradorData {
  fincaId: string;
  fincaNombre: string;
  generadorId: string;
  nombregenerador: string;
  cedulagenerador: string;
  direcciongenerador: string;
  cultivogenerador: string;
  /** IDs de CULTIVOS para congelar en cultivos_certificado (linked record). */
  cultivoIds: string[];
  municipiogenerador: string;
  tipogenerador: string;
  movilgenerador: string;
  emailgenerador: string;
}

function firstId(v: unknown): string | null {
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  return null;
}

async function getRecord(
  apiKey: string,
  baseId: string,
  table: string,
  id: string
): Promise<{ id: string; fields: Record<string, unknown> } | null> {
  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/${table}/${id}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export async function resolveGeneradorDataFromFinca(
  apiKey: string,
  baseId: string,
  fincaId: string
): Promise<ResolvedGeneradorData> {
  const finca = await getRecord(apiKey, baseId, "FINCAS", fincaId);
  if (!finca) {
    throw new Error(`Finca ${fincaId} no encontrada`);
  }
  const ff = finca.fields;

  const generadorId = firstId(ff.generador);
  if (!generadorId) {
    throw new Error(
      `La finca ${fincaId} no tiene generador vinculado; no se puede emitir certificado`
    );
  }

  const generador = await getRecord(apiKey, baseId, "GENERADORES", generadorId);
  if (!generador) {
    throw new Error(`Generador ${generadorId} no encontrado`);
  }
  const gf = generador.fields;

  // Municipio de la finca → string mundep ("Municipio - Departamento")
  let municipiogenerador = "";
  const municipioId = firstId(ff.municipio);
  if (municipioId) {
    const mun = await getRecord(apiKey, baseId, "MUNICIPIOS", municipioId);
    municipiogenerador = mun ? String(mun.fields?.mundep || "").trim() : "";
  }

  // Cultivos de la finca → ids (para congelar) + nombres (para el PDF)
  const cultivoIds = Array.isArray(ff.cultivos)
    ? (ff.cultivos as string[]).map(String)
    : [];
  let cultivogenerador = "";
  if (cultivoIds.length > 0) {
    try {
      const map = await getCultivosMap();
      cultivogenerador = cultivoIds
        .map((id) => map.get(id) || "")
        .filter(Boolean)
        .join(", ");
    } catch {
      cultivogenerador = "";
    }
  }

  const fincaMovil = String(ff.movil || "").trim();
  const fincaEmail = String(ff.email || "").trim();
  const genMovil = String(gf.movil || "").trim();
  const genEmail = String(gf.email || "").trim();

  return {
    fincaId,
    fincaNombre: String(ff.nombre || "").trim(),
    generadorId,
    nombregenerador: String(gf.nombre || "").trim(),
    cedulagenerador: String(gf.nit || "").trim(),
    direcciongenerador: String(gf.direccion_sede || "").trim(),
    cultivogenerador,
    cultivoIds,
    municipiogenerador,
    tipogenerador: String(gf.tipo || "").trim(),
    movilgenerador: fincaMovil || genMovil,
    emailgenerador: fincaEmail || genEmail,
  };
}
