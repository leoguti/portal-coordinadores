import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { ids } = (await req.json()) as { ids?: string[] };
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ municipios: [] });
  }

  const KEY = process.env.AIRTABLE_API_KEY!;
  const BASE = process.env.AIRTABLE_BASE_ID!;

  const unique = Array.from(new Set(ids.filter(Boolean))).slice(0, 50);
  const or = unique.map((id) => `RECORD_ID()='${id}'`).join(",");
  const url = `https://api.airtable.com/v0/${BASE}/MUNICIPIOS?filterByFormula=${encodeURIComponent(`OR(${or})`)}&fields%5B%5D=mundep&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Error consultando" }, { status: 500 });
  }
  const data = (await res.json()) as { records: Array<{ id: string; fields: { mundep?: string } }> };

  return NextResponse.json({
    municipios: (data.records || []).map((r) => ({
      id: r.id,
      mundep: r.fields.mundep || "",
    })),
  });
}
