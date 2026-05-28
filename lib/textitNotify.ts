/**
 * Helper para mandar mensajes de WhatsApp al agricultor fuera de flow,
 * vía la API de TextIt (`POST /api/v2/broadcasts.json`).
 *
 * Lo usan los endpoints /aprobar, /rechazar, /anular para avisar al
 * agricultor el resultado de su solicitud. Falla silencioso (loggea pero
 * no rompe) — la notificación es nice-to-have, no debe bloquear la acción
 * principal.
 *
 * Configuración:
 *   TEXTIT_API_TOKEN   — bearer de la cuenta de TextIt
 *   TEXTIT_API_URL     — default https://textit.com/api/v2
 *   TEXTIT_CHANNEL_UUID (opcional) — para forzar canal específico
 *                                    (WhatsApp Business vs Telegram)
 */

const TEXTIT_API_TOKEN = process.env.TEXTIT_API_TOKEN;
const TEXTIT_API_URL = (process.env.TEXTIT_API_URL || "https://textit.com/api/v2").replace(/\/$/, "");
const TEXTIT_CHANNEL_UUID = process.env.TEXTIT_CHANNEL_UUID || "";

export interface BroadcastResult {
  ok: boolean;
  message: string;
  broadcastId?: number;
}

/**
 * Envía un mensaje al teléfono dado. `urn` debe ser un URN válido para
 * TextIt: `tel:+57XXXXXXXXXX` o `whatsapp:+57XXXXXXXXXX` según canal.
 *
 * Si TEXTIT_API_TOKEN no está configurado, retorna ok:false con un aviso
 * (útil para entornos dev/test).
 */
