import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;
const TABLE = "LegalizacionesMensuales";

async function airtable(path: string, init?: RequestInit) {
  return fetch(`https://api.airtable.com/v0/${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

/**
 * GET /api/legalizaciones/[id]
 * Retorna la legalización + gastos del coordinador en ese mes + totales agrupados por Tipo de rubro.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  // 1. Obtener la legalización
  const resLeg = await airtable(`/${TABLE}/${id}`);
  if (!resLeg.ok) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const leg = await resLeg.json();

  const coordinadorId: string | undefined = leg.fields?.coordinador?.[0];
  const mes: string = leg.fields?.mes_reporte || "";
  const isAdmin = isAdminOrSupervisor(session.user.rol);

  // Autorización: coordinador solo ve la suya
  if (!isAdmin && coordinadorId !== session.user.coordinatorRecordId) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  // 2. Obtener gastos del coordinador en ese mes (usando el campo MesLegalizacion que ya existe)
  const gastos: Array<{ id: string; fields: Record<string, unknown> }> = [];
  if (coordinadorId && mes) {
    const filter = `AND(FIND('${coordinadorId}', ARRAYJOIN({Coordinador}, ','))>0, {MesLegalizacion}='${mes}')`;
    let offset: string | undefined;
    do {
      const r = await airtable(
        `/GastosCajaMenor?pageSize=100&filterByFormula=${encodeURIComponent(filter)}&sort%5B0%5D%5Bfield%5D=Fecha&sort%5B0%5D%5Bdirection%5D=asc${offset ? `&offset=${offset}` : ""}`
      );
      if (!r.ok) break;
      const d = (await r.json()) as { records: typeof gastos; offset?: string };
      gastos.push(...(d.records || []));
      offset = d.offset;
    } while (offset);
  }

  // 3. Obtener rubros (para saber el Tipo de cada uno)
  const rubroIds = Array.from(
    new Set(gastos.flatMap((g) => ((g.fields as Record<string, string[]>).Rubro || []) as string[]))
  );
  const rubrosById = new Map<string, { nombre: string; tipo: string }>();
  if (rubroIds.length > 0) {
    const or = rubroIds.map((rid) => `RECORD_ID()='${rid}'`).join(",");
    const r = await airtable(`/Rubros?filterByFormula=${encodeURIComponent(`OR(${or})`)}&pageSize=100`);
    const d = await r.json();
    for (const rec of d.records || []) {
      rubrosById.set(rec.id, {
        nombre: rec.fields.Nombre || "Sin nombre",
        tipo: Array.isArray(rec.fields.Tipo) ? rec.fields.Tipo[0] : rec.fields.Tipo || "Otros",
      });
    }
  }

  // 4. Agrupar por Tipo de rubro y calcular totales
  const byTipo = new Map<string, { tipo: string; gastos: typeof gastos; total: number }>();
  let totalGeneral = 0;
  for (const g of gastos) {
    const rubroId = (g.fields.Rubro as string[] | undefined)?.[0];
    const rubroInfo = rubroId ? rubrosById.get(rubroId) : null;
    const tipo = rubroInfo?.tipo || "Sin tipo";
    const valor = (g.fields.Valor as number) || 0;
    const montoIVA = (g.fields.MontoIVA as number) || 0;
    const valorRetencion = (g.fields.ValorRetencion as number) || 0;
    const valorNeto = valor + montoIVA - valorRetencion;
    totalGeneral += valorNeto;
    if (!byTipo.has(tipo)) byTipo.set(tipo, { tipo, gastos: [], total: 0 });
    const bucket = byTipo.get(tipo)!;
    bucket.gastos.push(g);
    bucket.total += valorNeto;
  }

  // Orden preferido de secciones
  const ordenTipos = [
    "Viajes",
    "Transporte",
    "Operacion CA",
    "Generales",
    "Sg-sst",
    "Disposicion Final",
    "Sin tipo",
  ];
  const secciones = ordenTipos
    .map((t) => byTipo.get(t))
    .filter(Boolean)
    .concat(
      [...byTipo.values()].filter((s) => !ordenTipos.includes(s.tipo))
    );

  return NextResponse.json({
    legalizacion: leg,
    secciones,
    totalGeneral,
    rubrosById: Object.fromEntries(rubrosById.entries()),
  });
}

/**
 * PATCH /api/legalizaciones/[id]
 * Body:
 *   { accion: "enviar" }       → estado: borrador → pendiente_aprobacion (coordinador)
 *   { accion: "aprobar" }      → estado: pendiente_aprobacion → aprobado (admin)
 *   { accion: "rechazar", motivo } → estado: pendiente_aprobacion → rechazado (admin)
 *   { accion: "reabrir" }      → estado: rechazado → borrador (coordinador)
 *   { accion: "pagar" }        → estado: aprobado → pagado (admin)
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();
  const accion = body.accion as string;
  const motivo = body.motivo as string | undefined;
  const isAdmin = isAdminOrSupervisor(session.user.rol);

  // Obtener estado actual
  const resLeg = await airtable(`/${TABLE}/${id}`);
  if (!resLeg.ok) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const leg = await resLeg.json();
  const estadoActual: string = leg.fields?.estado || "borrador";
  const coordinadorLeg: string | undefined = leg.fields?.coordinador?.[0];

  // Validar autoría
  const esDueño = coordinadorLeg === session.user.coordinatorRecordId;

  const fields: Record<string, unknown> = {};
  switch (accion) {
    case "enviar":
      if (!esDueño) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      if (estadoActual !== "borrador") {
        return NextResponse.json({ error: "Solo se puede enviar desde borrador" }, { status: 400 });
      }
      fields.estado = "pendiente_aprobacion";
      fields.rechazado_motivo = "";
      break;

    case "aprobar":
      if (!isAdmin) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      if (estadoActual !== "pendiente_aprobacion") {
        return NextResponse.json({ error: "Solo se puede aprobar cuando está pendiente" }, { status: 400 });
      }
      fields.estado = "aprobado";
      fields.aprobado_por = [session.user.coordinatorRecordId];
      fields.aprobado_at = new Date().toISOString();
      break;

    case "rechazar":
      if (!isAdmin) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      if (estadoActual !== "pendiente_aprobacion") {
        return NextResponse.json({ error: "Solo se puede rechazar cuando está pendiente" }, { status: 400 });
      }
      fields.estado = "rechazado";
      fields.rechazado_motivo = motivo || "Rechazado";
      break;

    case "reabrir":
      if (!esDueño) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      if (estadoActual !== "rechazado") {
        return NextResponse.json({ error: "Solo se puede reabrir desde rechazado" }, { status: 400 });
      }
      fields.estado = "borrador";
      break;

    case "pagar":
      if (!isAdmin) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
      if (estadoActual !== "aprobado") {
        return NextResponse.json({ error: "Solo se puede marcar pagado cuando está aprobado" }, { status: 400 });
      }
      fields.estado = "pagado";
      break;

    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const res = await airtable(`/${TABLE}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[legalizaciones] PATCH error:", err);
    return NextResponse.json({ error: "Error actualizando" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
