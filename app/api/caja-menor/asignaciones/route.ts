import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getSaldoInicialCajaMenor,
  updateSaldoInicialCajaMenor,
  getCoordinadoresConSaldoInicial,
} from "@/lib/airtable";

/**
 * GET /api/caja-menor/asignaciones — Listar coordinadores con saldo inicial
 * Query params:
 *   - coordinadorId: string (opcional) - Si se pasa, retorna solo el saldo de ese coordinador
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const coordinadorId = searchParams.get("coordinadorId");

    if (coordinadorId) {
      // Retornar saldo de un coordinador específico
      const saldoInicial = await getSaldoInicialCajaMenor(coordinadorId);
      return NextResponse.json({
        coordinadorId,
        saldoInicial
      });
    }

    // Admin: retornar todos los coordinadores con sus saldos
    const coordinadores = await getCoordinadoresConSaldoInicial();

    return NextResponse.json({ coordinadores });
  } catch (error) {
    console.error("Error fetching saldos iniciales:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH /api/caja-menor/asignaciones — Actualizar saldo inicial (solo admin)
 * Body: { coordinadorId: string, monto: number }
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (session.user?.rol !== "Administrador") {
      return NextResponse.json({ error: "Solo admin puede editar saldos" }, { status: 403 });
    }

    const body = await request.json();
    const { coordinadorId, monto } = body;

    if (!coordinadorId || monto === undefined) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const success = await updateSaldoInicialCajaMenor(coordinadorId, monto);

    if (!success) {
      return NextResponse.json({ error: "Error al actualizar saldo inicial" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating saldo inicial:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
