import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

// GET /api/planillas-ss?terceroId=xxx
// Lista las planillas de un tercero, ordenadas por mes_periodo desc
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const terceroId = req.nextUrl.searchParams.get("terceroId");
  if (!terceroId) {
    return NextResponse.json({ error: "terceroId requerido" }, { status: 400 });
  }

  // Filtramos por el tercero — usamos el campo "Name" primario si existe, pero
  // en este caso es singleLineText que llenamos con el id del tercero + mes,
  // así que mejor filtramos por el link resuelto (ARRAYJOIN devuelve el Name
  // del tercero). Para ser robustos, filtramos en código.
  const records: any[] = [];
  let offset = "";
  do {
    const url = `https://api.airtable.com/v0/${BASE}/PlanillasSS?pageSize=100${offset ? "&offset=" + offset : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" });
    const data = await res.json();
    if (data.error) return NextResponse.json({ error: "Error Airtable", detail: data.error }, { status: 500 });
    records.push(...(data.records || []));
    offset = data.offset || "";
  } while (offset);

  const planillas = records
    .filter((r) => (r.fields.tercero || []).includes(terceroId))
    .map((r) => ({
      id: r.id,
      mesPeriodo: r.fields.mes_periodo || "",
      archivo: r.fields.archivo || [],
      subidoPorId: r.fields.subido_por?.[0] || null,
      montoAportado: r.fields.monto_aportado || null,
      fechaSubida: r.fields.fecha_subida || null,
    }))
    .sort((a, b) => b.mesPeriodo.localeCompare(a.mesPeriodo));

  return NextResponse.json({ planillas });
}

// POST /api/planillas-ss
// { terceroId, mesPeriodo, montoAportado? }
// Crea el registro. El archivo se sube después con /api/upload.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const coordinadorId = session.user.coordinatorRecordId;

  const body = await req.json();
  const { terceroId, mesPeriodo, montoAportado } = body;
  if (!terceroId || !mesPeriodo) {
    return NextResponse.json({ error: "terceroId y mesPeriodo son obligatorios" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(mesPeriodo)) {
    return NextResponse.json({ error: "mesPeriodo debe estar en formato YYYY-MM" }, { status: 400 });
  }

  const fields: Record<string, unknown> = {
    Name: `${terceroId.slice(-6)}-${mesPeriodo}`,
    tercero: [terceroId],
    mes_periodo: mesPeriodo,
    subido_por: [coordinadorId],
    fecha_subida: new Date().toISOString().slice(0, 10),
  };
  if (montoAportado !== undefined && montoAportado !== null && montoAportado !== "") {
    const n = Number(montoAportado);
    if (!Number.isNaN(n)) fields.monto_aportado = n;
  }

  const res = await fetch(`https://api.airtable.com/v0/${BASE}/PlanillasSS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[planillas/create]", err);
    return NextResponse.json({ error: "Error al crear planilla", detail: err }, { status: 500 });
  }
  const data = await res.json();
  return NextResponse.json({ id: data.id });
}
