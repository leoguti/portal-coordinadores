/**
 * Email al coordinador cuando un agricultor crea una solicitud de
 * certificado por WhatsApp (intent cert-nuevo, estado=pendiente).
 *
 * Contiene el resumen de la solicitud, el bloque de responsabilidad y dos
 * acciones: el enlace mágico para decidir (/m/aprobar-cert/<token>) y un
 * wa.me directo al agricultor para aclarar dudas antes de decidir.
 *
 * Patrón SMTP igual a lib/sendCertificadoEmail.ts (nodemailer), pero sin
 * imágenes embebidas — HTML liviano con estilos inline.
 */

import nodemailer from "nodemailer";

export interface EmailAprobacionCertParams {
  coordinadorEmail: string;
  coordinadorNombre: string;
  consecutivo: number;
  nombreAgricultor: string;
  cedulaAgricultor: string;
  finca: string;
  municipioDevolucion: string;
  lugarDevolucion: string;
  fechaRecoleccion: string;
  rigidos: number;
  flexibles: number;
  metalicos: number;
  embalaje: number;
  total: number;
  triplelavado: string;
  observaciones: string;
  /** Enlace mágico para revisar y decidir. */
  urlDecision: string;
  /** wa.me al agricultor con texto prellenado. Null si no hay móvil. */
  waAgricultorUrl: string | null;
  /** URL de la bandeja del portal (alternativa al enlace). */
  urlBandeja: string;
}

function esc(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtKg(n: number): string {
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(n)} kg`;
}

function filaResumen(label: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 12px; color:#6b7280; font-size:13px; white-space:nowrap; vertical-align:top;">${esc(label)}</td>
    <td style="padding:6px 12px; color:#111827; font-size:13px;">${esc(valor) || "—"}</td>
  </tr>`;
}

