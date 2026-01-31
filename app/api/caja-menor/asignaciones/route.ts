import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getAsignacionesCajaMenor,
  createAsignacionCajaMenor,
  updateAsignacionCajaMenor,
} from "@/lib/airtable";

/**
 * GET /api/caja-menor/asignaciones — Listar asignaciones (anticipo fijo)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const asignaciones = await getAsignacionesCajaMenor();

    return NextResponse.json({ asignaciones });
  } catch (error) {
    console.error("Error fetching asignaciones:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/caja-menor/asignaciones — Crear asignacion (solo admin)
 * Body: { coordinadorId: string, monto: number }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (session.user?.rol !== "Administrador") {
      return NextResponse.json({ error: "Solo admin puede asignar montos" }, { status: 403 });
    }

    const body = await request.json();
    const { coordinadorId, monto } = body;

    if (!coordinadorId || monto === undefined) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const asignacion = await createAsignacionCajaMenor(coordinadorId, monto);

    return NextResponse.json({ asignacion }, { status: 201 });
  } catch (error) {
    console.error("Error creating asignacion:", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/caja-menor/asignaciones — Actualizar monto de asignacion (solo admin)
 * Body: { asignacionId: string, monto: number }
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (session.user?.rol !== "Administrador") {
      return NextResponse.json({ error: "Solo admin puede editar montos" }, { status: 403 });
    }

    const body = await request.json();
    const { asignacionId, monto } = body;

    if (!asignacionId || monto === undefined) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const success = await updateAsignacionCajaMenor(asignacionId, monto);

    if (!success) {
      return NextResponse.json({ error: "Error al actualizar asignación" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating asignacion:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
