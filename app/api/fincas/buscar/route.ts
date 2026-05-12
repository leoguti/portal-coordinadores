import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const maxDuration = 30;

interface FincaResult {
  id: string;
  nombre: string;
  generadorIds: string[];
  municipio: string;
}

function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return NextResponse.json(
      { error: "Airtable no configurado" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const generadorId = (searchParams.get("generador") || "").trim();
  const id = (searchParams.get("id") || "").trim();

  // Resolución directa por id
  if (id) {
    try {
      const res = await fetch(
        `https://api.airtable.com/v0/${baseId}/FINCAS/${id}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
        }
      );
      if (!res.ok) return NextResponse.json({ results: [] });
      const rec = await res.json();
      const item: FincaResult = {
        id: rec.id,
        nombre: String(rec.fields?.nombre || ""),
        generadorIds: Array.isArray(rec.fields?.generador) ? rec.fields.generador : [],
        municipio: "",
      };
      return NextResponse.json({ results: [item] });
    } catch {
      return NextResponse.json({ results: [] });
    }
  }

  // Si tenemos generadorId, traer las fincas de ese generador
  if (generadorId) {
    const params = new URLSearchParams();
    params.append("fields[]", "nombre");
    params.append("fields[]", "generador");
    params.set(
      "filterByFormula",
      `FIND('${escape(generadorId)}', ARRAYJOIN({generador}))`
    );
    params.set("pageSize", "100");

    try {
      const res = await fetch(
        `https://api.airtable.com/v0/${baseId}/FINCAS?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          cache: "no-store",
        }
      );
      if (!res.ok) {
        const text = await res.text();
        console.error(`Airtable error ${res.status}:`, text);
        return NextResponse.json({ error: "Error consultando" }, { status: 500 });
      }
      const data = await res.json();
      let results: FincaResult[] = (data.records || []).map(
        (rec: { id: string; fields: Record<string, unknown> }) => ({
          id: rec.id,
          nombre: String(rec.fields["nombre"] || ""),
          generadorIds: Array.isArray(rec.fields["generador"])
            ? (rec.fields["generador"] as string[])
            : [],
          municipio: "",
        })
      );
      if (q.length >= 1) {
        const qLower = q.toLowerCase();
        results = results.filter((f) =>
          f.nombre.toLowerCase().includes(qLower)
        );
      }
      results.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      return NextResponse.json({ results: results.slice(0, 30) });
    } catch (error) {
      console.error("Error listando fincas por generador:", error);
      return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
  }

  // Búsqueda libre por nombre de finca (sin generador filtrado)
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const qLower = q.toLowerCase();
  const params = new URLSearchParams();
  params.append("fields[]", "nombre");
  params.append("fields[]", "generador");
  params.set("filterByFormula", `FIND('${escape(qLower)}', LOWER({nombre}))`);
  params.set("pageSize", "15");
  params.set("maxRecords", "15");

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/FINCAS?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`Airtable error ${res.status}:`, text);
      return NextResponse.json({ error: "Error consultando" }, { status: 500 });
    }
    const data = await res.json();
    const results: FincaResult[] = (data.records || []).map(
      (rec: { id: string; fields: Record<string, unknown> }) => ({
        id: rec.id,
        nombre: String(rec.fields["nombre"] || ""),
        generadorIds: Array.isArray(rec.fields["generador"])
          ? (rec.fields["generador"] as string[])
          : [],
        municipio: "",
      })
    );
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error buscando fincas:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
