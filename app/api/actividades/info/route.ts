import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/actividades/info?id=<actividadId>&telefono=<opcional>
 *
 * Endpoint público para TextIt. Devuelve nombre, fecha y municipio de una actividad.
 * Si se pasa telefono, también devuelve yaEvaluo: true/false.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  const telefono = req.nextUrl.searchParams.get("telefono")?.trim();

  if (!id) {
    return NextResponse.json({ error: "id requerido" }, { status: 400 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return NextResponse.json({ error: "Airtable no configurado" }, { status: 500 });
  }

  const airtableHeaders = { Authorization: `Bearer ${apiKey}` };

  // Obtener info de la actividad
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/Actividades/${id}`, {
    headers: airtableHeaders,
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Actividad no encontrada" }, { status: 404 });
  }

  const data = await res.json();
  const fields = data.fields || {};

  // Si viene telefono, verificar si ya evaluó esta actividad
  let yaEvaluo = false;
  if (telefono) {
    // 1. Buscar persona por telefono
    const personaFilter = encodeURIComponent(`{Telefono}="${telefono}"`);
    const personaRes = await fetch(
      `https://api.airtable.com/v0/${baseId}/Personas%20Evaluadas?filterByFormula=${personaFilter}&maxRecords=1&fields[]=Telefono`,
      { headers: airtableHeaders, cache: "no-store" }
    );
    if (personaRes.ok) {
      const personaData = await personaRes.json();
      const personaId = personaData.records?.[0]?.id;
      if (personaId) {
        // 2. Buscar evaluacion para esa persona + actividad usando idactividad (lookup)
        const evalFilter = encodeURIComponent(
          `AND(FIND("${personaId}", ARRAYJOIN({Persona Evaluada})), FIND("${id}", ARRAYJOIN({idactividad})))`
        );
        const evalRes = await fetch(
          `https://api.airtable.com/v0/${baseId}/Evaluaciones?filterByFormula=${evalFilter}&maxRecords=1&fields[]=Timestamp`,
          { headers: airtableHeaders, cache: "no-store" }
        );
        if (evalRes.ok) {
          const evalData = await evalRes.json();
          yaEvaluo = (evalData.records?.length ?? 0) > 0;
        }
      }
    }
  }

  return NextResponse.json({
    id: data.id,
    nombre: fields["Nombre de la Actividad"] || "",
    fecha: fields["Fecha"] || "",
    municipio: fields["mundep (from Municipio)"]?.[0] || "",
    yaEvaluo,
  });
}
