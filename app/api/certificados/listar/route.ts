import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildCertificadosFilterFormula } from "@/lib/certificadosFilters";
import { getCultivosMap } from "@/lib/cultivosCache";
import { isAdminOrSupervisor } from "@/lib/roles";

export const maxDuration = 60;

interface CertificadoItem {
  id: string;
  consecutivo: string | number;
  fechadevolucion: string;
  nombregenerador: string;
  cedulagenerador: string;
  emailgenerador: string;
  municipiogenerador: string;
  departamento: string;
  cultivos: string[];
  coordinador: string;
  total: number;
  pdfUrl: string | null;
  estado: string;
  motivoAnulacion: string;
  fechaAnulacion: string;
}

const FIELDS_TO_FETCH = [
  "consecutivo",
  "fechadevolucion",
  "nombregenerador",
  "cedulagenerador",
  "emailgenerador",
  "municipiogenerador",
  "Departamento",
  "cultivos_certificado",
  "nombrecoordinador",
  "total",
  "certificadopdf",
  "estado",
  "motivo_anulacion",
  "fecha_anulacion",
  "anulado_por",
  // Esquema nuevo: vínculo a FINCAS (usado para rellenar lookups vacíos en
  // certs nuevos, ver enrichRecordsViaFincas).
  "FINCAS",
];

function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function firstString(v: unknown): string {
  if (Array.isArray(v)) return v[0] != null ? String(v[0]) : "";
  if (v == null) return "";
  return String(v);
}

function buildSelectorParams(
  filterFormula: string,
  pageSize: number,
  offset: string | null
): URLSearchParams {
  const params = new URLSearchParams();
  for (const f of FIELDS_TO_FETCH) params.append("fields[]", f);
  params.append("sort[0][field]", "fechadevolucion");
  params.append("sort[0][direction]", "desc");
  params.set("pageSize", String(pageSize));
  if (filterFormula) params.set("filterByFormula", filterFormula);
  if (offset) params.set("offset", offset);
  return params;
}

async function resolveFincaNombres(
  apiKey: string,
  baseId: string,
  fincaIds: string[]
): Promise<string[]> {
  if (fincaIds.length === 0) return [];
  // Una llamada por finca (son pocas, máx 1 o pocos). Si crece, optimizar con filterByFormula OR.
  const promises = fincaIds.map(async (id) => {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/FINCAS/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rec = await res.json();
    const nombre = String(rec.fields?.nombre || "").trim();
    return nombre || null;
  });
  const results = await Promise.all(promises);
  return results.filter((x): x is string => !!x);
}