export async function enviarBroadcastTelefono(
  telefono: string,
  texto: string,
  attachments?: string[]
): Promise<BroadcastResult> {
  if (!TEXTIT_API_TOKEN) {
    console.warn("[textitNotify] TEXTIT_API_TOKEN no configurado — skip");
    return { ok: false, message: "TEXTIT_API_TOKEN no configurado" };
  }
  const tel10 = telefono.replace(/\D/g, "").slice(-10);
  if (tel10.length !== 10) {
    return { ok: false, message: `Teléfono inválido: ${telefono}` };
  }
  // Default a WhatsApp. ATENCIÓN: TextIt rechaza el "+" en el URN
  // ("Invalid URN: Ensure phone numbers contain country codes" — el error es
  // engañoso, en realidad NO acepta el +). Usar formato `whatsapp:57XXXXXX`.
  const urn = `whatsapp:57${tel10}`;

  const body: Record<string, unknown> = {
    text: texto,
    urns: [urn],
  };
  // Attachments: array de strings con formato `mimetype:url` (ej.
  // "application/pdf:https://..."). TextIt los descarga y los sirve al canal.
  if (attachments && attachments.length > 0) body.attachments = attachments;
  if (TEXTIT_CHANNEL_UUID) body.channel = TEXTIT_CHANNEL_UUID;

  try {
    const r = await fetch(`${TEXTIT_API_URL}/broadcasts.json`, {
      method: "POST",
      headers: {
        Authorization: `Token ${TEXTIT_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(
        `[textitNotify] Broadcast falló (${r.status}):`,
        JSON.stringify(data).slice(0, 300)
      );
      return {
        ok: false,
        message: `TextIt ${r.status}: ${JSON.stringify(data).slice(0, 100)}`,
      };
    }
    return {
      ok: true,
      message: "Broadcast enviado",
      broadcastId: (data as { id?: number }).id,
    };
  } catch (err) {
    console.error("[textitNotify] Error:", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Plantillas ────────────────────────────────────────────────────────────

export interface AprobadoCertParams {
  telefono: string;
  consecutivo: number;
  pdfUrl: string | null;
  nombreCoordinador: string;
}

export async function notificarCertAprobado(
  p: AprobadoCertParams
): Promise<BroadcastResult> {
  const lineas = [
    `✅ ¡Tu certificado #${p.consecutivo} fue aprobado!`,
    `Coordinador: ${p.nombreCoordinador}`,
    "",
    "Adjunto el PDF del certificado.",
  ];
  const attachments = p.pdfUrl ? [`application/pdf:${p.pdfUrl}`] : undefined;
  return enviarBroadcastTelefono(p.telefono, lineas.join("\n"), attachments);
}

export interface RechazadoCertParams {
  telefono: string;
  consecutivo?: number;
  motivo: string;
  nombreCoordinador: string;
}

export async function notificarCertRechazado(
  p: RechazadoCertParams
): Promise<BroadcastResult> {
  const lineas = [
    p.consecutivo
      ? `❌ Tu solicitud de certificado #${p.consecutivo} fue rechazada.`
      : "❌ Tu solicitud de certificado fue rechazada.",
    `Coordinador: ${p.nombreCoordinador}`,
    "",
    `Motivo: ${p.motivo}`,
    "",
    "Si necesitas más información, escríbele a tu coordinador.",
  ];
  return enviarBroadcastTelefono(p.telefono, lineas.join("\n"));
}

export interface AnuladoCertParams {
  telefono: string;
  consecutivo: number;
  motivo: string;
  nombreCoordinador: string;
}

export async function notificarCertAnulado(
  p: AnuladoCertParams
): Promise<BroadcastResult> {
  const lineas = [
    `⚠️ Tu certificado #${p.consecutivo} fue ANULADO.`,
    `Por: ${p.nombreCoordinador}`,
    "",
    `Motivo: ${p.motivo}`,
    "",
    "Este certificado ya no es válido. Si necesitas uno nuevo, contacta a tu coordinador.",
  ];
  return enviarBroadcastTelefono(p.telefono, lineas.join("\n"));
}

export interface GenericoParams {
  telefono: string;
  texto: string;
}
export async function notificarGenerico(
  p: GenericoParams
): Promise<BroadcastResult> {
  return enviarBroadcastTelefono(p.telefono, p.texto);
}

// ─── Plantillas Generador / Finca ──────────────────────────────────────────

export async function notificarGeneradorAprobado(p: {
  telefono: string;
  nombre: string;
  nombreCoordinador: string;
}): Promise<BroadcastResult> {
  const lineas = [
    `✅ Tu registro como generador fue aprobado.`,
    `Nombre: ${p.nombre}`,
    `Coordinador: ${p.nombreCoordinador}`,
    "",
    "Ya puedes generar certificados desde el bot. Escríbeme cualquier mensaje para empezar.",
  ];
  return enviarBroadcastTelefono(p.telefono, lineas.join("\n"));
}

export async function notificarGeneradorRechazado(p: {
  telefono: string;
  nombre: string;
  motivo: string;
  nombreCoordinador: string;
}): Promise<BroadcastResult> {
  const lineas = [
    `❌ Tu solicitud de registro como generador fue rechazada.`,
    `Coordinador: ${p.nombreCoordinador}`,
    "",
    `Motivo: ${p.motivo}`,
    "",
    "Si tienes dudas, escríbele a tu coordinador.",
  ];
  return enviarBroadcastTelefono(p.telefono, lineas.join("\n"));
}

export async function notificarFincaAprobada(p: {
  telefono: string;
  nombreFinca: string;
  nombreCoordinador: string;
  esRevision?: boolean;
}): Promise<BroadcastResult> {
  const titulo = p.esRevision
    ? `✅ Los cambios en tu finca fueron aprobados.`
    : `✅ Tu nueva finca fue aprobada.`;
  const lineas = [
    titulo,
    `Finca: ${p.nombreFinca}`,
    `Coordinador: ${p.nombreCoordinador}`,
    "",
    p.esRevision
      ? "Los datos actualizados ya están firmes."
      : "Ya puedes generar certificados para esta finca.",
  ];
  return enviarBroadcastTelefono(p.telefono, lineas.join("\n"));
}

export async function notificarFincaRechazada(p: {
  telefono: string;
  nombreFinca: string;
  motivo: string;
  nombreCoordinador: string;
}): Promise<BroadcastResult> {
  const lineas = [
    `❌ Tu solicitud sobre la finca "${p.nombreFinca}" fue rechazada.`,
    `Coordinador: ${p.nombreCoordinador}`,
    "",
    `Motivo: ${p.motivo}`,
    "",
    "Si tienes dudas, escríbele a tu coordinador.",
  ];
  return enviarBroadcastTelefono(p.telefono, lineas.join("\n"));
}
