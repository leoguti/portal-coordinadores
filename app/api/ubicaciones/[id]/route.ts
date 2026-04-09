import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/ubicaciones/[id]
 * Obtiene una ubicación por ID de Airtable.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = params;
  const apiKey = process.env.AIRTABLE_API_KEY!;
  const baseId = process.env.AIRTABLE_BASE_ID!;

  try {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/ubicaciones/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Ubicación no encontrada" }, { status: 404 });
    }

    const r = await res.json();
    return NextResponse.json({
      id: r.id,
      nombre: r.fields.nombregenerador || "",
      cedula: r.fields.cedulagenerador || "",
      direccion: r.fields.direcciongenerador || "",
      municipio: r.fields.municipiogenerador || "",
      mundep: r.fields.mundep?.[0] || r.fields.municipiogenerador || "",
      cultivo: r.fields.cultivogenerador || "",
      email: r.fields.emailgenerador || "",
      movil: r.fields.movilgenerador || "",
      tipo: r.fields.tipogenerador || "",
      conteo_certificados: r.fields.conteo_certificados ?? 0,
      codigomunId: r.fields.CODIGOMUN?.[0] || null,
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/ubicaciones/[id]
 * Actualiza campos editables de una ubicación.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = params;
  const apiKey = process.env.AIRTABLE_API_KEY!;
  const baseId = process.env.AIRTABLE_BASE_ID!;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { nombre, cedula, direccion, cultivo, municipioId, movil, email } = body;

  if (!nombre || !cedula || !direccion || !cultivo || !movil) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: nombre, cedula, direccion, cultivo, movil" },
      { status: 400 }
    );
  }

  const fields: Record<string, unknown> = {
    nombregenerador: String(nombre).trim(),
    cedulagenerador: String(cedula).trim(),
    direcciongenerador: String(direccion).trim(),
    cultivogenerador: String(cultivo).trim(),
    movilgenerador: String(movil).trim(),
  };
  if (email) fields.emailgenerador = String(email).trim();
  if (municipioId) fields.CODIGOMUN = [municipioId];

  try {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/ubicaciones/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[ubicaciones/PATCH] Airtable error:", err);
      return NextResponse.json({ error: "Error actualizando en Airtable" }, { status: 500 });
    }

    const r = await res.json();
    return NextResponse.json({
      id: r.id,
      nombre: r.fields.nombregenerador || "",
      cedula: r.fields.cedulagenerador || "",
      direccion: r.fields.direcciongenerador || "",
      cultivo: r.fields.cultivogenerador || "",
      email: r.fields.emailgenerador || "",
      movil: r.fields.movilgenerador || "",
    });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
