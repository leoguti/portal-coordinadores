import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getKardexCajaMenorDisponibles } from "@/lib/airtable";

/**
 * GET /api/kardex/caja-menor — Kardex con EstadoPago="Caja Menor" no vinculados a un gasto
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const kardex = await getKardexCajaMenorDisponibles(
      session.user.coordinatorRecordId
    );

    return NextResponse.json({ kardex });
  } catch (error) {
    console.error("Error fetching Kardex Caja Menor:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
