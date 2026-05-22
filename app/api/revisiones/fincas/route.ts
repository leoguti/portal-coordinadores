import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import { getCultivosMap } from "@/lib/cultivosCache";

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

  // Admin puede filtrar por coordinador específico via query param
  const filtroCoordinadorId = isAdmin
    ? (request.nextUrl.searchParams.get("coordinadorId") || null)
    : coordinadorId;

  // 1. Fetch FINCAS asignadas al coordinador vía el rollup coordinador_id
  // (expone el RECORD_ID de coordinador_asignado como texto, sí filtrable).
  // La lista se ancla DIRECTAMENTE en FINCAS (modelo nuevo): ya no recorremos
  // `ubicaciones`, así toda finca aparece —venga de migración o de un
  // certificado— y la vista sobrevive al borrado de la tabla `ubicaciones`.
  const fFields = [
    "nombre", "generador", "municipio", "cultivos", "movil", "fijo", "email",
    "revisado", "notas_migracion", "coordinador_asignado", "Certificados",
  ];
  const ffp = fFields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  const fincaFilter = !filtroCoordinadorId
    ? "TRUE()"
    : `FIND('${filtroCoordinadorId}', ARRAYJOIN({coordinador_id}, ',')) > 0`;

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

  // 2. Resolver GENERADORES de esas fincas
  const generadorIdsSet = new Set<string>();
  for (const f of fincas) {
    const gId = f.fields.generador?.[0];
    if (gId) generadorIdsSet.add(gId);
  }
  const generadorMap = new Map<string, any>();
  const generadorIds = Array.from(generadorIdsSet);
  for (let i = 0; i < generadorIds.length; i += CHUNK) {
    const chunk = generadorIds.slice(i, i + CHUNK);
    const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    const gFields = ["nombre", "nit", "tipo", "tipopersona", "direccion_sede", "movil", "email"];
    const gfp = gFields.map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
    const url = `https://api.airtable.com/v0/${BASE}/GENERADORES?filterByFormula=${encodeURIComponent(formula)}&${gfp}&pageSize=100`;
    const data = await airtableGet(url);
    for (const r of (data.records || [])) generadorMap.set(r.id, r);
  }

  // 3. Resolver MUNICIPIOS de las fincas → nombre "mundep"
  const municipioIdsSet = new Set<string>();
  for (const f of fincas) {
    const mId = f.fields.municipio?.[0];
    if (mId) municipioIdsSet.add(mId);
  }
  const municipioMap = new Map<string, string>();
  const municipioIds = Array.from(municipioIdsSet);
  for (let i = 0; i < municipioIds.length; i += CHUNK) {
    const chunk = municipioIds.slice(i, i + CHUNK);
    const formula = `OR(${chunk.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    const url = `https://api.airtable.com/v0/${BASE}/MUNICIPIOS?filterByFormula=${encodeURIComponent(formula)}&fields[]=mundep&pageSize=100`;
    const data = await airtableGet(url);
    for (const r of (data.records || [])) {
      municipioMap.set(r.id, String(r.fields?.mundep || "").trim());
    }
  }

  // 4. Nombres de cultivos (cache en memoria)
  let cultivosMap = new Map<string, string>();
  try { cultivosMap = await getCultivosMap(); } catch { cultivosMap = new Map(); }

  // 5. Construir items anclados en FINCAS.
  // `original` se conserva por compatibilidad con el UI, pero ahora se puebla
  // con datos ya resueltos de la finca/generador (no de `ubicaciones`).
  const items = fincas.map((f) => {
    const ff = f.fields;
    const generadorId = ff.generador?.[0] || null;
    const municipioId = ff.municipio?.[0] || null;
    const municipioNombre = municipioId ? (municipioMap.get(municipioId) || "") : "";
    const cultivoIds: string[] = Array.isArray(ff.cultivos) ? ff.cultivos : [];
    const cultivoNombres = cultivoIds
      .map((id) => cultivosMap.get(id) || "")
      .filter(Boolean)
      .join(", ");
    const gen = generadorId ? generadorMap.get(generadorId) : null;
    const certCount = Array.isArray(ff.Certificados) ? ff.Certificados.length : 0;

    return {
      ubicacionId: null as string | null, // legacy: ya no se usa para nada
      fincaId: f.id,
      certCount,
      original: {
        nombre: gen ? String(gen.fields?.nombre || "") : "",
        nit: gen ? String(gen.fields?.nit || "") : "",
        direccion: String(ff.nombre || ""),
        municipio: municipioNombre,
        cultivo: cultivoNombres,
        movil: String(ff.movil || ""),
        email: String(ff.email || ""),
        tipo: gen ? String(gen.fields?.tipo || "") : "",
      },
      finca: {
        nombre: String(ff.nombre || ""),
        generadorId,
        municipioId,
        municipioNombre,
        cultivoIds,
        cultivoNombres,
        movil: String(ff.movil || ""),
        fijo: String(ff.fijo || ""),
        email: String(ff.email || ""),
        coordinadorAsignadoId: ff.coordinador_asignado?.[0] || null,
        revisado: ff.revisado || false,
        notas: ff.notas_migracion || "",
        certCount,
      },
    };
  });

  // 6. Agrupar por GENERADOR
  const gruposMap = new Map<string, {
    generadorId: string | null;
    generador: {
      nombre: string; nit: string; tipo: string; tipopersona: string;
      direccionSede: string; movil: string; email: string;
    } | null;
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
          tipopersona: genRecord.fields.tipopersona || "",
          direccionSede: genRecord.fields.direccion_sede || "",
          movil: genRecord.fields.movil || "",
          email: genRecord.fields.email || "",
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
