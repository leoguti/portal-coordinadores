import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ubicaciones/${id}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Generador no encontrado" }, { status: 404 });
  }

  const raw = await res.json();
  return NextResponse.json({
    ...raw,
    codigomunId: raw.fields?.CODIGOMUN?.[0] || null,
    mundep: raw.fields?.mundep?.[0] || "",
  });
}

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
  const textFields = [
    "nombregenerador",
    "cedulagenerador",
    "direcciongenerador",
    "cultivogenerador",
    "movilgenerador",
    "emailgenerador",
    "tipogenerador",
  ];
  for (const key of textFields) {
    if (body[key] !== undefined) fields[key] = body[key];
  }
  // Municipio como linked record a MUNICIPIOS
  if (body.municipioId) fields.CODIGOMUN = [body.municipioId];

  const res = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/ubicaciones/${id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[generadores/patch]", err);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
