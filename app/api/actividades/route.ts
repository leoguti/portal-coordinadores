import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { listActividadesForCoordinator, listAllActividades, createActividad } from "@/lib/airtable";
import { isAdminOrSupervisor } from "@/lib/roles";

// Función auxiliar para validar fecha dentro del período de gracia
function esFechaValida(fecha: string): boolean {
  const fechaActividad = new Date(fecha + 'T00:00:00');
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  // No permitir fechas futuras
  if (fechaActividad > hoy) {
    return false;
  }
  
  // Calcular mes anterior
  const mesAnterior = new Date(hoy);
  mesAnterior.setMonth(mesAnterior.getMonth() - 1);
  
  // Último día del mes anterior
  const ultimoDiaMesAnterior = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth() + 1, 0);
  
  // Fecha de cierre del mes anterior (último día + 7)
  const fechaCierreMesAnterior = new Date(ultimoDiaMesAnterior);
  fechaCierreMesAnterior.setDate(fechaCierreMesAnterior.getDate() + 7);
  
  // Determinar fecha mínima permitida
  let fechaMinima: Date;
  if (hoy <= fechaCierreMesAnterior) {
    // Mes anterior aún está abierto
    fechaMinima = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1);
  } else {
    // Solo mes actual permitido
    fechaMinima = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }
  
  return fechaActividad >= fechaMinima;
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
    const { name, fecha, descripcion, tipo, cultivo, municipioId, modalidad, perfilAsistentes, cantidadParticipantes, personasEvaluadas, observaciones } = body;

    // Validate required fields (municipio y cultivo son condicionales)
    if (!name || !fecha || !descripcion || !tipo) {
      return NextResponse.json(
        { error: "Missing required fields: name, fecha, descripcion, tipo" },
        { status: 400 }
      );
    }

    // Validar que la fecha esté dentro del período permitido
    if (!esFechaValida(fecha)) {
      return NextResponse.json(
        { error: "La fecha está fuera del período permitido. Solo puedes crear actividades del mes actual o del mes anterior si aún está en el período de gracia (7 días después del fin de mes)." },
        { status: 400 }
      );
    }

    // Create activity in Airtable
    const newActividad = await createActividad({
      coordinatorRecordId: session.user.coordinatorRecordId,
      name,
      fecha,
      descripcion,
      tipo,
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
