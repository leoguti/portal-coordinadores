import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  airtableGetRecord,
  airtablePatchRecord,
} from "@/lib/aprobacionesHelpers";
import { notificarFincaRechazada } from "@/lib/textitNotify";
import { normalizarMovilCO } from "@/lib/validacionesCO";

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
    // Fincas del auto-registro sin coordinador_id: autorizar vía el
    // coordinador_solicitado del GENERADOR padre (mismo criterio que aprobar)
    let autorizado = cs.includes(coordId);
    if (!autorizado && cs.length === 0) {
      const genIds = Array.isArray(rec.fields.generador)
        ? (rec.fields.generador as string[])
        : [];
      const padres = await Promise.all(
        genIds.map((gid) => airtableGetRecord("GENERADORES", gid))
      );
      autorizado = padres.some((g) =>
        (Array.isArray(g?.fields?.coordinador_solicitado)
          ? (g!.fields.coordinador_solicitado as string[])
          : []
        ).includes(coordId)
      );
    }
    if (!autorizado) {
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
      // Avisar al encargado (móvil de la finca) Y al titular (móvil del
      // generador), igual que en aprobar.
      const tels = new Set<string>();
      const telFinca = normalizarMovilCO(String(rec.fields.movil || ""));
      if (telFinca) tels.add(telFinca);
      if (Array.isArray(rec.fields.generador) && rec.fields.generador.length > 0) {
        const gen = await airtableGetRecord(
          "GENERADORES",
          String(rec.fields.generador[0])
        );
        const telGen = normalizarMovilCO(String(gen?.fields?.movil || ""));
        if (telGen) tels.add(telGen);
      }
      if (tels.size > 0) {
        const coordRec = await airtableGetRecord("Coordinadores", coordId);
        const nombreCoord = String(coordRec?.fields?.Name || "Coordinador");
        for (const tel of tels) {
          const r = await notificarFincaRechazada({
            telefono: tel,
            nombreFinca: String(rec.fields.nombre || ""),
            motivo,
            nombreCoordinador: nombreCoord,
            esRevision: estado === "pendiente_revision",
          });
          console.log(`[finca/${id}/rechazar wa→${tel}] ${r.ok ? "OK" : "FAIL"}: ${r.message}`);
        }
      }
    } catch (err) {
      console.error(`[finca/${id}/rechazar wa] Error:`, err);
    }
  });

  return NextResponse.json({ ok: true, estado: "rechazado" });
}