async function resolveFincasDelGenerador(
  apiKey: string,
  baseId: string,
  generadorId: string
): Promise<string[]> {
  const res = await fetch(
    `https://api.airtable.com/v0/${baseId}/GENERADORES/${generadorId}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return [];
  const rec = await res.json();
  const fincaIds = Array.isArray(rec.fields?.FINCAS) ? rec.fields.FINCAS : [];
  return resolveFincaNombres(apiKey, baseId, fincaIds);
}

/**
 * Para certs del esquema nuevo (GENERADORES + FINCAS), los lookups antiguos
 * (nombregenerador, cedulagenerador, municipiogenerador) están VACÍOS porque
 * apuntan a `link_ubicacion` (legacy) que ya no se llena. Esta función los
 * rellena resolviendo en batch vía FINCAS → GENERADORES → MUNICIPIOS.
 *
 * Estrategia: 3 calls Airtable en paralelo (no 1 por cert), solo para los
 * records que tienen FINCAS pero nombregenerador vacío.
 */
async function enrichRecordsViaFincas(
  apiKey: string,
  baseId: string,
  records: CertificadoItem[],
  fincaIdsByRecord: Map<string, string>
): Promise<void> {
  const fincaIds = Array.from(new Set(fincaIdsByRecord.values()));
  if (fincaIds.length === 0) return;

  // 1) Traer las FINCAS necesarias en una sola call (OR de RECORD_ID).
  const orClause = fincaIds.map((id) => `RECORD_ID()='${id}'`).join(",");
  const filterFormula = fincaIds.length === 1 ? orClause : `OR(${orClause})`;
  const fincasParams = new URLSearchParams();
  for (const f of ["nombre", "generador", "municipio"]) {
    fincasParams.append("fields[]", f);
  }
  fincasParams.set("filterByFormula", filterFormula);
  fincasParams.set("pageSize", "100");
  const fincasRes = await fetch(
    `https://api.airtable.com/v0/${baseId}/FINCAS?${fincasParams.toString()}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
  );
  if (!fincasRes.ok) return;
  const fincasData = await fincasRes.json();
  const fincaById = new Map<
    string,
    { nombre: string; generadorId: string | null; municipioId: string | null }
  >();
  for (const rec of fincasData.records || []) {
    const gens = arr<string>(rec.fields?.generador);
    const muns = arr<string>(rec.fields?.municipio);
    fincaById.set(rec.id, {
      nombre: String(rec.fields?.nombre || "").trim(),
      generadorId: gens[0] ? String(gens[0]) : null,
      municipioId: muns[0] ? String(muns[0]) : null,
    });
  }

  // 2) Traer GENERADORES en una sola call.
  const generadorIds = Array.from(
    new Set(
      Array.from(fincaById.values())
        .map((f) => f.generadorId)
        .filter((x): x is string => !!x)
    )
  );
  const generadorById = new Map<string, { nombre: string; nit: string }>();
  if (generadorIds.length > 0) {
    const orGen = generadorIds.map((id) => `RECORD_ID()='${id}'`).join(",");
    const genFormula = generadorIds.length === 1 ? orGen : `OR(${orGen})`;
    const genParams = new URLSearchParams();
    for (const f of ["nombre", "nit"]) genParams.append("fields[]", f);
    genParams.set("filterByFormula", genFormula);
    genParams.set("pageSize", "100");
    const genRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/GENERADORES?${genParams.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (genRes.ok) {
      const genData = await genRes.json();
      for (const rec of genData.records || []) {
        generadorById.set(rec.id, {
          nombre: String(rec.fields?.nombre || "").trim(),
          nit: String(rec.fields?.nit || "").trim(),
        });
      }
    }
  }

  // 3) Traer MUNICIPIOS en una sola call.
  const municipioIds = Array.from(
    new Set(
      Array.from(fincaById.values())
        .map((f) => f.municipioId)
        .filter((x): x is string => !!x)
    )
  );
  const municipioById = new Map<string, string>();
  if (municipioIds.length > 0) {
    const orMun = municipioIds.map((id) => `RECORD_ID()='${id}'`).join(",");
    const munFormula = municipioIds.length === 1 ? orMun : `OR(${orMun})`;
    const munParams = new URLSearchParams();
    for (const f of ["mundep"]) munParams.append("fields[]", f);
    munParams.set("filterByFormula", munFormula);
    munParams.set("pageSize", "100");
    const munRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/MUNICIPIOS?${munParams.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (munRes.ok) {
      const munData = await munRes.json();
      for (const rec of munData.records || []) {
        municipioById.set(rec.id, String(rec.fields?.mundep || "").trim());
      }
    }
  }

  // 4) Rellenar in-place los records que estaban vacíos.
  for (const r of records) {
    const fincaId = fincaIdsByRecord.get(r.id);
    if (!fincaId) continue;
    const finca = fincaById.get(fincaId);
    if (!finca) continue;
    if (!r.nombregenerador && finca.generadorId) {
      const gen = generadorById.get(finca.generadorId);
      if (gen) {
        r.nombregenerador = gen.nombre;
        if (!r.cedulagenerador) r.cedulagenerador = gen.nit;
      }
    }
    if (!r.municipiogenerador && finca.municipioId) {
      const mundep = municipioById.get(finca.municipioId);
      if (mundep) {
        r.municipiogenerador = mundep;
        // El departamento también: extraerlo del mundep si está vacío.
        if (!r.departamento && mundep.includes(" - ")) {
          r.departamento = mundep.split(" - ")[1] || "";
        }
      }
    }
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return NextResponse.json(
      { error: "Airtable no configurado" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);

  const pageSize = Math.min(
    100,
    Math.max(10, parseInt(searchParams.get("pageSize") || "50", 10) || 50)
  );
  const offset = searchParams.get("offset");
  const ano = searchParams.get("ano") || "";
  const mes = searchParams.get("mes") || "";
  const consecutivo = (searchParams.get("consecutivo") || "").trim();
  const generadorId = (searchParams.get("generador") || "").trim();
  const fincaId = (searchParams.get("finca") || "").trim();

  const departamentos = searchParams.getAll("departamento");
  const municipios = searchParams.getAll("municipio");
  const cultivoNombres = searchParams.getAll("cultivo");
  const coordinadorIds = searchParams.getAll("coordinador");
  // Estados a incluir. Default: solo aprobados. Pasar ?estado=anulado para
  // la vista de auditoría, o ?estado=aprobado&estado=anulado para incluir.
  const estados = searchParams.getAll("estado");

  const canViewAll = isAdminOrSupervisor(session.user.rol);
  const forceCoordinadorId = canViewAll
    ? undefined
    : session.user.coordinatorRecordId;

  // Resolver finca/generador → nombres de fincas para filterByFormula.
  // Prioridad: si vienen ambos, la finca específica gana.
  let fincaNombres: string[] = [];
  try {
    if (fincaId) {
      fincaNombres = await resolveFincaNombres(apiKey, baseId, [fincaId]);
    } else if (generadorId) {
      fincaNombres = await resolveFincasDelGenerador(apiKey, baseId, generadorId);
      // Si el generador no tiene fincas, devolvemos vacío inmediatamente.
      if (fincaNombres.length === 0) {
        return NextResponse.json({
          records: [],
          pageSize,
          count: 0,
          nextOffset: null,
          hasMore: false,
        });
      }
    }
  } catch (err) {
    console.error("Error resolviendo finca/generador:", err);
  }

  const filterFormula = buildCertificadosFilterFormula({
    ano: ano || undefined,
    departamentos,
    municipios,
    cultivoNombres,
    coordinadorIds,
    fincaNombres,
    mes: mes || undefined,
    forceCoordinadorId,
    consecutivo: consecutivo || undefined,
    estados: estados.length > 0 ? estados : undefined,
  });

  try {
    const params = buildSelectorParams(filterFormula, pageSize, offset);
    const url = `https://api.airtable.com/v0/${baseId}/Certificados?${params.toString()}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`Airtable error ${res.status}:`, text);
      return NextResponse.json(
        { error: "Error consultando Certificados" },
        { status: 500 }
      );
    }

    const data = await res.json();

    // Resolver cultivos linked IDs → nombres
    let cultivosMap: Map<string, string> = new Map();
    try {
      cultivosMap = await getCultivosMap();
    } catch (err) {
      console.error("Error cargando cultivos cache:", err);
    }

    // Mapa de recordId → fincaId del primer FINCAS vinculado, usado por
    // enrichRecordsViaFincas para resolver datos del esquema nuevo.
    const fincaIdsByRecord = new Map<string, string>();

    const records: CertificadoItem[] = (data.records || []).map(
      (rec: { id: string; fields: Record<string, unknown> }) => {
        const f = rec.fields;
        const pdfAttachments = arr<{ url?: string }>(f["certificadopdf"]);
        const pdfUrl = pdfAttachments[0]?.url || null;
        const cultivoIds = arr<string>(f["cultivos_certificado"]).map((c) =>
          String(c)
        );
        const cultivos = cultivoIds.map(
          (id) => cultivosMap.get(id) || id
        );
        const nombregenerador = firstString(f["nombregenerador"]);
        const fincasLink = arr<string>(f["FINCAS"]).map((x) => String(x));
        // Guardar fincaId solo si el lookup viejo viene vacío (esquema nuevo).
        if (!nombregenerador && fincasLink[0]) {
          fincaIdsByRecord.set(rec.id, fincasLink[0]);
        }
        return {
          id: rec.id,
          consecutivo: (f["consecutivo"] as string | number) ?? "",
          fechadevolucion: firstString(f["fechadevolucion"]),
          nombregenerador,
          cedulagenerador: firstString(f["cedulagenerador"]),
          emailgenerador: firstString(f["emailgenerador"]),
          municipiogenerador: firstString(f["municipiogenerador"]),
          departamento: firstString(f["Departamento"]),
          cultivos,
          coordinador: firstString(f["nombrecoordinador"]),
          total: typeof f["total"] === "number" ? (f["total"] as number) : 0,
          pdfUrl,
          estado: firstString(f["estado"]) || "aprobado",
          motivoAnulacion: firstString(f["motivo_anulacion"]),
          fechaAnulacion: firstString(f["fecha_anulacion"]),
        };
      }
    );

    // Rellenar nombregenerador/cedulagenerador/municipiogenerador/depto en
    // records nuevos (esquema GENERADORES+FINCAS) cuyos lookups viejos vienen
    // vacíos porque apuntan a link_ubicacion (legacy ya no usado).
    if (fincaIdsByRecord.size > 0) {
      try {
        await enrichRecordsViaFincas(apiKey, baseId, records, fincaIdsByRecord);
      } catch (err) {
        console.error("Error enriqueciendo records vía FINCAS:", err);
      }
    }

    return NextResponse.json({
      records,
      pageSize,
      count: records.length,
      nextOffset: data.offset || null,
      hasMore: Boolean(data.offset),
    });
  } catch (error) {
    console.error("Error listando certificados:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
