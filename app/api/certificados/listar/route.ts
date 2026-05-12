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
  municipiogenerador: string;
  departamento: string;
  cultivos: string[];
  coordinador: string;
  total: number;
  pdfUrl: string | null;
}

const FIELDS_TO_FETCH = [
  "consecutivo",
  "fechadevolucion",
  "nombregenerador",
  "cedulagenerador",
  "municipiogenerador",
  "Departamento",
  "cultivos_certificado",
  "nombrecoordinador",
  "total",
  "certificadopdf",
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
  const generadorId = (searchParams.get("generador") || "").trim();
  const fincaId = (searchParams.get("finca") || "").trim();

  const departamentos = searchParams.getAll("departamento");
  const municipios = searchParams.getAll("municipio");
  const cultivoNombres = searchParams.getAll("cultivo");
  const coordinadorIds = searchParams.getAll("coordinador");

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
        return {
          id: rec.id,
          consecutivo: (f["consecutivo"] as string | number) ?? "",
          fechadevolucion: firstString(f["fechadevolucion"]),
          nombregenerador: firstString(f["nombregenerador"]),
          cedulagenerador: firstString(f["cedulagenerador"]),
          municipiogenerador: firstString(f["municipiogenerador"]),
          departamento: firstString(f["Departamento"]),
          cultivos,
          coordinador: firstString(f["nombrecoordinador"]),
          total: typeof f["total"] === "number" ? (f["total"] as number) : 0,
          pdfUrl,
        };
      }
    );

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
