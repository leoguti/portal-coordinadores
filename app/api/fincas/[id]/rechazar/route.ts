import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  airtableGetRecord,
  airtablePatchRecord,
} from "@/lib/aprobacionesHelpers";
import { notificarFincaRechazada } from "@/lib/textitNotify";

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

  const rec = await airtableGetRecord("FINCAS", id);
  if (!rec) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  }
  const estado = String(rec.fields.estado || "");
  if (estado !== "pendiente" && estado !== "pendiente_revision") {
    return NextResponse.json({ error: `Estado actual: ${estado}` }, { status: 409 });
  }
  if (!isAdmin) {
    const cs = Array.isArray(rec.fields.coordinador_id)
      ? (rec.fields.coordinador_id as string[])
      : [];
    if (!cs.includes(coordId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  // Rechazo descarta los cambios propuestos (staging) — los campos del
  // record quedan con los valores previos a la edición.
  const res = await airtablePatchRecord("FINCAS", id, {
    estado: "rechazado",
    motivo_rechazo: motivo,
    fecha_rechazo: new Date().toISOString(),
    rechazado_por: [coordId],
    cambios_pendientes: "",
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  after(async () => {
    try {
      let tel = String(rec.fields.movil || "");
      if (
        !tel &&
        Array.isArray(rec.fields.generador) &&
        rec.fields.generador.length > 0
      ) {
        const gen = await airtableGetRecord(
          "GENERADORES",
          String(rec.fields.generador[0])
        );
        tel = String(gen?.fields?.movil || "");
      }
      if (tel) {
        const coordRec = await airtableGetRecord("Coordinadores", coordId);
        const nombreCoord = String(coordRec?.fields?.Name || "Coordinador");
        const r = await notificarFincaRechazada({
          telefono: tel,
          nombreFinca: String(rec.fields.nombre || ""),
          motivo,
          nombreCoordinador: nombreCoord,
        });
        console.log(`[finca/${id}/rechazar wa] ${r.ok ? "OK" : "FAIL"}: ${r.message}`);
      }
    } catch (err) {
      console.error(`[finca/${id}/rechazar wa] Error:`, err);
    }
  });

  return NextResponse.json({ ok: true, estado: "rechazado" });
}
