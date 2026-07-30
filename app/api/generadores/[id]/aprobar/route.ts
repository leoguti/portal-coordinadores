/**
 * POST /api/generadores/[id]/aprobar
 *
 * Aprueba un generador pendiente (auto-registro desde WhatsApp) o un
 * generador con cambios pendientes (pendiente_revision).
 *
 * Auth: sesión NextAuth. Coordinador puede aprobar si está marcado como
 * coordinador_solicitado; admin/supervisor puede aprobar cualquiera.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import {
  airtableGetRecord,
  airtablePatchRecord,
} from "@/lib/aprobacionesHelpers";
import { notificarGeneradorAprobado } from "@/lib/textitNotify";

async function getCoordinadorNombre(coordId: string): Promise<string> {
  const rec = await airtableGetRecord("Coordinadores", coordId);
  return String(rec?.fields?.Name || "Coordinador");
}

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

  // Si está en pendiente_revision con cambios_pendientes, aplicar el diff.
  // (Si es pendiente — auto-registro nuevo — los campos ya tienen los valores
  // reales en el record.)
  const cambiosAAplicar: Record<string, unknown> = {};
  const cpRaw = f.cambios_pendientes ? String(f.cambios_pendientes) : "";
  if (cpRaw && estado === "pendiente_revision") {
    try {
      const parsed = JSON.parse(cpRaw) as { cambios?: Record<string, unknown> };
      if (parsed.cambios && typeof parsed.cambios === "object") {
        Object.assign(cambiosAAplicar, parsed.cambios);
      }
    } catch {
      // JSON inválido — seguir con aprobación pero log
      console.warn(`[gen/${id}/aprobar] cambios_pendientes JSON inválido`);
    }
  }

  const res = await airtablePatchRecord("GENERADORES", id, {
    ...cambiosAAplicar,
    estado: "aprobado",
    fecha_aprobacion: new Date().toISOString(),
    aprobado_por: [coordId],
    cambios_pendientes: "",
  });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 500 });
  }

  // Notificar al agricultor por WhatsApp (background, no bloquea respuesta).
  const esRevision = estado === "pendiente_revision";
  // Usar el nombre del diff aplicado si está, sino el del record.
  const nombreActual = (cambiosAAplicar.nombre as string) || String(f.nombre || "");
  after(async () => {
    try {
      const tel = String(f.movil || "");
      if (tel) {
        const nombreCoord = await getCoordinadorNombre(coordId);
        // Los certificados se generan por finca: el texto solo dice "ya
        // puedes generar certificados" si hay al menos una finca aprobada.
        const fincaIds = Array.isArray(f.FINCAS) ? (f.FINCAS as string[]) : [];
        let tieneFincaAprobada = false;
        for (const fid of fincaIds.slice(0, 10)) {
          const finca = await airtableGetRecord("FINCAS", fid);
          if (String(finca?.fields?.estado || "") === "aprobado") {
            tieneFincaAprobada = true;
            break;
          }
        }
        const r = await notificarGeneradorAprobado({
          telefono: tel,
          nombre: nombreActual,
          nombreCoordinador: nombreCoord,
          esRevision,
          tieneFincaAprobada,
        });
        console.log(
          `[gen/${id}/aprobar wa] ${r.ok ? "OK" : "FAIL"} (fincaAprobada=${tieneFincaAprobada}): ${r.message}`
        );
      }
    } catch (err) {
      console.error(`[gen/${id}/aprobar wa] Error:`, err);
    }
  });

  return NextResponse.json({ ok: true, estado: "aprobado" });
}
