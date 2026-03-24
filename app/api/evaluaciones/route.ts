import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/evaluaciones?actividadId=recXXX
 * Devuelve las evaluaciones de una actividad con datos de la persona.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actividadId = req.nextUrl.searchParams.get("actividadId");
  if (!actividadId) return NextResponse.json({ error: "actividadId requerido" }, { status: 400 });

  const apiKey = process.env.AIRTABLE_API_KEY!;
  const baseId = process.env.AIRTABLE_BASE_ID!;
  const headers = { Authorization: `Bearer ${apiKey}` };

  const filter = encodeURIComponent(`FIND("${actividadId}", ARRAYJOIN({idactividad}))`);
  const url = `https://api.airtable.com/v0/${baseId}/Evaluaciones?filterByFormula=${filter}&sort[0][field]=Timestamp&sort[0][direction]=desc`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: "Error consultando Airtable" }, { status: 500 });

  const data = await res.json();
  const records = data.records ?? [];

  const evaluaciones = records.map((r: any) => ({
    id: r.id,
    timestamp: r.fields.Timestamp ?? "",
    puntaje: r.fields.Puntaje ?? 0,
    respuestaP1: r.fields["Respuesta P1"] ?? "",
    respuestaP2: r.fields["Respuesta P2"] ?? "",
    respuestaP3: r.fields["Respuesta P3"] ?? "",
    nombre: r.fields["nombre"]?.[0] ?? "",
    telefono: r.fields.telefono?.[0] ?? "",
  }));

  const total = evaluaciones.length;
  const promedio = total > 0
    ? Math.round((evaluaciones.reduce((s: number, e: any) => s + e.puntaje, 0) / total) * 10) / 10
    : 0;

  return NextResponse.json({ total, promedio, evaluaciones });
}
