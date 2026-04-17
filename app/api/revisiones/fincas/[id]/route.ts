import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
  }

  const data = await resFinca.json();
  return NextResponse.json(data);
}
