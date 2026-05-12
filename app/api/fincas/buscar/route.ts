import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const maxDuration = 30;

interface FincaResult {
  id: string;
  nombre: string;
  generadorIds: string[];
}

function escape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function fetchFincasByIds(
  apiKey: string,
  baseId: string,
  fincaIds: string[]
): Promise<FincaResult[]> {
  if (fincaIds.length === 0) return [];
  // Airtable filterByFormula tiene límite de longitud; partimos en batches de 50.
  const BATCH = 50;
  const results: FincaResult[] = [];
  for (let i = 0; i < fincaIds.length; i += BATCH) {
    const slice = fincaIds.slice(i, i + BATCH);
    const formula = `OR(${slice.map((id) => `RECORD_ID()='${escape(id)}'`).join(",")})`;
    const params = new URLSearchParams();
    params.append("fields[]", "nombre");
    params.append("fields[]", "generador");
    params.set("filterByFormula", formula);
    params.set("pageSize", String(BATCH));
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/FINCAS?${params.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`Airtable error ${res.status}:`, text);
      continue;
    }
    const data = await res.json();
    for (const rec of data.records || []) {
      results.push({
        id: rec.id,
        nombre: String(rec.fields?.nombre || ""),
        generadorIds: Array.isArray(rec.fields?.generador)
          ? rec.fields.generador
          : [],
      });
    }
  }
  return results;
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

  // Resolución directa por id de finca
  if (id) {
    try {
      const res = await fetch(
        `https://api.airtable.com/v0/${baseId}/FINCAS/${id}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
      );
      if (!res.ok) return NextResponse.json({ results: [] });
      const rec = await res.json();
      const item: FincaResult = {
        id: rec.id,
        nombre: String(rec.fields?.nombre || ""),
        generadorIds: Array.isArray(rec.fields?.generador)
          ? rec.fields.generador
          : [],
      };
      return NextResponse.json({ results: [item] });
    } catch {
      return NextResponse.json({ results: [] });
    }
  }

  // Fincas de un generador específico: traer la lista de FINCAS del generador
  // y resolverlas por RECORD_ID() (no por {generador} porque ese campo es un
  // linked record que en filterByFormula renderiza nombres, no IDs).
  if (generadorId) {
    try {
      const genRes = await fetch(
        `https://api.airtable.com/v0/${baseId}/GENERADORES/${generadorId}`,
        { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
      );
      if (!genRes.ok) {
        return NextResponse.json({ results: [] });
      }
      const genData = await genRes.json();
      const fincaIds: string[] = Array.isArray(genData.fields?.FINCAS)
        ? genData.fields.FINCAS
        : [];
      let results = await fetchFincasByIds(apiKey, baseId, fincaIds);

      if (q.length >= 1) {
        const qLower = q.toLowerCase();
        results = results.filter((f) =>
          f.nombre.toLowerCase().includes(qLower)
        );
      }
      results.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      return NextResponse.json({ results: results.slice(0, 50) });
    } catch (error) {
      console.error("Error listando fincas del generador:", error);
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
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
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
      })
    );
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error buscando fincas:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
