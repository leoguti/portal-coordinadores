/**
 * GET /api/certificados/pendientes/counts
 * Devuelve conteos por tipo para el badge del sidebar.
 * Cacheado 30s en memoria por coordinador.
 *
 * ⚠️ NO filtrar coordinador con FIND+ARRAYJOIN sobre campos linked: ARRAYJOIN
 * devuelve display names, no record IDs (bug 2026-05-29, remordió 2026-07-08:
 * los tabs del coordinador marcaban 0). Se filtra en código — la API JSON
 * devuelve los linked fields como arrays de record IDs. La excepción es
 * {id_coordinador} en Certificados, que es un lookup de RECORD_ID() y sí
 * funciona en fórmula.
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

interface Rec {
  id: string;
  fields: Record<string, unknown>;
}

function asArrStr(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map((x) => String(x)) : [];
}

async function fetchRecords(
  table: string,
  formula: string,
  fields: string[]
): Promise<Rec[]> {
  const out: Rec[] = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams();
    p.set("filterByFormula", formula);
    p.set("pageSize", "100");
    fields.forEach((f) => p.append("fields[]", f));
    if (offset) p.set("offset", offset);
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}?${p}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
    );
    if (!r.ok) return out;
    const d = await r.json();
    out.push(...(d.records || []));
    offset = d.offset;
  } while (offset);
  return out;
}

const PENDIENTE_GEN_FINCA = `OR({estado}='pendiente', {estado}='pendiente_revision')`;

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

  // Certificados: {id_coordinador} es lookup de RECORD_ID() → la fórmula sirve
  const filtCert = coord
    ? `AND({estado}='pendiente', FIND('${coord}', ARRAYJOIN({id_coordinador})) > 0)`
    : `{estado}='pendiente'`;

  const [certRecs, genRecs, fincaRecs] = await Promise.all([
    fetchRecords("Certificados", filtCert, ["estado"]),
    fetchRecords("GENERADORES", PENDIENTE_GEN_FINCA, ["coordinador_solicitado"]),
    fetchRecords("FINCAS", PENDIENTE_GEN_FINCA, ["coordinador_id", "generador"]),
  ]);

  const cert = certRecs.length;

  const generadores = coord
    ? genRecs.filter((r) =>
        asArrStr(r.fields.coordinador_solicitado).includes(coord)
      ).length
    : genRecs.length;

  let fincas: number;
  if (!coord) {
    fincas = fincaRecs.length;
  } else {
    // Directas (coordinador_id propio) + vía generador padre (las fincas del
    // registro por WhatsApp no traen coordinador_id: el coordinador vive en
    // coordinador_solicitado del GENERADOR)
    const directas = fincaRecs.filter((r) =>
      asArrStr(r.fields.coordinador_id).includes(coord)
    );
    const sinCoord = fincaRecs.filter(
      (r) => asArrStr(r.fields.coordinador_id).length === 0
    );
    const genIds = [
      ...new Set(sinCoord.flatMap((r) => asArrStr(r.fields.generador))),
    ];
    const coordDeGen = new Map<string, string[]>();
    for (let i = 0; i < genIds.length; i += 50) {
      const lote = genIds.slice(i, i + 50);
      const fGen = `OR(${lote.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const gens = await fetchRecords("GENERADORES", fGen, [
        "coordinador_solicitado",
      ]);
      gens.forEach((g) =>
        coordDeGen.set(g.id, asArrStr(g.fields.coordinador_solicitado))
      );
    }
    const viaPadre = sinCoord.filter((r) =>
      asArrStr(r.fields.generador).some((gid) =>
        (coordDeGen.get(gid) || []).includes(coord)
      )
    );
    fincas = directas.length + viaPadre.length;
  }

  const data: Counts = { cert, generadores, fincas, total: cert + generadores + fincas };
  cache.set(key, { ts: Date.now(), data });
  return NextResponse.json(data);
}

export const dynamic = "force-dynamic";
