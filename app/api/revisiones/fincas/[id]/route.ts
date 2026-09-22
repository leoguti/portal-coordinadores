import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { registrarEdicion } from "@/lib/auditoria";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

// PATCH /api/revisiones/fincas/[id]
// id = FINCA record ID
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const fincaFields: Record<string, unknown> = {};
  if (body.nombre !== undefined) fincaFields.nombre = body.nombre;
  if (body.municipioId !== undefined) fincaFields.municipio = body.municipioId ? [body.municipioId] : [];
  if (body.cultivoIds !== undefined) fincaFields.cultivos = body.cultivoIds;
  if (body.movil !== undefined) fincaFields.movil = body.movil;
  if (body.fijo !== undefined) fincaFields.fijo = body.fijo;
  if (body.email !== undefined) fincaFields.email = body.email;
  if (body.coordinadorAsignadoId !== undefined) {
    fincaFields.coordinador_asignado = body.coordinadorAsignadoId ? [body.coordinadorAsignadoId] : [];
  }

  if (body.marcarRevisado) {
    fincaFields.revisado = true;
    fincaFields.revisado_por = [session.user.coordinatorRecordId];
  }

  // Actualizar FINCA
  const resFinca = await fetch(`https://api.airtable.com/v0/${BASE}/FINCAS/${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: fincaFields }),
  });

  if (!resFinca.ok) {
    const err = await resFinca.text();
    console.error("[revisiones/fincas/patch]", err);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  // Auditoría: quién editó y cuándo (best-effort, no bloquea la respuesta)
  const coordinador = session.user.name || session.user.email || "coordinador";
  await registrarEdicion({ tipo: "finca", fichaId: id, fichaNombre: body.nombre, coordinador });

  // Si viene nit/nombre del generador, actualizar GENERADOR también
  if (body.generadorId && (body.generadorNombre !== undefined || body.generadorNit !== undefined || body.generadorTipo !== undefined)) {
    const genFields: Record<string, unknown> = {};
    if (body.generadorNombre !== undefined) genFields.nombre = body.generadorNombre;
    if (body.generadorNit !== undefined) genFields.nit = body.generadorNit;
    if (body.generadorTipo !== undefined) genFields.tipo = body.generadorTipo;

    await fetch(`https://api.airtable.com/v0/${BASE}/GENERADORES/${body.generadorId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: genFields }),
    });
    await registrarEdicion({ tipo: "generador", fichaId: body.generadorId, fichaNombre: body.generadorNombre, coordinador });
  }

  const data = await resFinca.json();
  return NextResponse.json(data);
}
