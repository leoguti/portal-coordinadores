import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/actividades/info?id=<actividadId>
 *
 * Endpoint público para TextIt. Devuelve nombre, fecha y municipio de una actividad.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return NextResponse.json({ error: "Airtable no configurado" }, { status: 500 });
  }

  const res = await fetch(`https://api.airtable.com/v0/${baseId}/Actividades/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
  }

  const data = await res.json();
  const fields = data.fields || {};

  return NextResponse.json({
    id: data.id,
    nombre: fields["Nombre de la Actividad"] || "",
    fecha: fields["Fecha"] || "",
    municipio: fields["mundep (from Municipio)"]?.[0] || "",
  });
}
