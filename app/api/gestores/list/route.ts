import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface AirtableRecord {
  id: string;
  fields: {
    RazonSocial?: string;
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

    // Get all Gestores
    const filterFormula = "{es_gestor}=TRUE()";
    const url = `https://api.airtable.com/v0/${baseId}/Terceros?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=RazonSocial&sort[0][direction]=asc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Airtable API error:", await response.text());
      return NextResponse.json({ gestores: [] });
    }

    const data: { records: AirtableRecord[] } = await response.json();

    const gestores = data.records.map((record) => ({
      id: record.id,
      name: record.fields.RazonSocial || "Sin nombre",
    }));

    return NextResponse.json({ gestores });
  } catch (error) {
    console.error("Error fetching gestores:", error);
    return NextResponse.json({ error: "Error al buscar gestores" }, { status: 500 });
  }
}
