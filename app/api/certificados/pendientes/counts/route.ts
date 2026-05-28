/**
 * GET /api/certificados/pendientes/counts
 * Devuelve conteos por tipo para el badge del sidebar.
 * Cacheado 30s en memoria por coordinador.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

const cache = new Map<string, { ts: number; data: Counts }>();
const TTL_MS = 30_000;

interface Counts {
  cert: number;
  generadores: number;
  fincas: number;
  total: number;
}

async function countWithFormula(table: string, formula: string): Promise<number> {
  let total = 0;
  let offset: string | undefined;
  do {
    const p = new URLSearchParams();
    p.set("filterByFormula", formula);
    p.set("pageSize", "100");
    p.append("fields[]", "estado");
    if (offset) p.set("offset", offset);
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}?${p}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
    );
    if (!r.ok) return 0;
    const d = await r.json();
    total += (d.records || []).length;
    offset = d.offset;
  } while (offset);
  return total;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const isAdmin = isAdminOrSupervisor(session.user.rol);
  const coord = isAdmin ? null : session.user.coordinatorRecordId;
  const key = coord || "all";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  const filtCert = coord
    ? `AND({estado}='pendiente', FIND('${coord}', ARRAYJOIN({id_coordinador})) > 0)`
    : `{estado}='pendiente'`;
  const filtGen = coord
    ? `AND({estado}='pendiente', FIND('${coord}', ARRAYJOIN({coordinador_solicitado})) > 0)`
    : `{estado}='pendiente'`;
  const filtFinca = coord
    ? `AND(OR({estado}='pendiente', {estado}='pendiente_revision'), FIND('${coord}', ARRAYJOIN({coordinador_id})) > 0)`
    : `OR({estado}='pendiente', {estado}='pendiente_revision')`;

  const [cert, generadores, fincas] = await Promise.all([
    countWithFormula("Certificados", filtCert),
    countWithFormula("GENERADORES", filtGen),
    countWithFormula("FINCAS", filtFinca),
  ]);

  const data: Counts = { cert, generadores, fincas, total: cert + generadores + fincas };
  cache.set(key, { ts: Date.now(), data });
  return NextResponse.json(data);
}

export const dynamic = "force-dynamic";
