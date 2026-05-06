import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/roles";
import {
  getMetasMensualesByCoordinadorYAño,
  upsertMetasMensuales,
} from "@/lib/airtable";

export async function GET(
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
  const { searchParams } = new URL(request.url);
  const año = parseInt(searchParams.get("año") || String(new Date().getFullYear()));
  const metas = await getMetasMensualesByCoordinadorYAño(id, año);
  return NextResponse.json({ año, metas });
}

export async function PUT(
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
  const año = parseInt(body.año);
  const metas = body.metas;
  if (!Number.isInteger(año) || año < 2000 || año > 2100) {
    return NextResponse.json({ error: "Año inválido" }, { status: 400 });
  }
  if (!Array.isArray(metas)) {
    return NextResponse.json({ error: "metas debe ser array" }, { status: 400 });
  }
  for (const m of metas) {
    if (!Number.isInteger(m.mes) || m.mes < 1 || m.mes > 12) {
      return NextResponse.json({ error: "Mes inválido" }, { status: 400 });
    }
    for (const k of ["metaRecoleccion", "metaSensibilizacion", "metaEvaluaciones"]) {
      const v = m[k];
      if (typeof v !== "number" || v < 0 || !Number.isFinite(v)) {
        return NextResponse.json({ error: `Valor inválido en ${k}` }, { status: 400 });
      }
    }
  }
  const result = await upsertMetasMensuales(id, año, metas);
  if (!result.ok) {
    return NextResponse.json({ error: "Error al guardar", ...result }, { status: 500 });
  }
  return NextResponse.json(result);
}
