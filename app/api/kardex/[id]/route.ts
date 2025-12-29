import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
      return NextResponse.json(
        { error: "Configuración de Airtable no disponible" },
        { status: 500 }
      );
    }

    // Verificar que el kardex pertenece al coordinador
    const getUrl = `https://api.airtable.com/v0/${baseId}/Kardex/${kardexId}`;
    const getResponse = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!getResponse.ok) {
      return NextResponse.json(
        { error: "Kardex no encontrado" },
        { status: 404 }
      );
    }

    const kardexData = await getResponse.json();
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

    // Eliminar el kardex
    const deleteUrl = `https://api.airtable.com/v0/${baseId}/Kardex/${kardexId}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error("Error eliminando kardex:", errorText);
      return NextResponse.json(
        { error: "Error al eliminar el movimiento" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: "Movimiento eliminado correctamente" 
    });

  } catch (error) {
    console.error("Error en DELETE /api/kardex/[id]:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
