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

  // 1. Fetch ubicaciones del coordinador
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

  // 2. IDs de FINCAS vinculadas (deduplicadas)
  const fincaIdsSet = new Set<string>();
  for (const u of ubicaciones) {
    for (const id of (u.fields.finca || [])) fincaIdsSet.add(id);
  }
  const fincaIds = Array.from(fincaIdsSet);

  if (fincaIds.length === 0) {
    return NextResponse.json({ grupos: [], totalFincas: 0 });
  }

  // 3. Fetch FINCAS en batches de 30
  const fincaMap = new Map<string, any>();
  const CHUNK = 30;
  for (let i = 0; i < fincaIds.length; i += CHUNK) {
    const chunk = fincaIds.slice(i, i + CHUNK);
    const formula = `OR(${chunk.map((id: string) => `RECORD_ID()='${id}'`).join(",")})`;
    const fFields = ["nombre", "generador", "municipio", "cultivos", "movil", "email", "revisado", "notas_migracion"];
    const ffp = fFields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
    const url = `https://api.airtable.com/v0/${BASE}/FINCAS?filterByFormula=${encodeURIComponent(formula)}&${ffp}&pageSize=100`;
    const data = await airtableGet(url);
    for (const r of data.records) fincaMap.set(r.id, r);
  }

  // 4. IDs de GENERADORES (deduplicados)
  const generadorIdsSet = new Set<string>();
  for (const finca of fincaMap.values()) {
    const gId = finca.fields.generador?.[0];
    if (gId) generadorIdsSet.add(gId);
  }
  const generadorIds = Array.from(generadorIdsSet);

  // 5. Fetch GENERADORES en batches de 30
  const generadorMap = new Map<string, any>();
  for (let i = 0; i < generadorIds.length; i += CHUNK) {
    const chunk = generadorIds.slice(i, i + CHUNK);
    const formula = `OR(${chunk.map((id: string) => `RECORD_ID()='${id}'`).join(",")})`;
    const gFields = ["nombre", "nit", "tipo"];
    const gfp = gFields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
    const url = `https://api.airtable.com/v0/${BASE}/GENERADORES?filterByFormula=${encodeURIComponent(formula)}&${gfp}&pageSize=100`;
    const data = await airtableGet(url);
    for (const r of data.records) generadorMap.set(r.id, r);
  }

  // 6. Construir items combinando ubicacion + finca
  const items = ubicaciones.map((u) => {
    const fincaId = u.fields.finca?.[0] || null;
    const finca = fincaId ? fincaMap.get(fincaId) : null;
    const notas = finca?.fields?.notas_migracion || "";
    const revisado = finca?.fields?.revisado || false;

    return {
      ubicacionId: u.id,
      fincaId,
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
    };
  });

  // 7. Agrupar por GENERADOR
  // Clave: generadorId (o "sin-generador" si no tiene)
  const gruposMap = new Map<string, {
    generadorId: string | null;
    generador: { nombre: string; nit: string; tipo: string } | null;
    fincas: typeof items;
  }>();

  for (const item of items) {
    const gId = item.finca?.generadorId || "sin-generador";
    if (!gruposMap.has(gId)) {
      const genRecord = gId !== "sin-generador" ? generadorMap.get(gId) : null;
      gruposMap.set(gId, {
        generadorId: gId !== "sin-generador" ? gId : null,
        generador: genRecord ? {
          nombre: genRecord.fields.nombre || "",
          nit: genRecord.fields.nit || "",
          tipo: genRecord.fields.tipo || "",
        } : null,
        fincas: [],
      });
    }
    gruposMap.get(gId)!.fincas.push(item);
  }

  // 8. Ordenar grupos y fincas dentro de cada grupo
  const grupos = Array.from(gruposMap.values()).map((g) => {
    // Ordenar fincas: con problemas primero, luego no revisadas, luego revisadas
    g.fincas.sort((a, b) => {
      const aRev = a.finca?.revisado || false;
      const bRev = b.finca?.revisado || false;
      const aProb = (a.finca?.notas || "").length > 0;
      const bProb = (b.finca?.notas || "").length > 0;
      if (aRev !== bRev) return aRev ? 1 : -1;
      if (aProb !== bProb) return aProb ? -1 : 1;
      return (a.original.nombre || "").localeCompare(b.original.nombre || "", "es");
    });
    const totalFincas = g.fincas.length;
    const revisadas = g.fincas.filter((f) => f.finca?.revisado).length;
    return { ...g, totalFincas, revisadas };
  });

  // Ordenar grupos: los que tienen fincas sin revisar primero
  grupos.sort((a, b) => {
    const aPct = a.totalFincas > 0 ? a.revisadas / a.totalFincas : 1;
    const bPct = b.totalFincas > 0 ? b.revisadas / b.totalFincas : 1;
    if (aPct !== bPct) return aPct - bPct;
    return (a.generador?.nombre || "").localeCompare(b.generador?.nombre || "", "es");
  });

  const totalFincas = items.length;
  const totalRevisadas = items.filter((i) => i.finca?.revisado).length;

  return NextResponse.json({ grupos, totalFincas, totalRevisadas });
}
