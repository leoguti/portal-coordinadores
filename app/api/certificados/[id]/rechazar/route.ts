/**
 * POST /api/certificados/[id]/rechazar
 *
 * Marca el cert como rechazado con motivo. No genera PDF.
 * Sprint 6 notificará al agricultor con el motivo.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isAdminOrSupervisor } from "@/lib/roles";
import { notificarCertRechazado } from "@/lib/textitNotify";

function firstStr(v: unknown): string {
  if (Array.isArray(v) && v.length > 0) return String(v[0] || "");
  if (v == null) return "";
  return String(v);
}

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

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
      { error: "Indica un motivo de rechazo (mínimo 10 caracteres)" },
      { status: 400 }
    );
  }

  // Verificar ownership.
  const r1 = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${id}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
  );
  if (!r1.ok) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const rec = await r1.json();
  if (String(rec.fields.estado) !== "pendiente") {
    return NextResponse.json(
      { error: `Estado actual: ${rec.fields.estado}` },
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
          estado: "rechazado",
          motivo_rechazo: motivo,
          fecha_rechazo: new Date().toISOString(),
          rechazado_por: [coordId],
        },
        typecast: true,
      }),
    }
  );
  if (!r2.ok) {
    return NextResponse.json(
      { error: "Error rechazando: " + (await r2.text()) },
      { status: 500 }
    );
  }
  console.log(`[certificados/${id}/rechazar] motivo="${motivo.slice(0, 60)}…"`);

  // Notificar al agricultor por WhatsApp (background — no bloquea respuesta).
  after(async () => {
    try {
      const tel = firstStr(rec.fields.movilgenerador);
      if (tel) {
        const consecutivo = Number(rec.fields.consecutivo) || undefined;
        const nombreCoord = firstStr(rec.fields.nombrecoordinador) || "Coordinador";
        const res = await notificarCertRechazado({
          telefono: tel,
          consecutivo,
          motivo,
          nombreCoordinador: nombreCoord,
        });
        console.log(`[cert/${id}/rechazar wa] ${res.ok ? "OK" : "FAIL"}: ${res.message}`);
      }
    } catch (err) {
      console.error(`[cert/${id}/rechazar wa] Error:`, err);
    }
  });

  return NextResponse.json({ ok: true, estado: "rechazado" });
}
