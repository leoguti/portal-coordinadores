import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createGastoCajaMenor, getGastosCajaMenorCoordinador, getAllGastosCajaMenor } from "@/lib/airtable";
import { puedeModificarFecha } from "@/lib/dateValidations";
import { isAdminOrSupervisor } from "@/lib/roles";

/**
 * GET /api/caja-menor — Listar gastos de caja menor
 * Admin/Supervisor: todos. Coordinador: los suyos.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const canViewAll = isAdminOrSupervisor(session.user?.rol);
    let gastos;

    if (canViewAll) {
      gastos = await getAllGastosCajaMenor();
    } else {
      gastos = await getGastosCajaMenorCoordinador(session.user.coordinatorRecordId);
    }

    return NextResponse.json({ gastos });
  } catch (error) {
    console.error("Error fetching gastos:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * POST /api/caja-menor — Crear nuevo gasto de caja menor
 * Body: { fecha, beneficiarioId, concepto, valor, porcentajeRetencion, facturaUrl? }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const { fecha, beneficiarioId, concepto, valor, porcentajeRetencion, facturaUrl, kardexIds } = body;

    // Validaciones
    if (!fecha || !beneficiarioId || !concepto || valor === undefined) {
      return NextResponse.json({ error: "Faltan campos requeridos (fecha, beneficiarioId, concepto, valor)" }, { status: 400 });
    }

    // Validar regla de 7 dias
    if (!puedeModificarFecha(fecha)) {
      return NextResponse.json({ error: "La fecha esta fuera del periodo permitido (regla 7 dias)" }, { status: 400 });
    }

    if (valor <= 0) {
      return NextResponse.json({ error: "El valor debe ser mayor a 0" }, { status: 400 });
    }

    const gasto = await createGastoCajaMenor({
      coordinatorRecordId: session.user.coordinatorRecordId,
      fecha,
      beneficiarioId,
      concepto,
      valor,
      porcentajeRetencion: porcentajeRetencion || 0,
      facturaUrl,
      kardexIds: Array.isArray(kardexIds) ? kardexIds : undefined,
    });

    if (!gasto) {
      return NextResponse.json({ error: "Error al crear el gasto" }, { status: 500 });
    }

    return NextResponse.json({ gasto }, { status: 201 });
  } catch (error) {
    console.error("Error creating gasto:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
