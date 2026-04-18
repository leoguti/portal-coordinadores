import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { evaluarCompletitud } from "@/lib/terceros";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/Terceros/${id}`, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const rec = await res.json();
  const completitud = evaluarCompletitud(rec.fields);

  // Si se pide chequear planilla para un mes específico (solo aplica a naturales)
  let planillaCheck: { mes: string; ok: boolean; aplica: boolean } | null = null;
  const mesParam = req.nextUrl.searchParams.get("mesPlanilla");
  if (mesParam && /^\d{4}-\d{2}$/.test(mesParam)) {
    const esNatural = rec.fields.tipo_persona === "Natural";
    if (!esNatural) {
      planillaCheck = { mes: mesParam, ok: true, aplica: false };
    } else {
      const pRes = await fetch(
        `https://api.airtable.com/v0/${BASE}/PlanillasSS?filterByFormula=${encodeURIComponent(`{mes_periodo} = '${mesParam}'`)}&pageSize=100`,
        { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" }
      );
      const pData = await pRes.json();
      const ok = (pData.records || []).some(
        (r: any) => (r.fields.tercero || []).includes(id) && (r.fields.archivo || []).length > 0
      );
      planillaCheck = { mes: mesParam, ok, aplica: true };
    }
  }

  return NextResponse.json({
    id: rec.id,
    fields: rec.fields,
    completitud,
    planillaCheck,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Whitelist de campos que aceptamos
  const fields: Record<string, unknown> = {};
  const mapping: Record<string, string> = {
    razonSocial: "RazonSocial",
    nit: "NIT",
    direccion: "Direccion",
    movil: "Movil",
    correo: "Correo Electrónico",
    observaciones: "Observaciones",
    tipoPersona: "tipo_persona",
    proceso: "proceso",
  };

  for (const [k, v] of Object.entries(body)) {
    if (k in mapping && v !== undefined) {
      fields[mapping[k]] = v;
    }
  }

  if (body.municipioId !== undefined) {
    fields.Municipio = body.municipioId ? [body.municipioId] : [];
  }
  if (body.cedulaPdf !== undefined) {
    fields.cedula_pdf = body.cedulaPdf;
  }
  if (body.certificadoCamaraPdf !== undefined) {
    fields.certificado_camara_pdf = body.certificadoCamaraPdf;
  }
  if (body.rutPdf !== undefined) {
    fields.rut_pdf = body.rutPdf;
  }
  if (body.certificacionBancariaPdf !== undefined) {
    fields.certificacion_bancaria_pdf = body.certificacionBancariaPdf;
  }
  if (body.coordinadorResponsableId !== undefined) {
    fields.coordinador_responsable = body.coordinadorResponsableId ? [body.coordinadorResponsableId] : [];
  }

  const res = await fetch(`https://api.airtable.com/v0/${BASE}/Terceros/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[terceros/patch]", err);
    return NextResponse.json({ error: "Error al guardar", detail: err }, { status: 500 });
  }

  const rec = await res.json();
  const completitud = evaluarCompletitud(rec.fields);
  return NextResponse.json({ id: rec.id, fields: rec.fields, completitud });
}
