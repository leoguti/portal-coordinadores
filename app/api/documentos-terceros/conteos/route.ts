import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/roles";
import { listarTodosDocumentos } from "@/lib/documentosTerceros";

/**
 * GET /api/documentos-terceros/conteos — conteo liviano para el badge del
 * botón "Revisión de documentos" (solo administradores).
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId || !isAdmin(session.user.rol)) {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }
  try {
    const docs = await listarTodosDocumentos();
    return NextResponse.json({
      pendientes: docs.filter((d) => d.estado === "pendiente").length,
      conAlerta: docs.filter((d) => d.estado === "pendiente" && d.verificacionIa).length,
    });
  } catch {
    return NextResponse.json({ pendientes: 0, conAlerta: 0 });
  }
}
