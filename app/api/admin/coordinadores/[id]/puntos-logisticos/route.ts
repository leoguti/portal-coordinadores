import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/roles";
import {
  getPuntosLogisticosByCoordinador,
  vincularPuntoLogisticoCoordinador,
} from "@/lib/airtable";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isAdmin(session.user.rol)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  const { id } = await params;
  const items = await getPuntosLogisticosByCoordinador(id);
  return NextResponse.json({ items });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isAdmin(session.user.rol)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  const { id } = await params;
  const body = await request.json();
  const puntoId = body.puntoId;
  if (typeof puntoId !== "string" || !puntoId) {
    return NextResponse.json({ error: "puntoId requerido" }, { status: 400 });
  }
  const ok = await vincularPuntoLogisticoCoordinador(puntoId, id);
  if (!ok) {
    return NextResponse.json({ error: "Error al vincular" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
