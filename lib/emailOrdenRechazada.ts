import nodemailer from "nodemailer";

/**
 * Aviso al coordinador cuando administración RECHAZA una orden de servicio:
 * el motivo + la lista de kardex que quedaron libres ("Por Pagar") para
 * rehacer la orden con los valores correctos. Cierra el ciclo del rechazo —
 * antes el rechazo era silencioso y dejaba los kardex atrapados.
 */
export async function enviarEmailOrdenRechazada(params: {
  emailCoordinador: string;
  nombreCoordinador: string;
  numeroOrden: number;
  beneficiario: string;
  motivo: string;
  rechazadaPor: string;
  kardexLiberados: Array<{ idkardex: number; fecha: string; kg: number }>;
}): Promise<boolean> {
  const { emailCoordinador, nombreCoordinador, numeroOrden, beneficiario, motivo, rechazadaPor, kardexLiberados } = params;
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

    const filasKardex = kardexLiberados
      .map(
        (k) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">#${k.idkardex}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${k.fecha}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${Math.round(k.kg).toLocaleString("es-CO")} kg</td>
        </tr>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 650px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #042726; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">Orden de Servicio rechazada</h1>
    </div>
    <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Hola <strong>${nombreCoordinador}</strong>,</p>
      <p>Administración rechazó tu orden de servicio <strong>#${numeroOrden}</strong>${beneficiario ? ` (beneficiario: <strong>${beneficiario}</strong>)` : ""}.</p>
      <div style="background-color: #fee2e215; border-left: 4px solid #dc2626; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
        <p style="margin: 0;"><strong>Motivo:</strong> ${motivo}</p>
        <p style="margin: 4px 0 0; color: #6b7280; font-size: 13px;">Rechazada por ${rechazadaPor}</p>
      </div>
      ${
        kardexLiberados.length > 0
          ? `
      <p><strong>Buenas noticias:</strong> los ${kardexLiberados.length} registros de kardex de esa orden quedaron <strong>liberados ("Por Pagar")</strong> — te aparecerán de nuevo al crear la orden corregida:</p>
      <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background-color: #042726; color: white;">
            <th style="padding: 8px 10px; text-align: left; font-size: 12px;">Kardex</th>
            <th style="padding: 8px 10px; text-align: left; font-size: 12px;">Fecha</th>
            <th style="padding: 8px 10px; text-align: right; font-size: 12px;">Kilos</th>
          </tr>
        </thead>
        <tbody>${filasKardex}</tbody>
      </table>`
          : `<p>La orden no tenía registros de kardex vinculados.</p>`
      }
      <p style="margin-top: 16px;"><strong>Qué debes hacer:</strong> crear una orden NUEVA seleccionando esos mismos kardex (paso 1 del formulario) e ingresando los valores corregidos. La orden rechazada no se toca — queda solo como registro.</p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="https://portal.campolimpio.org/ordenes-servicio-v2/nueva" style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">Crear la orden corregida ahora →</a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">Si tienes dudas sobre el motivo del rechazo, contacta a administración.</p>
    </div>
    <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;"><strong>Programa de Manejo de Envases Vacíos</strong> - CampoLimpio Colombia</p>
      <p style="margin: 4px 0 0;">Este es un correo automático del Portal de Coordinadores.</p>
    </div>
  </div>
</body>
</html>`;

    await transport.sendMail({
      from: `"CampoLimpio - Órdenes de Servicio" <${process.env.EMAIL_FROM}>`,
      to: emailCoordinador,
      subject: `Orden #${numeroOrden} rechazada — kardex liberados para rehacerla`,
      html,
    });
    console.log(`[orden-rechazada] email enviado a ${emailCoordinador} (orden #${numeroOrden})`);
    return true;
  } catch (err) {
    console.error("[orden-rechazada] Error enviando email:", err);
    return false;
  }
}
