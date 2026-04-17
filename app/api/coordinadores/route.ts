import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";

/**
 * GET /api/coordinadores
 * - Default: all active (excludes "Desactivado")
 * - ?onlyCoordinadores=true: only role "Coordinador" (for reassignment dropdown)
 * Any authenticated user can list; sensitive fields are not exposed.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.coordinatorRecordId) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
      throw new Error("Credenciales de Airtable no configuradas");
    }

    const onlyCoordinadores = req.nextUrl.searchParams.get("onlyCoordinadores") === "true";
    // Si no es admin/supervisor, fuerza solo Coordinadores
    const effectiveOnlyCoord = onlyCoordinadores || !isAdminOrSupervisor(session.user.rol);
    const formula = effectiveOnlyCoord
      ? "{Rol} = 'Coordinador'"
      : "{Rol} != 'Desactivado'";

    const url = `https://api.airtable.com/v0/${baseId}/Coordinadores?filterByFormula=${encodeURIComponent(formula)}&sort[0][field]=Name&sort[0][direction]=asc`;

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
      email: record.fields.email,
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
