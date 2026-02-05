import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getReembolsosCajaMenor,
  createReembolsoCajaMenor,
} from "@/lib/airtable";

/**
 * GET /api/caja-menor/reembolsos — Listar reembolsos
 * Admin: todos. Coordinador: los suyos.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const isAdmin = session.user?.rol === "Administrador";
    const coordinadorId = isAdmin ? undefined : session.user?.coordinatorRecordId;

    const reembolsos = await getReembolsosCajaMenor(coordinadorId || undefined);

    return NextResponse.json({ reembolsos });
  } catch (error) {
    console.error("Error fetching reembolsos:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/caja-menor/reembolsos — Crear reembolso (solo admin)
 * Body: { coordinadorId: string, monto: number, fecha?: string, observaciones?: string }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (session.user?.rol !== "Administrador") {
      return NextResponse.json({ error: "Solo admin puede crear reembolsos" }, { status: 403 });
    }

    const body = await request.json();
    const { coordinadorId, monto, fecha, observaciones } = body;

    if (!coordinadorId || monto === undefined || monto <= 0) {
      return NextResponse.json({ error: "Faltan campos requeridos (coordinadorId, monto > 0)" }, { status: 400 });
    }

    const reembolso = await createReembolsoCajaMenor({
      coordinadorId,
      monto,
      fecha,
      observaciones,
    });

    return NextResponse.json({ reembolso }, { status: 201 });
  } catch (error) {
    console.error("Error creating reembolso:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
