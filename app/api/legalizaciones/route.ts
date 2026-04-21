import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;
const TABLE = "LegalizacionesMensuales";

interface LegalizacionFields {
  nombre?: string;
  coordinador?: string[];
  mes_reporte?: string;
  estado?: string;
  aprobado_por?: string[];
  aprobado_at?: string;
  rechazado_motivo?: string;
  pdf_r2_url?: string;
  gastos?: string[];
}
interface LegalizacionRecord {
  id: string;
  createdTime: string;
  fields: LegalizacionFields;
}

async function airtable(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.airtable.com/v0/${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  return res;
}

/**
 * GET /api/legalizaciones
 * Lista legalizaciones — coordinador ve las suyas, admin/supervisor ve todas.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const isAdmin = isAdminOrSupervisor(session.user.rol);
  const coordinadorId = session.user.coordinatorRecordId;

  const filter = isAdmin
    ? ""
    : `&filterByFormula=${encodeURIComponent(`FIND('${coordinadorId}', ARRAYJOIN({coordinador}, ',')) > 0`)}`;

  const out: LegalizacionRecord[] = [];
  let offset: string | undefined;
  do {
    const res = await airtable(
      `/${TABLE}?pageSize=100${filter}&sort%5B0%5D%5Bfield%5D=mes_reporte&sort%5B0%5D%5Bdirection%5D=desc${offset ? `&offset=${offset}` : ""}`
    );
    if (!res.ok) {
      console.error("[legalizaciones] GET error:", await res.text());
      return NextResponse.json({ error: "Error consultando" }, { status: 500 });
    }
    const data = (await res.json()) as { records: LegalizacionRecord[]; offset?: string };
    out.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return NextResponse.json({ legalizaciones: out });
}

/**
 * POST /api/legalizaciones
 * Body: { mes_reporte: "YYYY-MM" }
 * Crea una legalización para el coordinador en sesión.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const coordinadorId = session.user.coordinatorRecordId;

  const body = await request.json();
  const mes = (body.mes_reporte || "").trim();
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: "mes_reporte inválido (formato YYYY-MM)" }, { status: 400 });
  }

  // Verificar que no exista ya una legalización del mismo coordinador+mes
  const filter = `AND(FIND('${coordinadorId}', ARRAYJOIN({coordinador}, ','))>0, {mes_reporte}='${mes}')`;
  const dup = await airtable(`/${TABLE}?filterByFormula=${encodeURIComponent(filter)}&maxRecords=1`);
  const dupData = (await dup.json()) as { records: LegalizacionRecord[] };
  if (dupData.records?.length > 0) {
    return NextResponse.json(
      { error: "Ya existe una legalización para este mes", existeId: dupData.records[0].id },
      { status: 409 }
    );
  }

  const nombre = `${session.user.name || "Coordinador"} - ${mes}`;

  const res = await airtable(`/${TABLE}`, {
    method: "POST",
    body: JSON.stringify({
      fields: {
        nombre,
        coordinador: [coordinadorId],
        mes_reporte: mes,
        estado: "borrador",
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[legalizaciones] POST error:", err);
    return NextResponse.json({ error: "Error creando legalización" }, { status: 500 });
  }
  const legalizacion = (await res.json()) as LegalizacionRecord;
  return NextResponse.json({ legalizacion }, { status: 201 });
}
