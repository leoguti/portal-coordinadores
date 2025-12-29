import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { listKardexForCoordinator } from "@/lib/airtable";

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
