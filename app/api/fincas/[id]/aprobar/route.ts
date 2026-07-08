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

  // Las fincas del auto-registro no traen coordinador_id: su coordinador es el
  // coordinador_solicitado del GENERADOR padre. Resolvemos el padre una sola
  // vez (también sirve para la regla de orden de abajo).
  const genIds = Array.isArray(f.generador) ? (f.generador as string[]) : [];
  const padres = await Promise.all(
    genIds.map((gid) => airtableGetRecord("GENERADORES", gid))
  );

  if (!isAdmin) {
    const cs = Array.isArray(f.coordinador_id) ? (f.coordinador_id as string[]) : [];
    const coordsPadre = padres.flatMap((g) =>
      Array.isArray(g?.fields?.coordinador_solicitado)
        ? (g!.fields.coordinador_solicitado as string[])
        : []
    );
    if (!cs.includes(coordId) && !coordsPadre.includes(coordId)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  // Regla de orden (2026-07-08): una finca nueva no se aprueba hasta que su
  // generador esté aprobado — sin generador válido la finca no tiene dueño.
  if (estado === "pendiente" && genIds.length > 0) {
    const padreAprobado = padres.some(
      (g) => String(g?.fields?.estado || "") === "aprobado"
    );
    if (!padreAprobado) {
      return NextResponse.json(
        { error: "Primero aprueba el registro del generador de esta finca" },
        { status: 409 }
      );
    }
  }

  const esRevision = estado === "pendiente_revision";

  // Si está en pendiente_revision con cambios_pendientes, aplicar el diff
  // ahora. (En auto-registro nuevo "pendiente", los campos ya son los
  // valores reales.)
  const cambiosAAplicar: Record<string, unknown> = {};
  const cpRaw = f.cambios_pendientes ? String(f.cambios_pendientes) : "";
  if (cpRaw && esRevision) {
    try {
      const parsed = JSON.parse(cpRaw) as { cambios?: Record<string, unknown> };
      if (parsed.cambios && typeof parsed.cambios === "object") {
        Object.assign(cambiosAAplicar, parsed.cambios);
      }
    } catch {
      console.warn(`[finca/${id}/aprobar] cambios_pendientes JSON inválido`);
    }
  }

  const res = await airtablePatchRecord("FINCAS", id, {
    ...cambiosAAplicar,
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
