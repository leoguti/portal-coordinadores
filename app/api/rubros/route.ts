import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getRubros } from "@/lib/airtable";

/**
 * GET /api/rubros — Listar rubros activos
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const rubros = await getRubros();
    return NextResponse.json({ rubros });
  } catch (error) {
    console.error("Error fetching rubros:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
