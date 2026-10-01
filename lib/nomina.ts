/**
 * Nómina mensual (costo empresa por persona) para el indicador de costo por kilo.
 *
 * Fuente: el Excel que Ángela liquida a mano, con la hoja `RESUMEN_COSTOS`
 * (fórmulas que leen sus hojas por persona, «Aporte» y «Prestacion»).
 * El portal lee SOLO esa hoja: encabezados en la fila 5, datos desde la 6,
 * columnas A–P en orden fijo. Se guardan solo las cifras resumidas (no el
 * archivo) en la tabla Airtable `NominaMensual`, una fila por persona y mes.
 *
 * Confidencial: el detalle por persona solo lo ven los correos de NOMINA_EMAILS.
 */
import * as XLSX from "xlsx";

export const NOMINA_TABLE = "NominaMensual";
export const HOJA_RESUMEN = "RESUMEN_COSTOS";

/** Correos autorizados para cargar y ver la nómina por persona. */
export function nominaEmails(): string[] {
  const env = process.env.NOMINA_EMAILS;
  const lista = env
    ? env.split(",")
    : ["administrativa@campolimpio.org", "direccion@campolimpio.org"];
  return lista.map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function puedeGestionarNomina(email?: string | null): boolean {
  return !!email && nominaEmails().includes(email.trim().toLowerCase());
}

export interface FilaNomina {
  mes: string;
  documento: string;
  persona: string;
  cargo: string;
  centroCosto: number | null;
  tipo: "Zona" | "Oficina";
  devengado: number;
  aportesEmpresa: number;
  prestaciones: number;
  mediosTransporte: number;
  otrosAuxilios: number;
  costoTotalEmpresa: number;
  zona1: string;
  pct1: number; // fracción 0..1
  zona2: string;
  pct2: number;
}

export interface ResultadoLectura {
  mes: string | null;
  filas: FilaNomina[];
  errores: string[];
  alertas: string[];
}

const num = (v: unknown): number => {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(/[$\s.]/g, "").replace(",", "."));
    return isFinite(n) ? n : 0;
  }
  return 0;
};
const txt = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
/** % puede venir como fracción (0.7) o como número (70). */
const pct = (v: unknown): number => {
  const n = num(v);
  return n > 1 ? n / 100 : n;
};

/**
 * Lee la hoja RESUMEN_COSTOS de un .xlsx y valida. Usa los valores
 * calculados que Excel guarda junto a las fórmulas.
 */
