import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * GET /api/coordinadores
 * Get list of active coordinadores (excludes "Desactivado" role)
 * Admin only access
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Solo administradores pueden ver la lista completa
    if (session.user.rol !== "Administrador") {
      return NextResponse.json(
        { error: "Acceso denegado" },
        { status: 403 }
      );
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
      throw new Error("Credenciales de Airtable no configuradas");
    }

    const url = `https://api.airtable.com/v0/${baseId}/Coordinadores?filterByFormula=${encodeURIComponent("{Rol} != 'Desactivado'")}&sort[0][field]=Name&sort[0][direction]=asc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Error fetching coordinadores: ${response.status}`);
    }

    const data = await response.json();

    const coordinadores = data.records.map((record: any) => ({
      id: record.id,
      name: record.fields.Name || "Sin nombre",
      email: record.fields.Email,
      rol: record.fields.Rol, // Uppercase R to match Airtable
    }));

    return NextResponse.json({ coordinadores });
  } catch (error) {
    console.error("Error fetching coordinadores:", error);
    return NextResponse.json(
      { error: "Error al obtener coordinadores" },
      { status: 500 }
    );
  }
}
