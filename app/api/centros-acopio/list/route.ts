import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface AirtableRecord {
  id: string;
  fields: {
    Nombre?: string;
    Municipio?: string[];
    "mundep (from Municipio)"?: string[];
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

    // Get all Centros de Acopio
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

    const centros = data.records.map((record) => {
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
