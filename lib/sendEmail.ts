"use server";

import nodemailer from "nodemailer";

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

interface SendOrdenEmailParams {
  to: string;
  cc?: string[];
  numeroOrden: number;
  beneficiario: {
    razonSocial: string;
    nit: string;
  };
  coordinador: {
    nombre: string;
    email: string;
  };
  fechaPedido: string;
  total: number;
  pdfBuffer: Buffer;
}

/**
 * Send orden de servicio email with PDF attachment
 */
export async function sendOrdenEmail(params: SendOrdenEmailParams): Promise<boolean> {
  try {
    console.log(`Sending email for Orden #${params.numeroOrden} to ${params.to}`);

    // Configurar transporte SMTP
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT) || 465,
      secure: true, // SSL
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });

    // Verificar conexión
    await transport.verify();

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0,
      }).format(amount);
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    };

    // Construir email
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #00d084; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
    .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #00d084; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #00d084; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; }
    .label { font-weight: bold; color: #555; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📄 Orden de Servicio</h1>
      <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold;">N° ${params.numeroOrden}</p>
    </div>
    
    <div class="content">
      <p>Estimado/a <strong>${params.beneficiario.razonSocial}</strong>,</p>
      
      <p>Se ha generado una nueva orden de servicio a su nombre. Adjunto encontrará el documento PDF con todos los detalles.</p>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #00d084;">📋 Información de la Orden</h3>
        <table>
          <tr>
            <td class="label" width="40%">Número de Orden:</td>
            <td><strong>#${params.numeroOrden}</strong></td>
          </tr>
          <tr>
            <td class="label">Fecha:</td>
            <td>${formatDate(params.fechaPedido)}</td>
          </tr>
          <tr>
            <td class="label">Beneficiario:</td>
            <td>${params.beneficiario.razonSocial}</td>
          </tr>
          <tr>
            <td class="label">NIT/CC:</td>
            <td>${params.beneficiario.nit}</td>
          </tr>
          <tr>
            <td class="label">Valor Total:</td>
            <td><strong style="color: #00d084; font-size: 18px;">${formatCurrency(params.total)}</strong></td>
          </tr>
        </table>
      </div>
      
      <div class="info-box">
        <h3 style="margin-top: 0; color: #555;">👤 Coordinador Responsable</h3>
        <table>
          <tr>
            <td class="label" width="40%">Nombre:</td>
            <td>${params.coordinador.nombre}</td>
          </tr>
          <tr>
            <td class="label">Email:</td>
            <td><a href="mailto:${params.coordinador.email}">${params.coordinador.email}</a></td>
          </tr>
        </table>
      </div>
      
      <p style="margin-top: 30px;"><strong>📎 Documento Adjunto:</strong></p>
      <p>El PDF adjunto contiene la información completa de la orden de servicio incluyendo todos los items y detalles.</p>
      
      <p style="margin-top: 30px;">Si tiene alguna pregunta o requiere información adicional, no dude en contactar al coordinador responsable.</p>
    </div>
    
    <div class="footer">
      <p><strong>Programa de Manejo de Envases Vacíos</strong></p>
      <p>CampoLimpio Colombia</p>
      <p style="font-size: 11px; color: #999;">Este es un correo automático, por favor no responder directamente a este mensaje.</p>
    </div>
  </div>
</body>
</html>
    `;

    const emailText = `
Orden de Servicio N° ${params.numeroOrden}

Estimado/a ${params.beneficiario.razonSocial},

Se ha generado una nueva orden de servicio a su nombre.

INFORMACIÓN DE LA ORDEN:
- Número de Orden: #${params.numeroOrden}
- Fecha: ${formatDate(params.fechaPedido)}
- Beneficiario: ${params.beneficiario.razonSocial}
- NIT/CC: ${params.beneficiario.nit}
- Valor Total: ${formatCurrency(params.total)}

COORDINADOR RESPONSABLE:
- Nombre: ${params.coordinador.nombre}
- Email: ${params.coordinador.email}

El PDF adjunto contiene la información completa de la orden de servicio.

Si tiene alguna pregunta, contacte al coordinador responsable.

---
Programa de Manejo de Envases Vacíos
CampoLimpio Colombia
    `;

    // Configurar destinatarios
    const recipients = [params.to];
    const ccList = params.cc || [];
    
    // Agregar EMAIL_CC si está configurado
    if (process.env.EMAIL_CC) {
      ccList.push(process.env.EMAIL_CC);
    }

    // Enviar email
    await transport.sendMail({
      from: `"CampoLimpio - Órdenes de Servicio" <${process.env.EMAIL_FROM}>`,
      to: recipients.join(", "),
      cc: ccList.length > 0 ? ccList.join(", ") : undefined,
      subject: `📄 Orden de Servicio N° ${params.numeroOrden} - ${params.beneficiario.razonSocial}`,
      text: emailText,
      html: emailHtml,
      attachments: [
        {
          filename: `Orden_${params.numeroOrden}.pdf`,
          content: params.pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    console.log(`✅ Email sent successfully for Orden #${params.numeroOrden}`);
    return true;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return false;
  }
}
