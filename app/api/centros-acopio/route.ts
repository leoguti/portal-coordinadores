import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface AirtableRecord {
  id: string;
  fields: {
    NombreCentro?: string;
  };
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    if (search.length < 2) {
      return NextResponse.json({ centros: [] });
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
      return NextResponse.json({ error: "Configuración de Airtable no disponible" }, { status: 500 });
    }

    // Search using case-insensitive FIND function
    const filterFormula = `FIND(LOWER("${search.toLowerCase()}"), LOWER({NombreCentro}))`;
    const url = `https://api.airtable.com/v0/${baseId}/CentrosAcopio?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=20`;

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

    const centros = data.records.map((record) => ({
      id: record.id,
      name: record.fields.NombreCentro || "Sin nombre",
    }));

    return NextResponse.json({ centros });
  } catch (error) {
    console.error("Error fetching centros:", error);
    return NextResponse.json({ error: "Error al buscar centros" }, { status: 500 });
  }
}
