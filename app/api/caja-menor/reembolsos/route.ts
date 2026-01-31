import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getReembolsosCajaMenor,
  createReembolsoCajaMenor,
  getGastoCajaMenorById,
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
 * POST /api/caja-menor/reembolsos — Crear reembolso en lote (solo admin)
 * Body: { coordinadorId: string, gastoIds: string[], observaciones?: string }
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
    const { coordinadorId, gastoIds, observaciones } = body;

    if (!coordinadorId || !gastoIds || !Array.isArray(gastoIds) || gastoIds.length === 0) {
      return NextResponse.json({ error: "Faltan campos requeridos (coordinadorId, gastoIds)" }, { status: 400 });
    }

    // Validate all gastos exist, belong to the coordinator, and are in "Aprobado"
    for (const gastoId of gastoIds) {
      const gasto = await getGastoCajaMenorById(gastoId);
      if (!gasto) {
        return NextResponse.json({ error: `Gasto ${gastoId} no encontrado` }, { status: 400 });
      }
      if (!gasto.fields.Coordinador?.includes(coordinadorId)) {
        return NextResponse.json(
          { error: `Gasto #${gasto.fields.NumeroGasto || gastoId} no pertenece al coordinador indicado` },
          { status: 400 }
        );
      }
      if (gasto.fields.Estado !== "Aprobado") {
        return NextResponse.json(
          { error: `Gasto #${gasto.fields.NumeroGasto || gastoId} no está en estado Aprobado (está en "${gasto.fields.Estado}")` },
          { status: 400 }
        );
      }
    }

    const reembolso = await createReembolsoCajaMenor({
      coordinadorId,
      gastoIds,
      observaciones,
    });

    return NextResponse.json({ reembolso }, { status: 201 });
  } catch (error) {
    console.error("Error creating reembolso:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
