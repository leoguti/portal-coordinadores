import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/certificados/generador?cedula=XXXXX
 *
 * Busca generadores en tabla `ubicaciones` por cedulagenerador.
 * Requiere sesión NextAuth.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cedula = req.nextUrl.searchParams.get("cedula")?.trim();
  if (!cedula || cedula.length < 3) {
    return NextResponse.json({ error: "Cédula requerida (mínimo 3 caracteres)" }, { status: 400 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY!;
  const baseId = process.env.AIRTABLE_BASE_ID!;

  const filter = encodeURIComponent(`{cedulagenerador}="${cedula}"`);
  const url = `https://api.airtable.com/v0/${baseId}/ubicaciones?filterByFormula=${filter}&maxRecords=20`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Error consultando Airtable" }, { status: 500 });
    }

    const data = await res.json();
    const records = data.records ?? [];

    const ubicaciones = records.map((r: any) => ({
      id: r.id,
      nombre: r.fields.nombregenerador || "",
      cedula: r.fields.cedulagenerador || "",
      direccion: r.fields.direcciongenerador || "",
      municipio: r.fields.municipiogenerador || "",
      cultivo: r.fields.cultivogenerador || "",
      email: r.fields.emailgenerador || "",
      movil: r.fields.movilgenerador || "",
      tipo: r.fields.tipogenerador || "",
    }));

    return NextResponse.json({ found: ubicaciones.length > 0, ubicaciones });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
