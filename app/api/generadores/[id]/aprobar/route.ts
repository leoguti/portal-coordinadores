/**
 * POST /api/generadores/[id]/aprobar
 *
 * Aprueba un generador pendiente (auto-registro desde WhatsApp) o un
 * generador con cambios pendientes (pendiente_revision).
 *
 * Auth: sesión NextAuth. Coordinador puede aprobar si está marcado como
 * coordinador_solicitado; admin/supervisor puede aprobar cualquiera.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  airtableGetRecord,
  airtablePatchRecord,
} from "@/lib/aprobacionesHelpers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const isAdmin = isAdminOrSupervisor(session.user.rol);
  const coordId = session.user.coordinatorRecordId;

  const rec = await airtableGetRecord("GENERADORES", id);
  if (!rec) {
    return NextResponse.json({ error: "Generador no encontrado" }, { status: 404 });
  }
  const f = rec.fields;
  const estado = String(f.estado || "");
  if (estado !== "pendiente" && estado !== "pendiente_revision") {
    return NextResponse.json(
      { error: `Estado actual: ${estado}` },
      { status: 409 }
    );
  }

  if (!isAdmin) {
    const cs = Array.isArray(f.coordinador_solicitado)
      ? (f.coordinador_solicitado as string[])
      : [];
    if (!cs.includes(coordId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const res = await airtablePatchRecord("GENERADORES", id, {
    estado: "aprobado",
    fecha_aprobacion: new Date().toISOString(),
    aprobado_por: [coordId],
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, estado: "aprobado" });
}