export function leerResumenCostos(
  buffer: ArrayBuffer | Buffer,
  zonasValidas: string[]
): ResultadoLectura {
  const errores: string[] = [];
  const alertas: string[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { mes: null, filas: [], errores: ["No se pudo leer el archivo. Debe ser un Excel .xlsx."], alertas };
  }
  const ws = wb.Sheets[HOJA_RESUMEN];
  if (!ws) {
    return {
      mes: null,
      filas: [],
      errores: [`El archivo no tiene la hoja «${HOJA_RESUMEN}».`],
      alertas,
    };
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  const mesHoja = txt((rows[1] || [])[1]); // B2
  const zonasSet = new Set(zonasValidas.map((z) => z.toUpperCase()));
  const filas: FilaNomina[] = [];
  let sinValores = 0;

  for (let i = 5; i < rows.length; i++) {
    const r = rows[i] || [];
    const persona = txt(r[2]);
    if (!persona || /^totales?$/i.test(persona)) continue;
    const fila = i + 1;
    const documento = txt(r[1]).replace(/\D/g, "");
    const centro = num(r[4]) || null;
    const costo = num(r[11]);
    const f: FilaNomina = {
      mes: txt(r[0]) || mesHoja,
      documento,
      persona,
      cargo: txt(r[3]),
      centroCosto: centro,
      tipo: txt(r[5]).toLowerCase().startsWith("ofi") || centro === 101 ? "Oficina" : "Zona",
      devengado: num(r[6]),
      aportesEmpresa: num(r[7]),
      prestaciones: num(r[8]),
      mediosTransporte: num(r[9]),
      otrosAuxilios: num(r[10]),
      costoTotalEmpresa: costo,
      zona1: txt(r[12]).toUpperCase(),
      pct1: pct(r[13]),
      zona2: txt(r[14]).toUpperCase(),
      pct2: pct(r[15]),
    };
    if (!costo) sinValores++;
    if (!/^\d{4}-\d{2}$/.test(f.mes)) errores.push(`Fila ${fila} (${persona}): el mes debe tener formato AAAA-MM.`);
    if (!documento) errores.push(`Fila ${fila} (${persona}): falta la cédula.`);
    if (f.tipo === "Zona") {
      const suma = Math.round((f.pct1 + f.pct2) * 100);
      if (!f.zona1) errores.push(`Fila ${fila} (${persona}): falta la zona.`);
      else if (suma !== 100) errores.push(`Fila ${fila} (${persona}): los % de zona suman ${suma} %, deben sumar 100 %.`);
      for (const z of [f.zona1, f.zona2]) {
        if (z && !zonasSet.has(z)) errores.push(`Fila ${fila} (${persona}): la zona «${z}» no existe en el portal.`);
      }
    }
    filas.push(f);
  }

  if (filas.length === 0) errores.push("La hoja RESUMEN_COSTOS no tiene personas (se leen desde la fila 6).");
  if (sinValores > 0 && sinValores === filas.length) {
    errores.push(
      "La hoja no trae valores calculados. Abra el archivo en Excel, guárdelo y vuelva a subirlo."
    );
  } else if (sinValores > 0) {
    alertas.push(`${sinValores} persona(s) con costo total en cero.`);
  }
  const meses = [...new Set(filas.map((f) => f.mes))];
  if (meses.length > 1) errores.push(`La hoja mezcla varios meses (${meses.join(", ")}). Debe ser un solo mes.`);
  const docs = filas.map((f) => f.documento).filter(Boolean);
  const dup = docs.filter((d, i) => docs.indexOf(d) !== i);
  if (dup.length) errores.push(`Cédulas repetidas: ${[...new Set(dup)].join(", ")}.`);

  return { mes: meses[0] || null, filas, errores, alertas };
}

// ─── Airtable ────────────────────────────────────────────────────────────────

const API = () => `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${NOMINA_TABLE}`;
const headers = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
  "Content-Type": "application/json",
});

interface RegistroNomina {
  id: string;
  fields: Record<string, unknown>;
}

async function listarRegistros(formula?: string): Promise<RegistroNomina[]> {
  const out: RegistroNomina[] = [];
  let offset: string | undefined;
  do {
    const u = new URL(API());
    if (formula) u.searchParams.set("filterByFormula", formula);
    if (offset) u.searchParams.set("offset", offset);
    const r = await fetch(u, { headers: headers(), cache: "no-store" });
    if (!r.ok) throw new Error(`Airtable NominaMensual ${r.status}: ${await r.text()}`);
    const j = (await r.json()) as { records: RegistroNomina[]; offset?: string };
    out.push(...j.records);
    offset = j.offset;
  } while (offset);
  return out;
}

const aFila = (f: Record<string, unknown>): FilaNomina => ({
  mes: txt(f.Mes),
  documento: txt(f.Documento),
  persona: txt(f.Persona),
  cargo: txt(f.Cargo),
  centroCosto: num(f.CentroCosto) || null,
  tipo: f.Tipo === "Oficina" ? "Oficina" : "Zona",
  devengado: num(f.Devengado),
  aportesEmpresa: num(f.AportesEmpresa),
  prestaciones: num(f.Prestaciones),
  mediosTransporte: num(f.MediosTransporte),
  otrosAuxilios: num(f.OtrosAuxilios),
  costoTotalEmpresa: num(f.CostoTotalEmpresa),
  zona1: txt(f.Zona1),
  pct1: num(f.Pct1),
  zona2: txt(f.Zona2),
  pct2: num(f.Pct2),
});

/** Nómina de un año (todas las personas). */
export async function getNominaDelAnio(year: number): Promise<FilaNomina[]> {
  const recs = await listarRegistros(`LEFT({Mes},4)='${year}'`);
  return recs.map((r) => aFila(r.fields));
}

