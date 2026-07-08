"use server";

import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

// Table ID for infographic attachments
const INFOGRAFIA_TABLE = process.env.AIRTABLE_TABLE_INFOGRAFIAS || "Infografia";

export interface SendCertificadoEmailParams {
  consecutivo: number;
  pdfBuffer: Buffer;
  emails: string[]; // list of recipient emails
}

/**
 * Fetch the latest infographic image URL from Airtable.
 * Falls back to null if unavailable.
 */
async function fetchInfografiaUrl(): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      pageSize: "1",
      "sort[0][field]": "creacion",
      "sort[0][direction]": "desc",
    });
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${INFOGRAFIA_TABLE}?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.records?.[0]?.fields?.Attachments?.[0]?.url || null;
  } catch {
    return null;
  }
}

/**
 * Download an image from URL and return as Buffer.
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Build the HTML email template matching the original PHP version.
 */
function buildEmailHtml(consecutivo: number): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Certificado de Devolución</title>
<style>
  body { margin:0; padding:0; background:#f5f5f5; font-family:Arial,sans-serif; }
  .button { display:inline-block; padding:12px 20px; margin:10px 5px; font-size:16px; color:#fff; background:#006838; text-decoration:none; border-radius:5px; }
  .infografia { width:100%; height:auto; display:block; }
  .social-icons img { width:30px; margin:0 5px; }
</style>
</head>
<body>
<center>
  <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#fff; margin:auto; border:1px solid #ddd; border-radius:8px;">
    <tr>
      <td>

        <!-- HEADER -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#006838; color:#fff; height:100px;">
          <tr>
            <td align="left" valign="middle" style="padding-left:15px;">
              <h1 style="margin:0; font-size:22px;">CampoLimpio<sup style="font-size:0.5em;">\u00AE</sup> Colombia</h1>
              <p style="margin:0;">Certificado de Devoluci\u00F3n</p>
            </td>
            <td align="right" valign="middle" style="padding-right:15px;">
              <img src="cid:logoHeader" alt="Logo CampoLimpio" width="160" height="160" style="height:160px; width:160px; display:block;"/>
            </td>
          </tr>
        </table>

        <!-- CONTENIDO -->
        <div style="padding:20px; color:#333;">
          <p>Estimado generador,</p>
          <p>Gracias por ser parte del cambio hacia una agricultura m\u00E1s sustentable.</p>
          <p>Antes de descargar tu certificado, te invitamos a conocer una de nuestras campa\u00F1as clave para proteger el ambiente y promover la econom\u00EDa circular.</p>

          <p style="text-align:center;">
            <img src="cid:infografiaDinamica" alt="Infograf\u00EDa" class="infografia"/>
          </p>

          <hr style="border:none; border-top:1px solid #ccc; margin:30px 0;"/>

          <p style="text-align:center; font-weight:bold; font-size:18px;">
            \uD83D\uDCC4 Certificado No. ${consecutivo}
          </p>
          <p style="text-align:center; color:#444; font-size:14px; margin-top:5px;">
            El certificado de devoluci\u00F3n se encuentra adjunto a este correo en formato PDF.<br/>
            Por favor gu\u00E1rdalo en tus archivos para cualquier visita o requerimiento de la autoridad ambiental.
          </p>

          <p>
            \u00BFNecesitas otro certificado?<br/>
            Puedes solicitarlo directamente desde tu celular a trav\u00E9s de nuestro canal de WhatsApp:
          </p>

          <p style="text-align:center; margin:20px 0;">
            <a href="https://wa.me/573234688397"
                style="background-color:#25D366; color:#fff; text-decoration:none; padding:14px 28px; font-size:16px; font-weight:bold; border-radius:6px; display:inline-block; font-family:Arial,sans-serif;">
                \uD83D\uDCF2 Solicitar otro certificado por WhatsApp
            </a>
          </p>

          <p>\u00A1Gracias por sumarte! Tener un campo limpio s\u00ED es posible cuando trabajamos juntos.</p>

          <!-- LOGOS -->
          <div style="text-align:center; margin-top:30px;">
            <p style="font-weight:bold;">Conoce m\u00E1s sobre nuestro compromiso ambiental:</p>
            <table align="center" cellpadding="10">
              <tr>
                <td align="center"><a href="https://campolimpio.org/"><img src="cid:logoCL" alt="Logo CampoLimpio" width="196" height="80" style="width:196px; height:80px;"/></a></td>
                <td align="center"><a href="https://campolimpio.org/"><img src="cid:logoAmo" alt="Logo Amo" width="82" height="80" style="width:82px; height:80px;"/></a></td>
                <td align="center"><a href="https://campolimpio.org/"><img src="cid:pascualSol" alt="Pascual y Sol" width="80" height="100" style="width:80px; height:100px;"/></a></td>
              </tr>
            </table>
          </div>
        </div>

        <!-- FOOTER -->
        <div style="background:#eee; text-align:center; padding:10px;">
          <p>S\u00EDganos en nuestras redes sociales:</p>
          <div class="social-icons">
            <a href="https://www.instagram.com/CampoLimpioColombia"><img src="cid:iconInstagram" alt="Instagram" width="30" height="30" style="width:30px; height:30px;"/></a>
            <a href="https://www.facebook.com/CampoLimpioOficial"><img src="cid:iconFacebook" alt="Facebook" width="30" height="30" style="width:30px; height:30px;"/></a>
            <a href="https://www.youtube.com/@campolimpiocolombia71"><img src="cid:iconYouTube" alt="YouTube" width="30" height="30" style="width:30px; height:30px;"/></a>
            <a href="https://wa.me/573234688397"><img src="cid:iconWhatsapp" alt="WhatsApp" width="30" height="30" style="width:30px; height:30px;"/></a>
            <a href="https://campolimpio.org/"><img src="cid:iconWeb" alt="Sitio Web" width="30" height="30" style="width:30px; height:30px;"/></a>
          </div>
        </div>

      </td>
    </tr>
  </table>
</center>
</body>
</html>`;
}

/**
 * Send certificado email with PDF attachment and embedded images.
 * Matches the original PHP email exactly.
 */
export async function sendCertificadoEmail(
  params: SendCertificadoEmailParams
): Promise<{ success: boolean; message: string }> {
  const { consecutivo, pdfBuffer, emails } = params;

  // Validate emails
  const validEmails = emails.filter(
    (e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  );
  if (validEmails.length === 0) {
    return { success: false, message: "No valid email addresses provided" };
  }

  try {
    console.log(
      `[sendCertificadoEmail] Sending cert #${consecutivo} to: ${validEmails.join(", ")}`
    );

    // 1. Create SMTP transport
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

    await transport.verify();

    // 2. Load static images for CID embedding
    // Use path.resolve with string literals so Vercel's file tracer includes them
    const assetsDir = path.resolve(process.cwd(), "lib", "email-assets");

    const staticImages: { cid: string; file: string; contentType: string }[] = [
      { cid: "logoHeader", file: "logo-cl-blanco.png", contentType: "image/png" },
      { cid: "logoCL", file: "logo-cl.png", contentType: "image/png" },
      { cid: "logoAmo", file: "logo-amo.png", contentType: "image/png" },
      { cid: "pascualSol", file: "pascual-sol.png", contentType: "image/png" },
      { cid: "iconInstagram", file: "icon-instagram.png", contentType: "image/png" },
      { cid: "iconFacebook", file: "icon-facebook.png", contentType: "image/png" },
      { cid: "iconYouTube", file: "icon-youtube.png", contentType: "image/png" },
      { cid: "iconWhatsapp", file: "icon-whatsapp.png", contentType: "image/png" },
      { cid: "iconWeb", file: "icon-web.png", contentType: "image/png" },
    ];

    const attachments: nodemailer.SendMailOptions["attachments"] = [];

    // Add static CID images
    for (const img of staticImages) {
      const filePath = path.join(assetsDir, img.file);
      try {
        const content = fs.readFileSync(filePath);
        attachments.push({
          filename: img.file,
          content,
          cid: img.cid,
          contentType: img.contentType,
        });
      } catch {
        console.warn(`[sendCertificadoEmail] Image not found: ${img.file}`);
      }
    }

    // 3. Fetch dynamic infographic from Airtable
    const infografiaUrl = await fetchInfografiaUrl();
    let infografiaBuffer: Buffer | null = null;

    if (infografiaUrl) {
      infografiaBuffer = await downloadImage(infografiaUrl);
    }

    if (infografiaBuffer) {
      attachments.push({
        filename: "infografia.jpg",
        content: infografiaBuffer,
        cid: "infografiaDinamica",
        contentType: "image/jpeg",
      });
    } else {
      // Fallback to local infographic
      const fallbackPath = path.join(assetsDir, "infografia-fallback.jpg");
      try {
        const content = fs.readFileSync(fallbackPath);
        attachments.push({
          filename: "infografia.jpg",
          content,
          cid: "infografiaDinamica",
          contentType: "image/jpeg",
        });
      } catch {
        console.warn("[sendCertificadoEmail] Infographic fallback not found");
      }
    }

    // 4. Add PDF attachment
    attachments.push({
      filename: `certificado_${consecutivo}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });

    // 5. Build and send email
    const htmlBody = buildEmailHtml(consecutivo);
    const textBody = `Certificado de Devolución No. ${consecutivo}\n\nEstimado generador,\n\nGracias por ser parte del cambio hacia una agricultura más sustentable.\n\nEl certificado de devolución se encuentra adjunto a este correo en formato PDF.\nPor favor guárdalo en tus archivos para cualquier visita o requerimiento de la autoridad ambiental.\n\n¿Necesitas otro certificado? Solicítalo por WhatsApp: https://wa.me/573234688397\n\n¡Gracias por sumarte!\nCampoLimpio® Colombia`;

    await transport.sendMail({
      from: `"CampoLimpio Certificados" <${process.env.EMAIL_SERVER_USER || "certificados@campolimpio.org"}>`,
      to: validEmails.join(", "),
      subject: `Tu Certificado de Devolución Nº ${consecutivo} está adjunto – CampoLimpio® Colombia`,
      text: textBody,
      html: htmlBody,
      attachments,
    });

    const msg = `Correo enviado a: ${validEmails.join(", ")} con certificado ${consecutivo}`;
    console.log(`[sendCertificadoEmail] ${msg}`);
    return { success: true, message: msg };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[sendCertificadoEmail] Error:`, error);
    return { success: false, message: msg };
  }
}
