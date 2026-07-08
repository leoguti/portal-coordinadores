/**
 * POST /api/certificados/[id]/rechazar
 *
 * Marca el cert como rechazado con motivo desde la bandeja del portal.
 * No genera PDF. Delega en lib/certificadosDecision (misma lógica que el
 * enlace mágico por email) e instrumenta decision_via="bandeja" +
 * dispositivo. Notifica al agricultor por WhatsApp con el motivo.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  rechazarCertificado,
  cargarCertPendiente,
  coordIdsDelCert,
  normalizarDispositivo,
  DecisionCertError,
} from "@/lib/certificadosDecision";

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

  let body: { motivo?: string; dispositivo?: string };
  try {
    body = (await request.json()) as { motivo?: string; dispositivo?: string };
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

  try {
    // Verificar que exista, siga pendiente y sea del coordinador.
    const rec = await cargarCertPendiente(id);
    const certCoordIds = coordIdsDelCert(rec);
    if (!isAdmin && !certCoordIds.includes(coordId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    await rechazarCertificado({
      rec,
      coordId,
      motivo,
      meta: {
        via: "bandeja",
        dispositivo: normalizarDispositivo(body.dispositivo),
      },
      after,
    });

    return NextResponse.json({ ok: true, estado: "rechazado" });
  } catch (err) {
    if (err instanceof DecisionCertError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(`[certificados/${id}/rechazar] Error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
