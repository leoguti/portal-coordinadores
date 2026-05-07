import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import { getMetasMensualesByCoordinadorYAño } from "@/lib/airtable";

/**
 * GET /api/metas-mensuales?año=YYYY[&coordinadorId=rec...]
 *
 * Retorna 12 metas mensuales (una por mes) según el contexto:
 * - Coordinador (sin coordinadorId param): retorna SUS metas
 * - Admin/Supervisor con coordinadorId: retorna las del coordinador indicado
 * - Admin/Supervisor sin coordinadorId: retorna agregado de TODOS los coordinadores
 *
 * Cada entrada: { mes: 1..12, metaRecoleccion, metaSensibilizacion, metaEvaluaciones }
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const año = parseInt(
    searchParams.get("año") || String(new Date().getFullYear())
  );
  if (!Number.isInteger(año) || año < 2000 || año > 2100) {
    return NextResponse.json({ error: "Año inválido" }, { status: 400 });
  }
  const coordinadorIdParam = searchParams.get("coordinadorId");
  const isAdmin = isAdminOrSupervisor(session.user.rol);

  // Si es coordinador (no admin) y pidió otro coordinador → forbidden
  if (
    !isAdmin &&
    coordinadorIdParam &&
    coordinadorIdParam !== session.user.coordinatorRecordId
  ) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  // Caso 1: pidió un coordinador específico (o no es admin)
  const targetCoordinadorId =
    coordinadorIdParam || (isAdmin ? null : session.user.coordinatorRecordId);

  if (targetCoordinadorId) {
    const metas = await getMetasMensualesByCoordinadorYAño(
      targetCoordinadorId,
      año
    );
    return NextResponse.json({ año, scope: "coordinador", metas });
  }

  // Caso 2: admin sin coordinadorId → agregado de todos los coordinadores.
  // Un solo fetch del año, agregamos en JS por mes.
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return NextResponse.json({ error: "Sin credenciales" }, { status: 500 });
  }

  const aggregated = Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1,
    metaRecoleccion: 0,
    metaSensibilizacion: 0,
    metaEvaluaciones: 0,
  }));

  let offset: string | undefined;
  do {
    const params = new URLSearchParams({
      filterByFormula: `{Año} = ${año}`,
      pageSize: "100",
    });
    if (offset) params.set("offset", offset);
    const url = `https://api.airtable.com/v0/${baseId}/MetasMensuales?${params.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Error al consultar metas" },
        { status: 500 }
      );
    }
    const data = await res.json();
    for (const r of data.records || []) {
      const mes = r.fields?.Mes;
      if (typeof mes !== "number" || mes < 1 || mes > 12) continue;
      aggregated[mes - 1].metaRecoleccion += r.fields.MetaRecoleccion || 0;
      aggregated[mes - 1].metaSensibilizacion +=
        r.fields.MetaSensibilizacion || 0;
      aggregated[mes - 1].metaEvaluaciones += r.fields.MetaEvaluaciones || 0;
    }
    offset = data.offset;
  } while (offset);

  return NextResponse.json({ año, scope: "agregado", metas: aggregated });
}
