import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/roles";
import {
  TABLA_DOCUMENTOS,
  TipoDocumento,
  calcularVencimiento,
} from "@/lib/documentosTerceros";

const KEY = process.env.AIRTABLE_API_KEY!;
const BASE = process.env.AIRTABLE_BASE_ID!;

/**
 * PATCH /api/documentos-terceros/[id]
 *
 * Decisión administrativa sobre un documento (SOLO rol Administrador):
 *   { accion: "aprobar" | "rechazar", motivo?, fechaExpedicion? }
 *
 * - rechazar exige motivo (el coordinador lo ve y sube versión corregida).
 * - fechaExpedicion (YYYY-MM-DD) opcional al aprobar: corrige/llena la fecha
 *   del documento y recalcula el vencimiento.
 * - No existe DELETE: los documentos no se borran nunca.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!isAdmin(session.user.rol)) {
    return NextResponse.json(
      { error: "Solo los administradores pueden aprobar o rechazar documentos" },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!/^rec[a-zA-Z0-9]{14}$/.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  let body: { accion?: string; motivo?: string; fechaExpedicion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const accion = body.accion;
  if (accion !== "aprobar" && accion !== "rechazar") {
    return NextResponse.json(
      { error: "accion debe ser 'aprobar' o 'rechazar'" },
      { status: 400 }
    );
  }
  const motivo = String(body.motivo || "").trim();
  if (accion === "rechazar" && !motivo) {
    return NextResponse.json(
      { error: "El rechazo requiere un motivo (el coordinador lo verá)" },
      { status: 400 }
    );
  }
  const fechaExpedicion = String(body.fechaExpedicion || "").trim() || null;
  if (fechaExpedicion && !/^\d{4}-\d{2}-\d{2}$/.test(fechaExpedicion)) {
    return NextResponse.json(
      { error: "fechaExpedicion debe ser YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // Documento actual (para el tipo → vencimiento).
  const getRes = await fetch(
    `https://api.airtable.com/v0/${BASE}/${TABLA_DOCUMENTOS}/${id}`,
    { headers: { Authorization: `Bearer ${KEY}` }, cache: "no-store" }
  );
  if (!getRes.ok) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }
  const rec = await getRes.json();
  const tipo = (rec.fields?.tipo || "Otro") as TipoDocumento;

  const fields: Record<string, unknown> = {
    estado: accion === "aprobar" ? "aprobado" : "rechazado",
    aprobado_por: [session.user.coordinatorRecordId],
    fecha_decision: new Date().toISOString(),
    motivo_rechazo: accion === "rechazar" ? motivo : "",
  };
  if (fechaExpedicion) {
    fields.fecha_expedicion = fechaExpedicion;
    const vence = calcularVencimiento(tipo, fechaExpedicion);
    fields.vence_el = vence || null;
  }

  const patchRes = await fetch(
    `https://api.airtable.com/v0/${BASE}/${TABLA_DOCUMENTOS}/${id}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields, typecast: true }),
    }
  );
  if (!patchRes.ok) {
    const t = await patchRes.text();
    console.error("[documentos-terceros/id] PATCH falló:", t);
    return NextResponse.json({ error: "Error guardando la decisión" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, estado: fields.estado });
}
