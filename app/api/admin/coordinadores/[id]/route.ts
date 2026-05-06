import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/roles";
import {
  getCoordinadorAdminById,
  updateCoordinadorAdmin,
} from "@/lib/airtable";

const ROLES_VALIDOS = ["Coordinador", "Administrador", "Supervisor", "Desactivado"];

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
  const coord = await getCoordinadorAdminById(id);
  if (!coord) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json(coord);
}

export async function PATCH(
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
  const fields: Record<string, string> = {};
  if (typeof body.name === "string") fields.Name = body.name.trim();
  if (typeof body.email === "string") fields.email = body.email.trim();
  if (typeof body.telefono === "string") fields.telefono = body.telefono.trim();
  if (typeof body.rol === "string") {
    if (!ROLES_VALIDOS.includes(body.rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }
    fields.Rol = body.rol;
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }
  const ok = await updateCoordinadorAdmin(id, fields);
  if (!ok) {
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
