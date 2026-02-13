import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";

interface AirtableRecord {
  id: string;
  fields: {
    Nombre?: string;
    Municipio?: string[];
    "mundep (from Municipio)"?: string[];
    Coordinador?: string[];
    Autonumber?: number;
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
      return NextResponse.json({ error: "Configuración de Airtable no disponible" }, { status: 500 });
    }

    const canViewAll = isAdminOrSupervisor(session.user?.rol);
    const coordinatorRecordId = session.user?.coordinatorRecordId;

    // Traer todos los centros de acopio (FIND/ARRAYJOIN no funciona con linked records en Airtable)
    const filterFormula = "{Tipo}='Centro de Acopio'";
    const url = `https://api.airtable.com/v0/${baseId}/Puntos%20Logisticos?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Nombre&sort[0][direction]=asc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Airtable API error:", await response.text());
      return NextResponse.json({ centros: [] });
    }

    const data: { records: AirtableRecord[] } = await response.json();

    console.log("🔍 [CENTROS-ACOPIO] Total registros Airtable:", data.records.length);
    console.log("🔍 [CENTROS-ACOPIO] canViewAll:", canViewAll);
    console.log("🔍 [CENTROS-ACOPIO] coordinatorRecordId:", coordinatorRecordId);

    // Filtrar por coordinador en el servidor (admin ve todos)
    const registros = canViewAll
      ? data.records
      : data.records.filter((record) =>
          record.fields.Coordinador?.includes(coordinatorRecordId || "")
        );

    console.log("🔍 [CENTROS-ACOPIO] Registros después de filtro:", registros.length);
    if (!canViewAll && registros.length > 0) {
      console.log("🔍 [CENTROS-ACOPIO] Ejemplo de centro filtrado:", {
        nombre: registros[0].fields.Nombre,
        coordinadores: registros[0].fields.Coordinador
      });
    }

    const centros = registros.map((record) => {
      const municipio = record.fields["mundep (from Municipio)"]?.[0] || "";
      const nombre = record.fields.Nombre || "Sin nombre";
      const displayName = municipio ? `${nombre} (${municipio})` : nombre;

      return {
        id: record.id,
        name: displayName,
      };
    });

    return NextResponse.json({ centros });
  } catch (error) {
    console.error("Error fetching centros:", error);
    return NextResponse.json({ error: "Error al buscar centros" }, { status: 500 });
  }
}
