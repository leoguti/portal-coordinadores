import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/roles";
import { desvincularPuntoLogisticoCoordinador } from "@/lib/airtable";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; puntoId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isAdmin(session.user.rol)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  const { id, puntoId } = await params;
  const ok = await desvincularPuntoLogisticoCoordinador(puntoId, id);
  if (!ok) {
    return NextResponse.json({ error: "Error al desvincular" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
