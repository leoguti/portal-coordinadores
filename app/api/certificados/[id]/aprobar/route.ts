/**
 * POST /api/certificados/[id]/aprobar
 *
 * Aprueba un certificado pendiente desde la bandeja del portal:
 *  1. Verifica ownership (coordinador del cert o admin).
 *  2. Delegación a lib/certificadosDecision (misma lógica que el enlace
 *     mágico por email): edits opcionales, PDF, estado=aprobado,
 *     instrumentación (decision_via="bandeja" + dispositivo) y aviso WA.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  aprobarCertificado,
  cargarCertPendiente,
  coordIdsDelCert,
  normalizarDispositivo,
  DecisionCertError,
  type EditsAprobacion,
} from "@/lib/certificadosDecision";

export const maxDuration = 60;

interface Body extends EditsAprobacion {
  dispositivo?: string;
}

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

  try {
    // 1. Leer cert + verificar que siga pendiente.
    const rec = await cargarCertPendiente(id);

    // 2. Ownership.
    const certCoordIds = coordIdsDelCert(rec);
    if (!isAdmin && !certCoordIds.includes(coordId)) {
      return NextResponse.json(
        { error: "Este certificado no está asignado a ti" },
        { status: 403 }
      );
    }

    // 3. Body: edits opcionales + dispositivo (instrumentación).
    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      body = {};
    }

    const { consecutivo } = await aprobarCertificado({
      rec,
      coordId,
      edits: body,
      meta: {
        via: "bandeja",
        dispositivo: normalizarDispositivo(body.dispositivo),
      },
      after,
    });

    return NextResponse.json({ ok: true, consecutivo, estado: "aprobado" });
  } catch (err) {
    if (err instanceof DecisionCertError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`[certificados/${id}/aprobar] Error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
