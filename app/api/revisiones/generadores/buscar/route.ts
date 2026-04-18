import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

// GET /api/revisiones/generadores/buscar?q=xxx
// Busca GENERADORES por NIT (prefijo) o nombre (contiene).
// Devuelve máx 10 resultados.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ generadores: [] });
  }

  // Escape para fórmula Airtable
  const safe = q.replace(/'/g, "\\'");
  // Búsqueda OR: nit empieza con q, o nombre contiene q (case-insensitive)
  const formula = `OR(
    FIND('${safe}', {nit}) > 0,
    FIND(LOWER('${safe}'), LOWER({nombre} & '')) > 0
  )`.replace(/\s+/g, " ").trim();

  const url = `https://api.airtable.com/v0/${BASE}/GENERADORES?filterByFormula=${encodeURIComponent(formula)}&fields[]=nombre&fields[]=nit&fields[]=tipo&maxRecords=10`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[generadores/buscar]", err);
    return NextResponse.json({ error: "Error al buscar" }, { status: 500 });
  }
  const data = await res.json();
  const generadores = (data.records || []).map((r: any) => ({
    id: r.id,
    nombre: r.fields.nombre || "",
    nit: r.fields.nit || "",
    tipo: r.fields.tipo || "",
  }));
  return NextResponse.json({ generadores });
}
