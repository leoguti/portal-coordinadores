import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { listActividadesForCoordinator, createActividad } from "@/lib/airtable";

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
    // Fetch activities from Airtable for this coordinator
    const actividades = await listActividadesForCoordinator(
      session.user.coordinatorRecordId
    );

    return NextResponse.json({
      success: true,
      coordinatorRecordId: session.user.coordinatorRecordId,
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
    const { name, fecha, descripcion, tipo, cultivo, municipioId, modalidad, perfilAsistentes, cantidadParticipantes, observaciones } = body;

    // Validate required fields (municipio y cultivo son condicionales)
    if (!name || !fecha || !descripcion || !tipo) {
      return NextResponse.json(
        { error: "Missing required fields: name, fecha, descripcion, tipo" },
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
