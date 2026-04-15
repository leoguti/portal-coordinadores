import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

async function airtableGet(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${KEY}` },
    cache: "no-store",
  });
  return res.json();
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const isAdmin = isAdminOrSupervisor(session.user.rol);
  const coordinadorId = session.user.coordinatorRecordId;

  // 1. Fetch ubicaciones del coordinador (con campo finca)
  const fields = [
    "nombregenerador", "cedulagenerador", "direcciongenerador",
    "mundep", "cultivogenerador", "movilgenerador", "emailgenerador",
    "tipogenerador", "finca",
  ];
  const fp = fields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  const filter = isAdmin
    ? "TRUE()"
    : `FIND('${coordinadorId}', ARRAYJOIN({coordinadores}, ','))`;

  const ubicaciones: any[] = [];
  let offset = "";
  do {
    const url = `https://api.airtable.com/v0/${BASE}/ubicaciones?filterByFormula=${encodeURIComponent(filter)}&${fp}&pageSize=100${offset ? "&offset=" + offset : ""}`;
    const data = await airtableGet(url);
    if (data.error) return NextResponse.json({ error: "Error Airtable" }, { status: 500 });
    ubicaciones.push(...data.records);
    offset = data.offset || "";
  } while (offset);

  // 2. Recolectar IDs de FINCAS vinculadas
  const fincaIds = ubicaciones
    .flatMap((r) => r.fields.finca || [])
    .filter(Boolean);

  if (fincaIds.length === 0) {
    return NextResponse.json({ fincas: [] });
  }

  // 3. Fetch FINCAS en batches de 30
  const fincaMap = new Map<string, any>();
  const CHUNK = 30;
  for (let i = 0; i < fincaIds.length; i += CHUNK) {
    const chunk = fincaIds.slice(i, i + CHUNK);
    const formula = `OR(${chunk.map((id: string) => `RECORD_ID()='${id}'`).join(",")})`;
    const fFields = ["nombre", "generador", "municipio", "cultivos", "movil", "email", "revisado", "notas_migracion", "revisado_por"];
    const ffp = fFields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
    const url = `https://api.airtable.com/v0/${BASE}/FINCAS?filterByFormula=${encodeURIComponent(formula)}&${ffp}&pageSize=100`;
    const data = await airtableGet(url);
    for (const r of data.records) fincaMap.set(r.id, r);
  }

  // 4. Combinar y ordenar (problemáticos primero, luego no revisados, luego revisados)
  const result = ubicaciones.map((u) => {
    const fincaId = u.fields.finca?.[0];
    const finca = fincaId ? fincaMap.get(fincaId) : null;
    const notas = finca?.fields?.notas_migracion || "";
    const revisado = finca?.fields?.revisado || false;

    return {
      ubicacionId: u.id,
      fincaId: fincaId || null,
      // Datos originales
      original: {
        nombre: u.fields.nombregenerador || "",
        nit: u.fields.cedulagenerador || "",
        direccion: u.fields.direcciongenerador || "",
        municipio: u.fields.mundep || "",
        cultivo: u.fields.cultivogenerador || "",
        movil: u.fields.movilgenerador || "",
        email: u.fields.emailgenerador || "",
        tipo: u.fields.tipogenerador || "",
      },
      // Datos de la nueva FINCA
      finca: finca ? {
        nombre: finca.fields.nombre || "",
        generadorId: finca.fields.generador?.[0] || null,
        municipioId: finca.fields.municipio?.[0] || null,
        cultivoIds: finca.fields.cultivos || [],
        movil: finca.fields.movil || "",
        email: finca.fields.email || "",
        revisado,
        notas,
      } : null,
      // Para ordenamiento
      _revisado: revisado,
      _tieneProblemas: notas.length > 0,
    };
  });

  // Orden: problemas primero → no revisados → revisados
  result.sort((a, b) => {
    if (a._revisado !== b._revisado) return a._revisado ? 1 : -1;
    if (a._tieneProblemas !== b._tieneProblemas) return a._tieneProblemas ? -1 : 1;
    return (a.original.nombre || "").localeCompare(b.original.nombre || "", "es");
  });

  return NextResponse.json({ fincas: result, total: result.length });
}
