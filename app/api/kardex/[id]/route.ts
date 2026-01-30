import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { deleteKardexWithConciliacion, getKardexByIds } from "@/lib/airtable";
import { puedeModificarFecha, getMensajeErrorFecha } from "@/lib/dateValidations";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: kardexId } = await params;

    // Verificar que el kardex existe y pertenece al coordinador
    const kardexList = await getKardexByIds([kardexId]);
    
    if (kardexList.length === 0) {
      return NextResponse.json(
        { error: "Kardex no encontrado" },
        { status: 404 }
      );
    }

    const kardexData = kardexList[0];
    const coordinadorIds = kardexData.fields.Coordinador || [];

    if (!coordinadorIds.includes(session.user.coordinatorRecordId)) {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar este movimiento" },
        { status: 403 }
      );
    }

    // Verificar restricción de fecha (regla de 7 días)
    const fechaKardex = kardexData.fields.fechakardex;
    if (!fechaKardex) {
      return NextResponse.json(
        { error: "Fecha de kardex no válida" },
        { status: 400 }
      );
    }

    if (!puedeModificarFecha(fechaKardex)) {
      return NextResponse.json(
        { error: getMensajeErrorFecha() },
        { status: 403 }
      );
    }

    // Verificar si tiene conciliación vinculada
    const hasConciliacion = kardexData.fields.RegistroConciliacion && 
                           kardexData.fields.RegistroConciliacion.length > 0;

    console.log(`🔍 [DELETE KARDEX] ${kardexId}`, {
      hasConciliacion,
      conciliacionId: kardexData.fields.RegistroConciliacion?.[0] ?? null
    });

    // Eliminar usando función que maneja conciliación
    const success = await deleteKardexWithConciliacion(kardexId);

    if (!success) {
      return NextResponse.json(
        { error: "Error al eliminar el movimiento" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: hasConciliacion 
        ? "Movimiento y su registro de conciliación eliminados correctamente"
        : "Movimiento eliminado correctamente"
    });

  } catch (error) {
    console.error("Error en DELETE /api/kardex/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
