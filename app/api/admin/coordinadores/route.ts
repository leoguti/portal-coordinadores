import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/roles";
import { listAllCoordinadoresAdmin } from "@/lib/airtable";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isAdmin(session.user.rol)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }
  const items = await listAllCoordinadoresAdmin();
  return NextResponse.json({ items });
}
