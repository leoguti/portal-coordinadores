import nodemailer from "nodemailer";

// Buzón de atención de la página web (lo revisa Comunicaciones). Se puede
// sobreescribir con CONTACTO_WEB_EMAIL en Vercel sin tocar código.
const DESTINO = process.env.CONTACTO_WEB_EMAIL || "contactenos@campolimpio.org";

// El tema lo escribe la persona en WhatsApp — texto libre que va dentro del
// HTML del correo, hay que escaparlo.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Aviso al equipo cuando una persona SIN registro escribe al bot de WhatsApp
 * y pide hablar con un coordinador: sin registro no hay coordinador asignado
 * a quien dirigirla, así que el equipo hace el primer contacto.
 */
export async function enviarAvisoContactoDesconocido(
  telefono10: string,
  tema?: string
): Promise<boolean> {
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
    const wa = `https://wa.me/57${telefono10}`;
    const temaTxt = tema ? `Tema: ${tema}\n` : "";
    const temaHtml = tema
      ? `<p style="background:#f4f4f4;border-left:4px solid #25D366;padding:10px 14px;margin:12px 0;"><strong>Tema:</strong> ${escapeHtml(tema)}</p>`
      : "";
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: DESTINO,
      subject: `WhatsApp: +57 ${telefono10} pide hablar con un coordinador`,
      text:
        `Una persona sin registro escribió al bot de WhatsApp de CampoLimpio y pidió hablar con un coordinador.\n\n` +
        `Número: +57 ${telefono10}\n` +
        temaTxt +
        `Escríbele por WhatsApp: ${wa}\n\n` +
        `El bot ya le respondió que el equipo la contactará a ese número, y le sugirió la opción de registrarse como agricultor.\n\n` +
        `— Aviso automático del bot de WhatsApp (portal.campolimpio.org)`,
      html:
        `<p>Una persona <strong>sin registro</strong> escribió al bot de WhatsApp de CampoLimpio y pidió hablar con un coordinador.</p>` +
        `<p><strong>Número:</strong> +57 ${telefono10}</p>` +
        temaHtml +
        `<p><a href="${wa}" style="display:inline-block;margin-top:8px;background-color:#25D366;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Escribirle por WhatsApp</a></p>` +
        `<p>El bot ya le respondió que el equipo la contactará a ese número, y le sugirió la opción de registrarse como agricultor.</p>` +
        `<p style="color:#888;font-size:12px;">— Aviso automático del bot de WhatsApp (portal.campolimpio.org)</p>`,
    });
    console.log(`[contacto-desconocido] email enviado a ${DESTINO} por +57${telefono10}`);
    return true;
  } catch (err) {
    console.error("[contacto-desconocido] Error enviando email:", err);
    return false;
  }
}
