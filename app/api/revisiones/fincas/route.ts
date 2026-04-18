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

export const dynamic = "force-dynamic";

// POST /api/revisiones/fincas
// Crea un GENERADOR (si no viene generadorId) y una FINCA nueva asignada al
// coordinador actual.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const coordinadorId = session.user.coordinatorRecordId;
  const body = await req.json();

  // 1. Resolver generador: si viene generadorId, usarlo; si no, crear uno
  let generadorId: string | null = body.generadorId || null;
  if (!generadorId) {
    const genFields: Record<string, unknown> = {
      nombre: body.generadorNombre || "",
      nit: body.generadorNit || "",
      tipo: body.generadorTipo || "AGRICOLA",
    };
    if (!genFields.nombre || !genFields.nit) {
      return NextResponse.json({ error: "Nombre y NIT del generador son obligatorios" }, { status: 400 });
    }
    const genRes = await fetch(`https://api.airtable.com/v0/${BASE}/GENERADORES`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: genFields }),
    });
    if (!genRes.ok) {
      const err = await genRes.text();
      console.error("[fincas/create generador]", err);
      return NextResponse.json({ error: "Error al crear generador", detail: err }, { status: 500 });
    }
    const genData = await genRes.json();
    generadorId = genData.id;
  }

  // 2. Crear FINCA
  const fincaFields: Record<string, unknown> = {
    nombre: body.nombre || "",
    generador: [generadorId],
    coordinador_asignado: [coordinadorId],
  };
  if (body.municipioId) fincaFields.municipio = [body.municipioId];
  if (Array.isArray(body.cultivoIds) && body.cultivoIds.length > 0) fincaFields.cultivos = body.cultivoIds;
  if (body.movil) fincaFields.movil = body.movil;
  if (body.email) fincaFields.email = body.email;

  const fincaRes = await fetch(`https://api.airtable.com/v0/${BASE}/FINCAS`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: fincaFields }),
  });
  if (!fincaRes.ok) {
    const err = await fincaRes.text();
    console.error("[fincas/create]", err);
    return NextResponse.json({ error: "Error al crear finca", detail: err }, { status: 500 });
  }
  const fincaData = await fincaRes.json();
  return NextResponse.json({ id: fincaData.id, generadorId });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const isAdmin = isAdminOrSupervisor(session.user.rol);
  const coordinadorId = session.user.coordinatorRecordId;
  const CHUNK = 30;

  // 1. Fetch FINCAS asignadas al coordinador vía el rollup coordinador_id
  // (expone el RECORD_ID de coordinador_asignado como texto, sí filtrable).
  const fFields = [
    "nombre", "generador", "municipio", "cultivos", "movil", "email",
    "revisado", "notas_migracion", "coordinador_asignado", "ubicaciones",
  ];
  const ffp = fFields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  const fincaFilter = isAdmin
    ? "TRUE()"
    : `FIND('${coordinadorId}', ARRAYJOIN({coordinador_id}, ',')) > 0`;

  const fincas: any[] = [];
  let offset = "";
  do {
    const url = `https://api.airtable.com/v0/${BASE}/FINCAS?filterByFormula=${encodeURIComponent(fincaFilter)}&${ffp}&pageSize=100${offset ? "&offset=" + offset : ""}`;
    const data = await airtableGet(url);
    if (data.error) return NextResponse.json({ error: "Error Airtable", detail: data.error }, { status: 500 });
    fincas.push(...data.records);
    offset = data.offset || "";
  } while (offset);

  if (fincas.length === 0) {
    return NextResponse.json({ grupos: [], totalFincas: 0, totalRevisadas: 0 });
  }

  const fincaMap = new Map<string, any>();
  for (const f of fincas) fincaMap.set(f.id, f);

  // 2. Recolectar IDs de ubicaciones desde el inverse link `ubicaciones` de cada finca
  const ubicacionIdsSet = new Set<string>();
  for (const f of fincas) {
    for (const uid of (f.fields.ubicaciones || [])) ubicacionIdsSet.add(uid);
  }
  const ubicacionIds = Array.from(ubicacionIdsSet);

  // 3. Fetch ubicaciones por RECORD_ID (que sí funciona)
  const ubicaciones: any[] = [];
  if (ubicacionIds.length > 0) {
    const uFields = [
      "nombregenerador", "cedulagenerador", "direcciongenerador",
      "mundep", "cultivogenerador", "movilgenerador", "emailgenerador",
      "tipogenerador", "finca",
    ];
    const ufp = uFields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
    for (let i = 0; i < ubicacionIds.length; i += CHUNK) {
      const chunk = ubicacionIds.slice(i, i + CHUNK);
      const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const url = `https://api.airtable.com/v0/${BASE}/ubicaciones?filterByFormula=${encodeURIComponent(formula)}&${ufp}&pageSize=100`;
      const data = await airtableGet(url);
      if (data.error) return NextResponse.json({ error: "Error Airtable", detail: data.error }, { status: 500 });
      ubicaciones.push(...data.records);
    }
  }

  // 4. IDs de GENERADORES
  const generadorIdsSet = new Set<string>();
  for (const finca of fincaMap.values()) {
    const gId = finca.fields.generador?.[0];
    if (gId) generadorIdsSet.add(gId);
  }
  const generadorIds = Array.from(generadorIdsSet);

  // 4. Fetch GENERADORES
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

  // 5. Construir items por ubicacion — solo los cuya finca quedó en fincaMap
  // (las fincas reasignadas a otro coordinador ya se excluyeron en el paso 3.5)
  const items = ubicaciones
    .filter((u) => {
      const fid = u.fields.finca?.[0];
      return fid && fincaMap.has(fid);
    })
    .map((u) => {
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
        coordinadorAsignadoId: finca.fields.coordinador_asignado?.[0] || null,
        revisado,
        notas,
      } : null,
    };
  });

  // 6. Agrupar por GENERADOR
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

  // 7. Ordenar
  const grupos = Array.from(gruposMap.values()).map((g) => {
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
