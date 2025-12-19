import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/actividades/[id]
 * 
 * Obtiene una actividad específica
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.coordinatorRecordId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return NextResponse.json(
      { error: "Airtable not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `https://api.airtable.com/v0/${baseId}/Actividades/${id}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Actividad no encontrada" },
          { status: 404 }
        );
      }
      throw new Error(`Error fetching activity: ${response.status}`);
    }

    const actividad = await response.json();
    const coordinadores = actividad.fields?.Coordinador || [];

    // Verificar que el coordinador actual es dueño de esta actividad
    if (!coordinadores.includes(session.user.coordinatorRecordId)) {
      return NextResponse.json(
        { error: "No tienes permiso para ver esta actividad" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, actividad });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/actividades/[id]
 * 
 * Actualiza una actividad existente
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.coordinatorRecordId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return NextResponse.json(
      { error: "Airtable not configured" },
      { status: 500 }
    );
  }

  try {
    // Primero verificamos que la actividad pertenece al coordinador
    const checkUrl = `https://api.airtable.com/v0/${baseId}/Actividades/${id}`;
    const checkResponse = await fetch(checkUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!checkResponse.ok) {
      if (checkResponse.status === 404) {
        return NextResponse.json(
          { error: "Actividad no encontrada" },
          { status: 404 }
        );
      }
      throw new Error(`Error fetching activity: ${checkResponse.status}`);
    }

    const existingActividad = await checkResponse.json();
    const coordinadores = existingActividad.fields?.Coordinador || [];

    if (!coordinadores.includes(session.user.coordinatorRecordId)) {
      return NextResponse.json(
        { error: "No tienes permiso para editar esta actividad" },
        { status: 403 }
      );
    }

    // Obtener datos del body
    const body = await request.json();
    const { 
      name, 
      fecha, 
      descripcion, 
      tipo, 
      cultivo, 
      municipioId, 
      modalidad, 
      perfilAsistentes, 
      cantidadParticipantes, 
      observaciones 
    } = body;

    // Construir payload de actualización
    const fields: Record<string, unknown> = {};
    
    if (name !== undefined) fields["Nombre de la Actividad"] = name;
    if (fecha !== undefined) fields["Fecha"] = fecha;
    if (descripcion !== undefined) fields["Descripcion"] = descripcion;
    if (tipo !== undefined) fields["Tipo"] = tipo;
    if (cultivo !== undefined) fields["Cultivo"] = cultivo || null;
    if (municipioId !== undefined) fields["Municipio"] = municipioId ? [municipioId] : [];
    if (modalidad !== undefined) fields["Modalidad"] = modalidad || [];
    if (perfilAsistentes !== undefined) fields["Perfil de Asistentes"] = perfilAsistentes || null;
    if (cantidadParticipantes !== undefined) fields["Cantidad de Participantes"] = cantidadParticipantes || null;
    if (observaciones !== undefined) fields["Observaciones"] = observaciones || null;

    // Actualizar en Airtable
    const updateUrl = `https://api.airtable.com/v0/${baseId}/Actividades/${id}`;
    const updateResponse = await fetch(updateUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`Error updating activity: ${updateResponse.status}`, errorText);
      throw new Error(`Failed to update activity: ${updateResponse.status}`);
    }

    const updatedActividad = await updateResponse.json();
    console.log(`Activity updated: ${id}`);

    return NextResponse.json({
      success: true,
      actividad: updatedActividad,
    });
  } catch (error) {
    console.error("Error updating activity:", error);
    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/actividades/[id]
 * 
 * Elimina una actividad de Airtable
 * Verifica que la actividad pertenezca al coordinador autenticado
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.coordinatorRecordId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    return NextResponse.json(
      { error: "Airtable not configured" },
      { status: 500 }
    );
  }

  try {
    // Primero verificamos que la actividad pertenece al coordinador
    const checkUrl = `https://api.airtable.com/v0/${baseId}/Actividades/${id}`;
    const checkResponse = await fetch(checkUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!checkResponse.ok) {
      if (checkResponse.status === 404) {
        return NextResponse.json(
          { error: "Actividad no encontrada" },
          { status: 404 }
        );
      }
      throw new Error(`Error fetching activity: ${checkResponse.status}`);
    }

    const actividad = await checkResponse.json();
    const coordinadores = actividad.fields?.Coordinador || [];

    // Verificar que el coordinador actual es dueño de esta actividad
    if (!coordinadores.includes(session.user.coordinatorRecordId)) {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar esta actividad" },
        { status: 403 }
      );
    }

    // Eliminar la actividad
    const deleteUrl = `https://api.airtable.com/v0/${baseId}/Actividades/${id}`;
    const deleteResponse = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.error(`Error deleting activity: ${deleteResponse.status}`, errorText);
      throw new Error(`Failed to delete activity: ${deleteResponse.status}`);
    }

    const result = await deleteResponse.json();
    console.log(`Activity deleted: ${id}`);

    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      id: result.id,
    });
  } catch (error) {
    console.error("Error deleting activity:", error);
    return NextResponse.json(
      { error: "Failed to delete activity" },
      { status: 500 }
    );
  }
}
