import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const maxDuration = 30;

interface GeneradorResult {
  id: string;
  nombre: string;
  nit: string;
  tipo: string;
  tipopersona: string;
  fincaIds: string[];
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
  const id = (searchParams.get("id") || "").trim();

  // Resolución directa por id (para hidratar selección desde URL)
  if (id) {
    const url = `https://api.airtable.com/v0/${baseId}/GENERADORES/${id}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      });
      if (!res.ok) {
        return NextResponse.json({ results: [] });
      }
      const rec = await res.json();
      const item: GeneradorResult = {
        id: rec.id,
        nombre: String(rec.fields?.nombre || ""),
        nit: String(rec.fields?.nit || ""),
        tipo: String(rec.fields?.tipo || ""),
        tipopersona: String(rec.fields?.tipopersona || ""),
        fincaIds: Array.isArray(rec.fields?.FINCAS) ? rec.fields.FINCAS : [],
      };
      return NextResponse.json({ results: [item] });
    } catch {
      return NextResponse.json({ results: [] });
    }
  }

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const qLower = q.toLowerCase();
  const filterByFormula = `OR(FIND('${escape(qLower)}', LOWER({nombre})), FIND('${escape(qLower)}', LOWER({nit} & '')))`;

  const params = new URLSearchParams();
  params.append("fields[]", "nombre");
  params.append("fields[]", "nit");
  params.append("fields[]", "tipo");
  params.append("fields[]", "tipopersona");
  params.append("fields[]", "FINCAS");
  params.set("filterByFormula", filterByFormula);
  params.set("pageSize", "15");
  params.set("maxRecords", "15");

  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/GENERADORES?${params.toString()}`,
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
    const results: GeneradorResult[] = (data.records || []).map(
      (rec: { id: string; fields: Record<string, unknown> }) => ({
        id: rec.id,
        nombre: String(rec.fields["nombre"] || ""),
        nit: String(rec.fields["nit"] || ""),
        tipo: String(rec.fields["tipo"] || ""),
        tipopersona: String(rec.fields["tipopersona"] || ""),
        fincaIds: Array.isArray(rec.fields["FINCAS"])
          ? (rec.fields["FINCAS"] as string[])
          : [],
      })
    );
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error buscando generadores:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
