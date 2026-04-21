import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getGastoCajaMenorById,
  updateEstadoGasto,
  updateGastoCajaMenor,
  deleteGastoCajaMenor,
} from "@/lib/airtable";
import { puedeModificarFecha } from "@/lib/dateValidations";
import { isAdminOrSupervisor } from "@/lib/roles";

/**
 * GET /api/caja-menor/[id] — Obtener detalle de un gasto
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const gasto = await getGastoCajaMenorById(id);

    if (!gasto) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    // Coordinador solo puede ver sus propios gastos
    const canViewAll = isAdminOrSupervisor(session.user?.rol);
    if (!canViewAll) {
      const coordinadores = gasto.fields.Coordinador || [];
      if (!coordinadores.includes(session.user?.coordinatorRecordId || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    return NextResponse.json({ gasto });
  } catch (error) {
    console.error("Error fetching gasto:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/caja-menor/[id] — Cambiar estado (admin) o corregir gasto rechazado (coordinador)
 *
 * Body para admin: { action: "aprobar" | "rechazar" | "reembolsar", observaciones?: string }
 * Body para coordinador: { action: "corregir", fecha?, beneficiarioId?, rubroRecordId?, observaciones?, valor?, porcentajeRetencion?, facturaUrl? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const gasto = await getGastoCajaMenorById(id);
    if (!gasto) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    const isAdmin = session.user?.rol === "Administrador";

    // Admin: aprobar o rechazar
    if (action === "aprobar" || action === "rechazar") {
      if (!isAdmin) {
        return NextResponse.json({ error: "Solo admin puede aprobar/rechazar" }, { status: 403 });
      }

      if (gasto.fields.Estado !== "Pendiente") {
        return NextResponse.json({ error: "Solo se pueden aprobar/rechazar gastos pendientes" }, { status: 400 });
      }

      const estado = action === "aprobar" ? "Aprobado" : "Rechazado";
      const success = await updateEstadoGasto(id, estado, body.observaciones);

      if (!success) {
        return NextResponse.json({ error: "Error al actualizar estado" }, { status: 500 });
      }

      return NextResponse.json({ success: true, estado });
    }

    // Coordinador: corregir gasto rechazado
    if (action === "corregir") {
      const coordinadores = gasto.fields.Coordinador || [];
      if (!coordinadores.includes(session.user?.coordinatorRecordId || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }

      if (gasto.fields.Estado !== "Rechazado") {
        return NextResponse.json({ error: "Solo se pueden corregir gastos rechazados" }, { status: 400 });
      }

      const success = await updateGastoCajaMenor(id, {
        fecha: body.fecha,
        beneficiarioId: body.beneficiarioId,
        rubroRecordId: body.rubroRecordId || undefined,
        observaciones: body.observaciones,
        valor: body.valor,
        porcentajeRetencion: body.porcentajeRetencion,
        porcentajeIVA: body.porcentajeIVA,
        montoIVA: body.montoIVA,
        facturaUrl: body.facturaUrl,
        municipioId: body.municipioId,
        municipioDestinoId: body.municipioDestinoId,
        hora: body.hora,
        noches: body.noches,
        tipoSoporte: body.tipoSoporte,
        numeroSoporte: body.numeroSoporte,
      });

      if (!success) {
        return NextResponse.json({ error: "Error al actualizar gasto" }, { status: 500 });
      }

      return NextResponse.json({ success: true, estado: "Pendiente" });
    }

    return NextResponse.json({ error: "Accion no valida" }, { status: 400 });
  } catch (error) {
    console.error("Error updating gasto:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/caja-menor/[id] — Eliminar gasto
 * Solo si Estado=Pendiente y dentro de regla 7 dias
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const gasto = await getGastoCajaMenorById(id);

    if (!gasto) {
      return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
    }

    // Verificar que es el coordinador dueno del gasto
    const coordinadores = gasto.fields.Coordinador || [];
    const isAdmin = session.user?.rol === "Administrador";
    if (!isAdmin && !coordinadores.includes(session.user?.coordinatorRecordId || "")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Solo se pueden eliminar gastos Pendiente
    if (gasto.fields.Estado !== "Pendiente") {
      return NextResponse.json({ error: "Solo se pueden eliminar gastos pendientes" }, { status: 400 });
    }

    // Verificar regla de 7 dias
    if (gasto.fields.Fecha && !puedeModificarFecha(gasto.fields.Fecha)) {
      return NextResponse.json({ error: "El gasto esta fuera del periodo modificable (regla 7 dias)" }, { status: 400 });
    }

    const success = await deleteGastoCajaMenor(id);

    if (!success) {
      return NextResponse.json({ error: "Error al eliminar gasto" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting gasto:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