function buildHtml(p: EmailAprobacionCertParams): string {
  const primerNombre = (p.nombreAgricultor || "el agricultor").split(" ")[0];
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><title>Nueva solicitud de certificado</title></head>
<body style="margin:0; padding:0; background:#f5f5f5; font-family:Arial,Helvetica,sans-serif;">
<center>
<table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; margin:24px auto; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;">
  <tr>
    <td>

      <!-- HEADER -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#006838; color:#ffffff;">
        <tr>
          <td style="padding:18px 24px;">
            <h1 style="margin:0; font-size:20px;">CampoLimpio&reg; Colombia</h1>
            <p style="margin:4px 0 0; font-size:13px; opacity:0.9;">Solicitud de certificado pendiente de tu decisi&oacute;n</p>
          </td>
        </tr>
      </table>

      <!-- CONTENIDO -->
      <div style="padding:24px; color:#333333;">
        <p style="margin:0 0 12px; font-size:14px;">Hola ${esc(p.coordinadorNombre || "coordinador")},</p>
        <p style="margin:0 0 16px; font-size:14px; line-height:1.5;">
          <strong>${esc(p.nombreAgricultor)}</strong> envi&oacute; por WhatsApp la solicitud de
          certificado de devoluci&oacute;n <strong>#${p.consecutivo}</strong>.
          Est&aacute; asignada a ti y qued&oacute; en espera de tu revisi&oacute;n.
        </p>

        <!-- RESUMEN -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb; border-radius:6px; border-collapse:separate; margin-bottom:16px;">
          <tr><td colspan="2" style="background:#f9fafb; padding:8px 12px; font-size:12px; font-weight:bold; color:#374151; border-bottom:1px solid #e5e7eb;">RESUMEN DE LA SOLICITUD</td></tr>
          ${filaResumen("Nombres y apellidos / Razón social", p.nombreAgricultor)}
          ${filaResumen("Cédula / NIT", p.cedulaAgricultor)}
          ${filaResumen("Finca", p.finca)}
          ${filaResumen("Municipio", p.municipioDevolucion)}
          ${filaResumen("Lugar de devolución", p.lugarDevolucion)}
          ${filaResumen("Fecha de recolección", p.fechaRecoleccion)}
          ${filaResumen("Rígidos", fmtKg(p.rigidos))}
          ${filaResumen("Flexibles", fmtKg(p.flexibles))}
          ${filaResumen("Metálicos", fmtKg(p.metalicos))}
          ${filaResumen("Embalaje", fmtKg(p.embalaje))}
          <tr>
            <td style="padding:6px 12px; color:#065f46; font-size:13px; font-weight:bold;">Total</td>
            <td style="padding:6px 12px; color:#065f46; font-size:15px; font-weight:bold;">${esc(fmtKg(p.total))}</td>
          </tr>
          ${filaResumen("Triple lavado", p.triplelavado)}
          ${p.observaciones ? filaResumen("Observaciones", p.observaciones) : ""}
        </table>

        <!-- BLOQUE DE RESPONSABILIDAD -->
        <div style="background:#fffbeb; border:1px solid #fcd34d; border-radius:6px; padding:14px 16px; margin-bottom:20px;">
          <p style="margin:0 0 8px; font-size:13px; font-weight:bold; color:#92400e;">
            La aprobaci&oacute;n de este certificado es tu responsabilidad
          </p>
          <p style="margin:0 0 8px; font-size:13px; color:#78350f; line-height:1.5;">
            La revisi&oacute;n y aprobaci&oacute;n de esta solicitud es responsabilidad exclusiva
            tuya como coordinador: el certificado se emite con tu nombre. Antes de decidir:
          </p>
          <ul style="margin:0; padding-left:18px; font-size:13px; color:#78350f; line-height:1.6;">
            <li>Si tienes cualquier duda sobre los datos, habla primero con el agricultor.</li>
            <li>No apruebes hasta estar completamente seguro de que la informaci&oacute;n es correcta.</li>
            <li>Si no logras verificar la informaci&oacute;n, rechaza la solicitud indicando el motivo — el agricultor podr&aacute; corregirla y volver a enviarla.</li>
          </ul>
        </div>

        <!-- BOTONES -->
        <p style="text-align:center; margin:0 0 12px;">
          <a href="${p.urlDecision}"
             style="background:#006838; color:#ffffff; text-decoration:none; padding:14px 32px; font-size:15px; font-weight:bold; border-radius:6px; display:inline-block;">
            Revisar y decidir
          </a>
        </p>
        ${
          p.waAgricultorUrl
            ? `<p style="text-align:center; margin:0 0 20px;">
          <a href="${p.waAgricultorUrl}"
             style="background:#ffffff; color:#128c7e; border:1px solid #25d366; text-decoration:none; padding:11px 24px; font-size:14px; border-radius:6px; display:inline-block;">
            &#128172; Hablar con ${esc(primerNombre)} por WhatsApp
          </a>
        </p>`
            : ""
        }

        <p style="font-size:12px; color:#6b7280; line-height:1.5; margin:0; border-top:1px solid #e5e7eb; padding-top:14px;">
          Puedes revisar y decidir desde tu <strong>celular o computador</strong>. El enlace
          <strong> vence en 7 d&iacute;as</strong> y deja de funcionar en cuanto la solicitud se
          decida (por el enlace o por el portal). Tambi&eacute;n puedes gestionarla desde la
          bandeja del portal:
          <a href="${p.urlBandeja}" style="color:#006838;">Solicitudes pendientes</a>.
        </p>
      </div>

      <!-- FOOTER -->
      <div style="background:#eeeeee; text-align:center; padding:12px; font-size:11px; color:#6b7280;">
        CampoLimpio&reg; Colombia &middot; Portal de Coordinadores
      </div>

    </td>
  </tr>
</table>
</center>
</body>
</html>`;
}

function buildText(p: EmailAprobacionCertParams): string {
  const lineas = [
    `Aprobar certificado #${p.consecutivo} — solicitud de agricultor por WhatsApp`,
    ``,
    `Hola ${p.coordinadorNombre || "coordinador"},`,
    ``,
    `${p.nombreAgricultor} envió por WhatsApp la solicitud de certificado de devolución #${p.consecutivo}. Está asignada a ti y quedó en espera de tu revisión.`,
    ``,
    `RESUMEN`,
    `- Nombres y apellidos / Razón social: ${p.nombreAgricultor}`,
    `- Cédula / NIT: ${p.cedulaAgricultor}`,
    `- Finca: ${p.finca}`,
    `- Municipio: ${p.municipioDevolucion}`,
    `- Lugar de devolución: ${p.lugarDevolucion}`,
    `- Fecha de recolección: ${p.fechaRecoleccion}`,
    `- Rígidos: ${fmtKg(p.rigidos)} · Flexibles: ${fmtKg(p.flexibles)} · Metálicos: ${fmtKg(p.metalicos)} · Embalaje: ${fmtKg(p.embalaje)}`,
    `- Total: ${fmtKg(p.total)}`,
    `- Triple lavado: ${p.triplelavado}`,
  ];
  if (p.observaciones) lineas.push(`- Observaciones: ${p.observaciones}`);
  lineas.push(
    ``,
    `IMPORTANTE: la revisión y aprobación de esta solicitud es responsabilidad exclusiva tuya como coordinador — el certificado se emite con tu nombre. Si tienes cualquier duda, habla con el agricultor ANTES de decidir. No apruebes hasta estar completamente seguro. Si no logras verificar la información, rechaza la solicitud indicando el motivo (el agricultor podrá corregirla y reenviarla).`,
    ``,
    `Revisar y decidir: ${p.urlDecision}`
  );
  if (p.waAgricultorUrl) {
    lineas.push(`Hablar con el agricultor por WhatsApp: ${p.waAgricultorUrl}`);
  }
  lineas.push(
    ``,
    `Puedes revisar y decidir desde tu celular o computador. El enlace vence en 7 días y deja de funcionar en cuanto la solicitud se decida. También puedes gestionarla en el portal: ${p.urlBandeja}`,
    ``,
    `CampoLimpio® Colombia`
  );
  return lineas.join("\n");
}

/**
 * Envía el email de aprobación al coordinador asignado. No lanza — devuelve
 * { success, message } para que el caller decida qué loguear (el flujo del
 * agricultor NUNCA debe fallar por un problema de email).
 */
export async function sendEmailAprobacionCert(
  params: EmailAprobacionCertParams
): Promise<{ success: boolean; message: string }> {
  const email = (params.coordinadorEmail || "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      success: false,
      message: `Email del coordinador inválido o vacío: "${email}"`,
    };
  }

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

    await transport.sendMail({
      from: `"CampoLimpio Certificados" <${process.env.EMAIL_FROM || process.env.EMAIL_SERVER_USER || "certificados@campolimpio.org"}>`,
      to: email,
      subject: `Aprobar certificado #${params.consecutivo} — ${params.nombreAgricultor} · agricultor WhatsApp`,
      text: buildText(params),
      html: buildHtml(params),
    });

    const msg = `Email de aprobación del cert #${params.consecutivo} enviado a ${email}`;
    console.log(`[emailAprobacionCert] ${msg}`);
    return { success: true, message: msg };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[emailAprobacionCert] Error:`, error);
    return { success: false, message: msg };
  }
}
