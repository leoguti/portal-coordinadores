import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getKardexByIds } from "@/lib/airtable";

/**
 * GET /api/kardex/por-ids?ids=id1,id2,... — Obtener Kardex por IDs
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.coordinatorRecordId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return NextResponse.json({ error: "Parametro ids requerido" }, { status: 400 });
    }

    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ kardex: [] });
    }

    const kardex = await getKardexByIds(ids);
    return NextResponse.json({ kardex });
  } catch (error) {
    console.error("Error fetching Kardex por IDs:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
