import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { listActividadesForCoordinator, listAllActividades, createActividad } from "@/lib/airtable";
import { isAdminOrSupervisor } from "@/lib/roles";

// Validar fecha para actividades pasadas (mes actual o mes anterior en período de gracia)
function esFechaValidaPasada(fecha: string): boolean {
  const fechaActividad = new Date(fecha + 'T00:00:00');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  if (fechaActividad > hoy) return false;

  const mesAnterior = new Date(hoy);
  mesAnterior.setMonth(mesAnterior.getMonth() - 1);
  const ultimoDiaMesAnterior = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth() + 1, 0);
  const fechaCierreMesAnterior = new Date(ultimoDiaMesAnterior);
  fechaCierreMesAnterior.setDate(fechaCierreMesAnterior.getDate() + 7);

  const fechaMinima = hoy <= fechaCierreMesAnterior
    ? new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1)
    : new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  return fechaActividad >= fechaMinima;
}

// Validar fecha para actividades "En curso": hoy hasta +7 días
function esFechaValidaEnCurso(fecha: string): boolean {
  const fechaActividad = new Date(fecha + 'T00:00:00');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const maxFecha = new Date(hoy);
  maxFecha.setDate(maxFecha.getDate() + 7);
  return fechaActividad >= hoy && fechaActividad <= maxFecha;
}

/**
 * GET /api/actividades
 * 
 * Returns activities for the authenticated coordinator
 * Requires active session with coordinatorRecordId
 * 
 * Response: Array of Actividad objects from Airtable
 */
export async function GET() {
  // Check authentication
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.coordinatorRecordId) {
    return NextResponse.json(
      { error: "Unauthorized: No valid session or coordinator ID" },
      { status: 401 }
    );
  }

  try {
    // Si es admin/supervisor, devolver TODAS las actividades
    const canViewAll = isAdminOrSupervisor(session.user.rol);

    const actividades = canViewAll
      ? await listAllActividades()
      : await listActividadesForCoordinator(session.user.coordinatorRecordId);

    return NextResponse.json({
      success: true,
      coordinatorRecordId: session.user.coordinatorRecordId,
      isAdmin: canViewAll,
      count: actividades.length,
      actividades,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/actividades
 * 
 * Creates a new activity for the authenticated coordinator
 * Requires active session with coordinatorRecordId
 * 
 * Body: { name, fecha, estado, descripcion? }
 * Response: Created activity object
 */
export async function POST(request: Request) {
  // Check authentication
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.coordinatorRecordId) {
    return NextResponse.json(
      { error: "Unauthorized: No valid session or coordinator ID" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, fecha, descripcion, tipo, estado, cultivo, municipioId, modalidad, perfilAsistentes, cantidadParticipantes, personasEvaluadas, observaciones } = body;

    // Validate required fields
    if (!name || !fecha || !tipo) {
      return NextResponse.json(
        { error: "Missing required fields: name, fecha, tipo" },
        { status: 400 }
      );
    }

    // Descripcion requerida solo para actividades pasadas
    if (!estado || estado !== "En curso") {
      if (!descripcion) {
        return NextResponse.json(
          { error: "Missing required field: descripcion" },
          { status: 400 }
        );
      }
    }

    // Validar fecha según estado
    if (estado === "En curso") {
      if (!esFechaValidaEnCurso(fecha)) {
        return NextResponse.json(
          { error: "La fecha debe ser hoy o hasta 7 días en el futuro." },
          { status: 400 }
        );
      }
    } else {
      if (!esFechaValidaPasada(fecha)) {
        return NextResponse.json(
          { error: "La fecha está fuera del período permitido. Solo puedes crear actividades del mes actual o del mes anterior si aún está en el período de gracia (7 días después del fin de mes)." },
          { status: 400 }
        );
      }
    }

    // Create activity in Airtable
    const newActividad = await createActividad({
      coordinatorRecordId: session.user.coordinatorRecordId,
      name,
      fecha,
      descripcion: descripcion || "",
      tipo,
      estado: estado || "Completada",
      cultivo,
      municipioId,
      modalidad,
      perfilAsistentes,
      cantidadParticipantes,
      personasEvaluadas: personasEvaluadas ? Number(personasEvaluadas) : undefined,
      observaciones,
    });

    return NextResponse.json({
      success: true,
      actividad: newActividad,
    });
  } catch (error) {
    console.error("Error creating activity:", error);
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}
