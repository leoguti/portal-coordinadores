import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { listKardexForCoordinator, createKardex } from "@/lib/airtable";

/**
 * GET /api/kardex
 * Get all kardex records for the authenticated coordinator
 */
export async function GET() {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);

    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Fetch all kardex for this coordinator
    const kardexRecords = await listKardexForCoordinator(session.user.coordinatorRecordId);

    return NextResponse.json({ kardex: kardexRecords });
  } catch (error) {
    console.error("Error fetching kardex:", error);
    return NextResponse.json(
      { error: "Error al obtener movimientos de kardex" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kardex
 * Create a new kardex record for the authenticated coordinator
 */
export async function POST(request: Request) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);

    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.fechakardex || !body.TipoMovimiento || !body.EstadoPago) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 }
      );
    }

    // Create kardex record
    const newKardex = await createKardex(session.user.coordinatorRecordId, {
      fechakardex: body.fechakardex,
      TipoMovimiento: body.TipoMovimiento,
      EstadoPago: body.EstadoPago,
      MunicipioOrigen: body.MunicipioOrigen,
      CentroAcopio: body.CentroAcopio,
      Gestor: body.Gestor,
      Reciclaje: body.Reciclaje,
      Incineracion: body.Incineracion,
      Flexibles: body.Flexibles,
      PlasticoContaminado: body.PlasticoContaminado,
      Lonas: body.Lonas,
      Carton: body.Carton,
      Metal: body.Metal,
    });

    if (!newKardex) {
      return NextResponse.json(
        { error: "Error al crear movimiento de kardex" },
        { status: 500 }
      );
    }

    return NextResponse.json({ kardex: newKardex }, { status: 201 });
  } catch (error) {
    console.error("Error creating kardex:", error);
    return NextResponse.json(
      { error: "Error al crear movimiento de kardex" },
      { status: 500 }
    );
  }
}
