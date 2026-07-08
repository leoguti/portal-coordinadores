/**
 * POST /api/m/[token]/rechazar-cert
 *
 * Rechaza el certificado del enlace mágico de aprobación (intent
 * "aprobar-cert") con motivo obligatorio. Misma lógica que el rechazo desde
 * la bandeja (lib/certificadosDecision) + instrumentación decision_via="link".
 * Consume el token al decidir.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { consumirToken, estaConsumido } from "@/lib/edicionTokens";
import {
  rechazarCertificado,
  cargarCertPendiente,
  normalizarDispositivo,
  DecisionCertError,
} from "@/lib/certificadosDecision";
import {
  validarTokenAprobacion,
  coordIdParaDecision,
} from "@/lib/aprobarCertToken";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const v = await validarTokenAprobacion(token);
  if ("error" in v) return v.error;
  const { t } = v;

  if (estaConsumido(t)) {
    return NextResponse.json(
      { error: "Esta solicitud ya fue resuelta.", code: "RESUELTO" },
      { status: 409 }
    );
  }

  let body: { motivo?: string; dispositivo?: string };
  try {
    body = (await request.json()) as { motivo?: string; dispositivo?: string };
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

  try {
    // Invalidación (a): verifica estado vivo — 409 si ya no está pendiente.
    const rec = await cargarCertPendiente(t.recordId!);
    const coordId = coordIdParaDecision(t, rec);
    if (!coordId) {
      return NextResponse.json(
        { error: "El certificado no tiene coordinador asignado" },
        { status: 500 }
      );
    }

    await rechazarCertificado({
      rec,
      coordId,
      motivo,
      meta: {
        via: "link",
        dispositivo: normalizarDispositivo(body.dispositivo),
      },
      after,
    });

    // Invalidación (b): consumir el token — el enlace queda de un solo uso.
    await consumirToken(token);

    return NextResponse.json({ ok: true, estado: "rechazado" });
  } catch (err) {
    if (err instanceof DecisionCertError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.status === 409 ? "RESUELTO" : undefined,
        },
        { status: err.status }
      );
    }
    console.error("[m/rechazar-cert POST] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
