import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdmin } from "@/lib/roles";
import {
  TABLA_DOCUMENTOS,
  TIPOS_DOCUMENTO,
  TipoDocumento,
  calcularVencimiento,
  listarDocumentosTercero,
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

  let body: { accion?: string; motivo?: string; fechaExpedicion?: string; nuevoTipo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const accion = body.accion;
  if (accion !== "aprobar" && accion !== "rechazar" && accion !== "reclasificar") {
    return NextResponse.json(
      { error: "accion debe ser 'aprobar', 'rechazar' o 'reclasificar'" },
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

  // ── Reclasificar: el documento estaba mal tipificado (ej. subieron el RUT
  //    en la casilla de la cédula). Se corrige el tipo sin rechazar ni
  //    reenviar al coordinador; el documento se renumera en el tipo destino.
  if (accion === "reclasificar") {
    const nuevoTipo = String(body.nuevoTipo || "").trim() as TipoDocumento;
    if (!TIPOS_DOCUMENTO.includes(nuevoTipo)) {
      return NextResponse.json({ error: `Tipo inválido: ${nuevoTipo}` }, { status: 400 });
    }
    if (nuevoTipo === tipo) {
      return NextResponse.json({ error: "El documento ya es de ese tipo" }, { status: 400 });
    }
    const terceroId: string | null = rec.fields?.tercero?.[0] || null;
    if (!terceroId) {
      return NextResponse.json({ error: "Documento sin tercero" }, { status: 400 });
    }
    const hermanos = await listarDocumentosTercero(terceroId);
    const enDestino = hermanos.filter((d) => d.tipo === nuevoTipo);
    const nuevaVersion = enDestino.reduce((m, d) => Math.max(m, d.version), 0) + 1;
    const eraVigente = Boolean(rec.fields?.vigente);

    const patch = async (recId: string, f: Record<string, unknown>) =>
      fetch(`https://api.airtable.com/v0/${BASE}/${TABLA_DOCUMENTOS}/${recId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fields: f, typecast: true }),
      });

    // El vigente del tipo destino deja de serlo (llega versión más nueva).
    for (const d of enDestino.filter((d) => d.vigente)) {
      await patch(d.id, { vigente: false });
    }
    // Si este documento era el vigente de su tipo original, el más reciente
    // que quede ahí recupera la vigencia.
    if (eraVigente) {
      const restantes = hermanos
        .filter((d) => d.tipo === tipo && d.id !== id)
        .sort((a, b) => b.version - a.version);
      if (restantes[0]) await patch(restantes[0].id, { vigente: true });
    }

    const nombreViejo = String(rec.fields?.nombre || "");
    const nombreNuevo = nombreViejo.includes("·")
      ? `${nuevoTipo} v${nuevaVersion} ·${nombreViejo.split("·").slice(1).join("·")}`
      : `${nuevoTipo} v${nuevaVersion}`;
    const vence = calcularVencimiento(nuevoTipo, rec.fields?.fecha_expedicion || null);
    const res = await patch(id, {
      tipo: nuevoTipo,
      version: nuevaVersion,
      vigente: true,
      nombre: nombreNuevo.slice(0, 250),
      vence_el: vence || null,
    });
    if (!res.ok) {
      console.error("[documentos-terceros/id] reclasificar falló:", await res.text());
      return NextResponse.json({ error: "Error reclasificando" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, tipo: nuevoTipo, version: nuevaVersion });
  }

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
