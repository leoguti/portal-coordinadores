"use server";

import nodemailer from "nodemailer";

interface SendAnulacionParams {
  consecutivo: number;
  motivo: string;
  emailsAgricultor: string[];
  emailCoordinador: string;
  nombreCoordinador: string;
  nombreGenerador: string;
  fechaDevolucion: string;
  totalKg: number;
}

/**
 * Notifica a agricultor + coordinador + auditoría (certificados@campolimpio.org)
 * que un certificado fue ANULADO. No incluye PDF — solo aviso textual con el
 * motivo declarado por el coordinador.
 */
export async function sendCertificadoAnuladoEmail(
  params: SendAnulacionParams
): Promise<{ ok: boolean; message: string }> {
  try {
    const port = Number(process.env.EMAIL_SERVER_PORT) || 587;
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });

    const recipients: string[] = [
      "certificados@campolimpio.org",
      "leogiga@gmail.com",
      ...params.emailsAgricultor,
    ];
    if (params.emailCoordinador) recipients.push(params.emailCoordinador);
    const to = Array.from(new Set(recipients.filter(Boolean)));
    if (to.length === 0) {
      return { ok: false, message: "Sin destinatarios" };
    }

    const html = `
<!DOCTYPE html>
<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937;">
  <div style="background:#fff7ed; border: 2px solid #f97316; border-radius: 8px; padding: 24px; text-align: center;">
    <h1 style="margin:0 0 12px; color:#9a3412; font-size: 22px;">⚠️ Certificado ANULADO</h1>
    <p style="margin: 4px 0; font-size: 16px;">Consecutivo: <strong>#${params.consecutivo}</strong></p>
  </div>

  <div style="margin-top: 24px;">
    <h2 style="font-size: 16px; color:#374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px;">Datos del certificado anulado</h2>
    <table style="width:100%; font-size:14px; color:#374151; border-collapse:collapse;">
      <tr><td style="padding:6px 0; color:#6b7280;">Generador</td><td style="padding:6px 0;"><strong>${escape(params.nombreGenerador)}</strong></td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Fecha devolución</td><td style="padding:6px 0;">${escape(params.fechaDevolucion)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Total kilos</td><td style="padding:6px 0;">${params.totalKg} kg</td></tr>
      <tr><td style="padding:6px 0; color:#6b7280;">Anulado por</td><td style="padding:6px 0;">${escape(params.nombreCoordinador)}</td></tr>
    </table>
  </div>

  <div style="margin-top: 20px; background:#fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px;">
    <p style="margin:0 0 6px; font-weight: 600; color:#991b1b;">Motivo de la anulación:</p>
    <p style="margin:0; color:#7f1d1d; white-space: pre-wrap;">${escape(params.motivo)}</p>
  </div>

  <div style="margin-top: 24px; padding: 16px; background:#f9fafb; border-radius: 6px; font-size: 13px; color:#6b7280;">
    <p style="margin:0;">Este certificado fue invalidado y ya <strong>no es válido</strong> como soporte de devolución de envases. Si necesitas un nuevo certificado, contacta a tu coordinador de CampoLimpio.</p>
  </div>

  <p style="margin-top:24px; font-size:11px; color:#9ca3af; text-align:center;">
    Corporación CampoLimpio · NIT 900.235.428-2 · Notificación automática de anulación
  </p>
</body></html>
`;

    const subject = `Certificado #${params.consecutivo} ANULADO - CampoLimpio`;
    const info = await transport.sendMail({
      from: `"CampoLimpio Certificados" <${process.env.EMAIL_SERVER_USER || "certificados@campolimpio.org"}>`,
      to: to.join(", "),
      subject,
      html,
    });
    return {
      ok: true,
      message: `Notificación de anulación enviada a ${to.length} destinatarios (messageId=${info.messageId})`,
    };
  } catch (err) {
    console.error("[sendCertificadoAnuladoEmail] Error:", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function escape(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
