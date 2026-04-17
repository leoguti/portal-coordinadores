import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { evaluarCompletitud } from "@/lib/terceros";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

export async function GET(
  _req: NextRequest,
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

  return NextResponse.json({
    id: rec.id,
    fields: rec.fields,
    completitud,
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
  if (body.tipo !== undefined) {
    fields.Tipo = Array.isArray(body.tipo) ? body.tipo : [body.tipo];
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
