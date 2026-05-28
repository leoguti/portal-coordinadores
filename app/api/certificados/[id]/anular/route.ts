/**
 * POST /api/certificados/[id]/anular
 *
 * Marca un cert YA APROBADO como anulado. Mantiene el consecutivo (no se
 * libera) para auditoría: queda un hueco con marca clara de anulación.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import { sendCertificadoAnuladoEmail } from "@/lib/sendCertificadoAnuladoEmail";

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

  let body: { motivo?: string };
  try {
    body = (await request.json()) as { motivo?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const motivo = (body.motivo || "").trim();
  if (motivo.length < 10) {
    return NextResponse.json(
      { error: "Indica un motivo de anulación (mínimo 10 caracteres)" },
      { status: 400 }
    );
  }

  const r1 = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${id}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
  );
  if (!r1.ok) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const rec = await r1.json();
  if (String(rec.fields.estado) !== "aprobado") {
    return NextResponse.json(
      { error: `Solo se pueden anular certs aprobados. Estado actual: ${rec.fields.estado}` },
      { status: 409 }
    );
  }
  const certCoordIds = Array.isArray(rec.fields.id_coordinador)
    ? (rec.fields.id_coordinador as string[])
    : [];
  if (!isAdmin && !certCoordIds.includes(coordId)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const r2 = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${id}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          estado: "anulado",
          motivo_anulacion: motivo,
          fecha_anulacion: new Date().toISOString(),
          anulado_por: [coordId],
        },
        typecast: true,
      }),
    }
  );
  if (!r2.ok) {
    return NextResponse.json(
      { error: "Error anulando: " + (await r2.text()) },
      { status: 500 }
    );
  }
  console.log(`[certificados/${id}/anular] motivo="${motivo.slice(0, 60)}…"`);

  // Notificar a agricultor + coord + auditoría (background — no bloquea respuesta).
  after(async () => {
    try {
      const consecutivo = Number(rec.fields.consecutivo) || 0;
      const emailGen = firstStr(rec.fields.emailgenerador);
      const emailCoord = firstStr(rec.fields.emailcoordinador);
      const nombreCoord = firstStr(rec.fields.nombrecoordinador);
      const nombreGen = firstStr(rec.fields.nombregenerador);
      const fechaDev = String(rec.fields.fechadevolucion || "");
      const totalKg = Number(rec.fields.total) || 0;
      const res = await sendCertificadoAnuladoEmail({
        consecutivo,
        motivo,
        emailsAgricultor: emailGen ? [emailGen] : [],
        emailCoordinador: emailCoord,
        nombreCoordinador: nombreCoord || "Coordinador",
        nombreGenerador: nombreGen || "(sin nombre)",
        fechaDevolucion: fechaDev,
        totalKg,
      });
      console.log(`[cert/${id}/anular email] ${res.ok ? "OK" : "FAIL"}: ${res.message}`);
    } catch (err) {
      console.error(`[cert/${id}/anular email] Error:`, err);
    }
  });

  return NextResponse.json({ ok: true, estado: "anulado" });
}
