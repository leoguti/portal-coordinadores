/**
 * POST /api/certificados/[id]/reenviar
 *
 * Reenvía el PDF de un certificado ya aprobado a su lista de destinatarios
 * (admin + tú + email del agricultor + email del coordinador). Permite
 * sobrescribir el destinatario del agricultor pasando `emailOverride` para
 * casos donde el email registrado era erróneo.
 *
 * No regenera el PDF — descarga el adjunto actual de Airtable y lo reenvía
 * tal cual. Si el cert no tiene adjunto (caso raro), responde 404.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import { sendCertificadoEmail } from "@/lib/sendCertificadoEmail";

export const maxDuration = 60;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

function firstStr(v: unknown): string {
  if (Array.isArray(v) && v.length > 0) return String(v[0] || "");
  if (v == null) return "";
  return String(v);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const isAdmin = isAdminOrSupervisor(session.user.rol);
  const coordId = session.user.coordinatorRecordId;

  let body: { emailOverride?: string } = {};
  try {
    body = (await request.json()) as { emailOverride?: string };
  } catch {
    body = {};
  }
  const emailOverride = (body.emailOverride || "").trim();

  // 1. Cargar cert
  const r1 = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${id}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
  );
  if (!r1.ok) {
    return NextResponse.json({ error: "Certificado no encontrado" }, { status: 404 });
  }
  const rec = await r1.json();
  const f = rec.fields as Record<string, unknown>;
  // BLANK se considera aprobado (legado pre-V4).
  const estado = f.estado ? String(f.estado) : "aprobado";
  if (estado !== "aprobado") {
    return NextResponse.json(
      { error: `Solo se pueden reenviar certs aprobados (estado actual: ${estado})` },
      { status: 409 }
    );
  }

  // Ownership: si es coord, solo sus certs
  const certCoordIds = Array.isArray(f.id_coordinador)
    ? (f.id_coordinador as string[])
    : [];
  if (!isAdmin && !certCoordIds.includes(coordId)) {
    return NextResponse.json({ error: "Este cert no es tuyo" }, { status: 403 });
  }

  // 2. Localizar el PDF (campo certificadopdf)
  const attachments = Array.isArray(f.certificadopdf)
    ? (f.certificadopdf as Array<{ url?: string; filename?: string }>)
    : [];
  const pdfAttachment = attachments[0];
  if (!pdfAttachment?.url) {
    return NextResponse.json(
      { error: "Este certificado no tiene PDF adjunto" },
      { status: 404 }
    );
  }

  // 3. Descargar el PDF
  const pdfRes = await fetch(pdfAttachment.url);
  if (!pdfRes.ok) {
    return NextResponse.json(
      { error: "No se pudo descargar el PDF original" },
      { status: 502 }
    );
  }
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  // 4. Armar destinatarios
  const consecutivo = Number(f.consecutivo) || 0;
  const emailAgricultor = emailOverride || firstStr(f.emailgenerador);
  const emailCoord = firstStr(f.emailcoordinador);
  const recipients = [
    "certificados@campolimpio.org",
    "leogiga@gmail.com",
    emailAgricultor,
    emailCoord,
  ].filter(Boolean);

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No hay destinatarios para enviar" },
      { status: 422 }
    );
  }

  try {
    const result = await sendCertificadoEmail({
      consecutivo,
      pdfBuffer,
      emails: recipients,
    });
    console.log(
      `[cert/${id}/reenviar] consecutivo=${consecutivo} → ${recipients.join(", ")} (${result.message})`
    );

    // 5. Guardar timestamp en Airtable (best-effort, no bloquea).
    fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            ultimo_envio_email_at: new Date().toISOString(),
            ultimo_envio_email_to: recipients.join(", "),
            ultimo_envio_email_status: "sent",
          },
          typecast: true,
        }),
      }
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      destinatarios: recipients,
      emailAgricultor,
    });
  } catch (err) {
    console.error(`[cert/${id}/reenviar] Error:`, err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error reenviando el email",
      },
      { status: 500 }
    );
  }
}
