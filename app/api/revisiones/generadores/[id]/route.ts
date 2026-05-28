import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

// PATCH /api/revisiones/generadores/[id]
// body: { nombre?, nit?, tipo?, tipopersona?, direccion_sede?, municipioId?, movil?, email? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const fields: Record<string, unknown> = {};
  if (body.nombre !== undefined) fields.nombre = body.nombre;
  if (body.nit !== undefined) fields.nit = body.nit;
  if (body.tipo !== undefined) fields.tipo = body.tipo;
  if (body.tipopersona !== undefined) fields.tipopersona = body.tipopersona;
  if (body.direccion_sede !== undefined) fields.direccion_sede = body.direccion_sede;
  if (body.movil !== undefined) fields.movil = body.movil;
  if (body.email !== undefined) fields.email = body.email;
  if (body.municipioId !== undefined) {
    fields.municipio = body.municipioId ? [body.municipioId] : [];
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Sin campos para actualizar" }, { status: 400 });
  }

  const res = await fetch(`https://api.airtable.com/v0/${BASE}/GENERADORES/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields, typecast: true }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[generadores/patch]", err);
    return NextResponse.json({ error: "Error al actualizar generador" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
