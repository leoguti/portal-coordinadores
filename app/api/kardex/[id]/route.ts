import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { deleteKardexWithConciliacion, getKardexByIds } from "@/lib/airtable";

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

    // Verificar restricción de fecha (misma lógica que órdenes)
    const fechaKardex = kardexData.fields.fechakardex;
    if (!fechaKardex) {
      return NextResponse.json(
        { error: "Fecha de kardex no válida" },
        { status: 400 }
      );
    }

    const fechaMovimiento = new Date(fechaKardex + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const diaActual = hoy.getDate();

    let puedeEliminar = false;
    if (diaActual > 7) {
      // Después del día 7: solo mes actual
      const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      puedeEliminar = fechaMovimiento >= inicioMesActual;
    } else {
      // Días 1-7: mes anterior y actual
      const inicioMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      puedeEliminar = fechaMovimiento >= inicioMesAnterior;
    }

    if (!puedeEliminar) {
      return NextResponse.json(
        { 
          error: diaActual > 7
            ? "Solo se pueden eliminar movimientos del mes actual después del día 7"
            : "Solo se pueden eliminar movimientos del mes actual y anterior durante los primeros 7 días del mes"
        },
        { status: 403 }
      );
    }

    // Verificar si tiene conciliación vinculada
    const hasConciliacion = kardexData.fields.RegistroConciliacion && 
                           kardexData.fields.RegistroConciliacion.length > 0;

    console.log(`🔍 [DELETE KARDEX] ${kardexId}`, {
      hasConciliacion,
      conciliacionId: hasConciliacion ? kardexData.fields.RegistroConciliacion[0] : null
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
