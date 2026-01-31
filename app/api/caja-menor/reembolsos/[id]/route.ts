import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getReembolsoCajaMenorById } from "@/lib/airtable";

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
