import { NextRequest, NextResponse } from "next/server";
import { datosParaReenvio, enmascararEmail } from "@/lib/certificadosVerificacion";
import { sendCertificadoEmail } from "@/lib/sendCertificadoEmail";

export const maxDuration = 60;

/**
 * POST /api/certificados/reenviar — reenvía el PDF oficial al CORREO
 * REGISTRADO del generador. Público (vive en la página /v/<token>), pero:
 *  - el destino lo decide el servidor (el correo del registro, jamás uno
 *    que envíe el cliente) — el PDF completo solo viaja a donde ya viajó;
 *  - el visitante solo ve el correo enmascarado;
 *  - rate limit: 3 reenvíos por token por hora (más un tope por IP).
 */

const porToken = new Map<string, { n: number; desde: number }>();
const porIp = new Map<string, { n: number; desde: number }>();
const HORA_MS = 60 * 60 * 1000;

function limitOk(map: Map<string, { n: number; desde: number }>, key: string, max: number): boolean {
  const ahora = Date.now();
  const e = map.get(key);
  if (!e || ahora - e.desde > HORA_MS) {
    map.set(key, { n: 1, desde: ahora });
    return true;
  }
  e.n++;
  return e.n <= max;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";

  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const token = String(body.token || "");
  if (!/^[0-9a-f]{32}$/.test(token)) {
    return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  }
  if (!limitOk(porToken, token, 3) || !limitOk(porIp, ip, 10)) {
    return NextResponse.json(
      { error: "Se alcanzó el límite de reenvíos. Intente de nuevo en una hora." },
      { status: 429 }
    );
  }

  try {
    const datos = await datosParaReenvio(token);
    if (!datos) {
      return NextResponse.json({ error: "Certificado no encontrado" }, { status: 404 });
    }
    if (datos.anulado) {
      return NextResponse.json(
        { error: "Este certificado está anulado; no se reenvía" },
        { status: 400 }
      );
    }
    if (!datos.email) {
      return NextResponse.json({
        ok: false,
        motivo: "sin_correo",
        mensaje:
          "Este certificado no tiene un correo registrado. El generador puede pedirlo escribiendo al WhatsApp de CampoLimpio desde su número registrado.",
      });
    }
    if (!datos.r2Url) {
      return NextResponse.json(
        { error: "El PDF de este certificado no está disponible para reenvío" },
        { status: 404 }
      );
    }

    const pdfRes = await fetch(datos.r2Url);
    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: "No se pudo recuperar el PDF. Intente más tarde." },
        { status: 502 }
      );
    }
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    const envio = await sendCertificadoEmail({
      consecutivo: datos.consecutivo,
      pdfBuffer,
      emails: [datos.email],
    });
    if (!envio.success) {
      return NextResponse.json({ error: "No se pudo enviar el correo. Intente más tarde." }, { status: 502 });
    }

    console.log(`[reenviar] cert #${datos.consecutivo} reenviado al correo registrado (ip ${ip})`);
    return NextResponse.json({ ok: true, email: enmascararEmail(datos.email) });
  } catch (err) {
    console.error("[reenviar] error:", err);
    return NextResponse.json({ error: "Error temporal. Intente de nuevo." }, { status: 500 });
  }
}
