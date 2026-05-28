import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  airtableGetRecord,
  airtablePatchRecord,
} from "@/lib/aprobacionesHelpers";
import { notificarFincaAprobada } from "@/lib/textitNotify";

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

  const rec = await airtableGetRecord("FINCAS", id);
  if (!rec) {
    return NextResponse.json({ error: "Finca no encontrada" }, { status: 404 });
  }
  const f = rec.fields;
  const estado = String(f.estado || "");
  if (estado !== "pendiente" && estado !== "pendiente_revision") {
    return NextResponse.json({ error: `Estado actual: ${estado}` }, { status: 409 });
  }

  if (!isAdmin) {
    const cs = Array.isArray(f.coordinador_id) ? (f.coordinador_id as string[]) : [];
    if (!cs.includes(coordId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const esRevision = estado === "pendiente_revision";

  // En pendiente_revision los cambios ya están aplicados (el form los hizo
  // PATCH al enviar). Solo limpiamos cambios_pendientes y marcamos estado.
  const res = await airtablePatchRecord("FINCAS", id, {
    estado: "aprobado",
    fecha_aprobacion: new Date().toISOString(),
    aprobado_por: [coordId],
    cambios_pendientes: "",
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  after(async () => {
    try {
      // Buscar móvil: primero el de la finca, sino el del generador
      let tel = String(f.movil || "");
      if (!tel && Array.isArray(f.generador) && f.generador.length > 0) {
        const gen = await airtableGetRecord("GENERADORES", String(f.generador[0]));
        tel = String(gen?.fields?.movil || "");
      }
      if (tel) {
        const coordRec = await airtableGetRecord("Coordinadores", coordId);
        const nombreCoord = String(coordRec?.fields?.Name || "Coordinador");
        const r = await notificarFincaAprobada({
          telefono: tel,
          nombreFinca: String(f.nombre || ""),
          nombreCoordinador: nombreCoord,
          esRevision,
        });
        console.log(`[finca/${id}/aprobar wa] ${r.ok ? "OK" : "FAIL"}: ${r.message}`);
      }
    } catch (err) {
      console.error(`[finca/${id}/aprobar wa] Error:`, err);
    }
  });

  return NextResponse.json({ ok: true, estado: "aprobado" });
}
