import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getAsignacionesCajaMenor,
  createAsignacionCajaMenor,
} from "@/lib/airtable";

/**
 * GET /api/caja-menor/asignaciones — Listar asignaciones (filtro por mes)
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mes = searchParams.get("mes") || undefined;

    const asignaciones = await getAsignacionesCajaMenor(mes);

    return NextResponse.json({ asignaciones });
  } catch (error) {
    console.error("Error fetching asignaciones:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/caja-menor/asignaciones — Crear asignacion (solo admin)
 * Body: { coordinadorId: string, mes: string, monto: number }
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
    const { coordinadorId, mes, monto } = body;

    if (!coordinadorId || !mes || monto === undefined) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    const asignacion = await createAsignacionCajaMenor(coordinadorId, mes, monto);

    if (!asignacion) {
      return NextResponse.json({ error: "Error al crear asignacion" }, { status: 500 });
    }

    return NextResponse.json({ asignacion }, { status: 201 });
  } catch (error) {
    console.error("Error creating asignacion:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
