import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  airtableGetRecord,
  airtablePatchRecord,
} from "@/lib/aprobacionesHelpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const isAdmin = isAdminOrSupervisor(session.user.rol);
  const coordId = session.user.coordinatorRecordId;

  let body: { motivo?: string };
  try {
    body = (await request.json()) as { motivo?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const motivo = (body.motivo || "").trim();
  if (motivo.length < 10) {
    return NextResponse.json(
      { error: "Indica un motivo de rechazo (mínimo 10 caracteres)" },
      { status: 400 }
    );
  }

  const rec = await airtableGetRecord("GENERADORES", id);
  if (!rec) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const estado = String(rec.fields.estado || "");
  if (estado !== "pendiente" && estado !== "pendiente_revision") {
    return NextResponse.json({ error: `Estado actual: ${estado}` }, { status: 409 });
  }
  if (!isAdmin) {
    const cs = Array.isArray(rec.fields.coordinador_solicitado)
      ? (rec.fields.coordinador_solicitado as string[])
      : [];
    if (!cs.includes(coordId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const res = await airtablePatchRecord("GENERADORES", id, {
    estado: "rechazado",
    motivo_rechazo: motivo,
    fecha_rechazo: new Date().toISOString(),
    rechazado_por: [coordId],
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, estado: "rechazado" });
}