/** Resumen por mes: personas y costo total cargado. */
export async function getMesesCargados(): Promise<
  { mes: string; personas: number; costoTotal: number; fechaCarga: string; cargadoPor: string }[]
> {
  const recs = await listarRegistros();
  const m = new Map<string, { mes: string; personas: number; costoTotal: number; fechaCarga: string; cargadoPor: string }>();
  for (const r of recs) {
    const mes = txt(r.fields.Mes);
    const a = m.get(mes) || { mes, personas: 0, costoTotal: 0, fechaCarga: "", cargadoPor: "" };
    a.personas++;
    a.costoTotal += num(r.fields.CostoTotalEmpresa);
    const fc = txt(r.fields.FechaCarga);
    if (fc > a.fechaCarga) {
      a.fechaCarga = fc;
      a.cargadoPor = txt(r.fields.CargadoPor);
    }
    m.set(mes, a);
  }
  return [...m.values()].sort((a, b) => b.mes.localeCompare(a.mes));
}

/**
 * Guarda la nómina de un mes: reemplaza por completo lo que hubiera para ese mes
 * (actualiza por Clave = Mes|Documento, crea las nuevas, borra las que ya no están).
 */
export async function guardarNominaMes(
  filas: FilaNomina[],
  cargadoPor: string
): Promise<{ creadas: number; actualizadas: number; borradas: number }> {
  const mes = filas[0]?.mes;
  if (!mes) throw new Error("Sin filas para guardar");
  const existentes = await listarRegistros(`{Mes}='${mes}'`);
  const porClave = new Map(existentes.map((r) => [txt(r.fields.Clave), r.id]));
  const ahora = new Date().toISOString();
  const campos = (f: FilaNomina) => ({
    Clave: `${f.mes}|${f.documento}`,
    Mes: f.mes,
    Documento: f.documento,
    Persona: f.persona,
    Cargo: f.cargo,
    CentroCosto: f.centroCosto,
    Tipo: f.tipo,
    Devengado: Math.round(f.devengado),
    AportesEmpresa: Math.round(f.aportesEmpresa),
    Prestaciones: Math.round(f.prestaciones),
    MediosTransporte: Math.round(f.mediosTransporte),
    OtrosAuxilios: Math.round(f.otrosAuxilios),
    CostoTotalEmpresa: Math.round(f.costoTotalEmpresa),
    Zona1: f.zona1 || null,
    Pct1: f.pct1 || null,
    Zona2: f.zona2 || null,
    Pct2: f.pct2 || null,
    CargadoPor: cargadoPor,
    FechaCarga: ahora,
  });

  const actualizar: { id: string; fields: Record<string, unknown> }[] = [];
  const crear: { fields: Record<string, unknown> }[] = [];
  const vigentes = new Set<string>();
  for (const f of filas) {
    const c = campos(f);
    vigentes.add(c.Clave);
    const id = porClave.get(c.Clave);
    if (id) actualizar.push({ id, fields: c });
    else crear.push({ fields: c });
  }
  const borrar = existentes.filter((r) => !vigentes.has(txt(r.fields.Clave))).map((r) => r.id);

  const lotes = <T>(a: T[]) => Array.from({ length: Math.ceil(a.length / 10) }, (_, i) => a.slice(i * 10, i * 10 + 10));
  for (const l of lotes(actualizar)) {
    const r = await fetch(API(), { method: "PATCH", headers: headers(), body: JSON.stringify({ records: l, typecast: true }) });
    if (!r.ok) throw new Error(`Actualizar nómina: ${await r.text()}`);
  }
  for (const l of lotes(crear)) {
    const r = await fetch(API(), { method: "POST", headers: headers(), body: JSON.stringify({ records: l, typecast: true }) });
    if (!r.ok) throw new Error(`Crear nómina: ${await r.text()}`);
  }
  for (const l of lotes(borrar)) {
    const u = new URL(API());
    l.forEach((id) => u.searchParams.append("records[]", id));
    const r = await fetch(u, { method: "DELETE", headers: headers() });
    if (!r.ok) throw new Error(`Borrar nómina: ${await r.text()}`);
  }
  return { creadas: crear.length, actualizadas: actualizar.length, borradas: borrar.length };
}
