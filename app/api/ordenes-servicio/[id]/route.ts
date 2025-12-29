import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { deleteOrdenServicio } from "@/lib/airtable";

/**
 * DELETE /api/ordenes-servicio/[id]
 * Elimina una orden de servicio
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id: ordenId } = await params;

    console.log(`Deleting orden ${ordenId}...`);

    const success = await deleteOrdenServicio(ordenId);

    if (!success) {
      return NextResponse.json(
        { error: "Error al eliminar la orden" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "Orden eliminada correctamente" });
  } catch (error) {
    console.error("Error in DELETE /api/ordenes-servicio/[id]:", error);
    return NextResponse.json(
      { error: "Error al eliminar la orden" },
      { status: 500 }
    );
  }
}
