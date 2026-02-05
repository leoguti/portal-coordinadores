import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getReembolsoCajaMenorById, deleteReembolsoCajaMenor } from "@/lib/airtable";
import { puedeModificarFecha } from "@/lib/dateValidations";

/**
 * GET /api/caja-menor/reembolsos/[id] — Detalle de un reembolso
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
    const reembolso = await getReembolsoCajaMenorById(id);

    if (!reembolso) {
      return NextResponse.json({ error: "Reembolso no encontrado" }, { status: 404 });
    }

    // Coordinador solo puede ver sus propios reembolsos
    const isAdmin = session.user?.rol === "Administrador";
    if (!isAdmin) {
      const coordinadores = reembolso.fields.Coordinador || [];
      if (!coordinadores.includes(session.user?.coordinatorRecordId || "")) {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
      }
    }

    return NextResponse.json({ reembolso });
  } catch (error) {
    console.error("Error fetching reembolso:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/caja-menor/reembolsos/[id] — Eliminar un reembolso (solo admin, con regla de 7 dias)
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

    // Solo admin puede eliminar reembolsos
    if (session.user?.rol !== "Administrador") {
      return NextResponse.json({ error: "Solo admin puede eliminar reembolsos" }, { status: 403 });
    }

    const { id } = await params;

    // Verificar que el reembolso existe
    const reembolso = await getReembolsoCajaMenorById(id);
    if (!reembolso) {
      return NextResponse.json({ error: "Reembolso no encontrado" }, { status: 404 });
    }

    // Verificar regla de 7 dias
    const fecha = reembolso.fields.Fecha;
    if (!fecha || !puedeModificarFecha(fecha)) {
      return NextResponse.json({
        error: "Este reembolso ya no se puede eliminar (fuera del periodo modificable)"
      }, { status: 400 });
    }

    const success = await deleteReembolsoCajaMenor(id);
    if (!success) {
      return NextResponse.json({ error: "Error al eliminar el reembolso" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reembolso:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
