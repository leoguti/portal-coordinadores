import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAllKardex, getAllCoordinadoresActivos } from "@/lib/airtable";

export const maxDuration = 60;

// Vercel cron security: verify the request comes from Vercel
function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  // Also allow if no CRON_SECRET is set (dev mode)
  if (!process.env.CRON_SECRET) return true;
  return false;
}

interface KardexHuerfano {
  idkardex: number;
  fecha: string;
  tipo: string;
  municipio: string;
  totalKg: number;
  centro: string;
}

/**
 * GET /api/cron/alertas-kardex
 *
 * Runs daily via Vercel cron. Only sends emails on days 1, 4, and 7.
 * Finds kardex records with EstadoPago="Por Pagar" (orphans) and
 * emails each coordinator their pending list.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "true";
  const testEmail = searchParams.get("email");

  // Colombia timezone
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
  );
  const dia = isTest ? 7 : now.getDate(); // In test mode, simulate day 7 (urgent)

  // Only send on days 1, 4, and 7
  if (!isTest && ![1, 4, 7].includes(dia)) {
    return NextResponse.json({ message: `Día ${dia}: no es día de alerta`, sent: 0 });
  }

  const diasRestantes = 7 - dia;
  let asunto: string;
  let urgencia: string;
  let colorUrgencia: string;
  if (dia === 1) {
    asunto = "Tienes registros de Kardex pendientes - 7 días para el cierre";
    urgencia = "Tienes hasta el día 7 de este mes para incluirlos en una orden de servicio.";
    colorUrgencia = "#f59e0b"; // amarillo
  } else if (dia === 4) {
    asunto = "Faltan 3 días - Kardex pendientes de incluir en orden";
    urgencia = "Faltan solo 3 días para el cierre. Después del día 7 estos registros quedarán sin orden.";
    colorUrgencia = "#f97316"; // naranja
  } else {
    asunto = "ÚLTIMO DÍA - Kardex pendientes quedarán huérfanos";
    urgencia = "Hoy es el último día. Después de hoy, estos registros del mes anterior ya no podrán incluirse en una orden de servicio.";
    colorUrgencia = "#dc2626"; // rojo
  }

  try {
    const [allKardex, coordinadores] = await Promise.all([
      getAllKardex(),
      getAllCoordinadoresActivos(),
    ]);

    // Filter only "Por Pagar" kardex
    const kardexPorPagar = allKardex.filter(
      (k) => k.fields.EstadoPago === "Por Pagar"
    );

    // Determine which month is closing (previous month)
    const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mesCierreStr = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;

    // Group by coordinator - only records from the closing month or earlier
    const coordMap = new Map(
      coordinadores
        .filter((c) => c.rol === "Coordinador")
        .map((c) => [c.id, c])
    );

    const huerfanosPorCoord = new Map<string, KardexHuerfano[]>();

    for (const k of kardexPorPagar) {
      const coordId = k.fields.idcoordinador?.[0] || k.fields.Coordinador?.[0];
      if (!coordId || !coordMap.has(coordId)) continue;

      // Only include records from the closing month or earlier
      const mesk = k.fields.MES;
      if (!mesk || mesk > mesCierreStr) continue;

      const registro: KardexHuerfano = {
        idkardex: k.fields.idkardex || 0,
        fecha: k.fields.fechakardex || "",
        tipo: k.fields.TipoMovimiento || "",
        municipio:
          k.fields["mundep (from MunicipioOrigen)"]?.[0] || "Sin municipio",
        totalKg: Math.abs(k.fields.Total || 0),
        centro: k.fields.NombreCentrodeAcopio?.[0] || "",
      };

      if (!huerfanosPorCoord.has(coordId)) {
        huerfanosPorCoord.set(coordId, []);
      }
      huerfanosPorCoord.get(coordId)!.push(registro);
    }

    // Send emails
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });

    await transport.verify();

    const MONTH_NAMES = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];
    const mesCierreLabel = `${MONTH_NAMES[mesAnterior.getMonth()]} ${mesAnterior.getFullYear()}`;

    let emailsSent = 0;
    const errors: string[] = [];

    // In test mode, only send to the first coordinator with pending records (to testEmail)
    const entries = isTest
      ? Array.from(huerfanosPorCoord.entries()).slice(0, 1)
      : Array.from(huerfanosPorCoord.entries());

    for (const [coordId, registros] of entries) {
      const coord = coordMap.get(coordId);
      if (!coord || (!coord.email && !testEmail)) continue;

      const totalKg = registros.reduce((s, r) => s + r.totalKg, 0);

      const tableRows = registros
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map(
          (r) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${r.idkardex}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${formatDate(r.fecha)}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">
              <span style="background-color: ${r.tipo === "ENTRADA" ? "#dcfce7" : "#dbeafe"}; color: ${r.tipo === "ENTRADA" ? "#166534" : "#1e40af"}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${r.tipo}</span>
            </td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${r.municipio}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${r.centro}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: right; font-weight: 600;">${Math.round(r.totalKg).toLocaleString("es-CO")} kg</td>
          </tr>`
        )
        .join("");

      const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #042726; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">Kardex Pendientes de Orden de Servicio</h1>
      <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">Cierre de ${mesCierreLabel}</p>
    </div>

    <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Hola <strong>${coord.name}</strong>,</p>

      <div style="background-color: ${colorUrgencia}15; border-left: 4px solid ${colorUrgencia}; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
        <p style="margin: 0; color: ${colorUrgencia}; font-weight: 600;">${urgencia}</p>
      </div>

      <p>Tienes <strong>${registros.length} registro${registros.length > 1 ? "s" : ""}</strong> de Kardex con estado <strong>"Por Pagar"</strong> de <strong>${mesCierreLabel}</strong> o anterior que aún no han sido incluidos en una orden de servicio:</p>

      <div style="overflow-x: auto; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <thead>
            <tr style="background-color: #042726; color: white;">
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600;">ID</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600;">Fecha</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600;">Tipo</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600;">Municipio</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600;">Centro</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <tfoot>
            <tr style="background-color: #f3f4f6; font-weight: 700;">
              <td colspan="5" style="padding: 10px 12px; font-size: 13px;">TOTAL (${registros.length} registros)</td>
              <td style="padding: 10px 12px; text-align: right; font-size: 13px;">${Math.round(totalKg).toLocaleString("es-CO")} kg</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p>Para resolver estos pendientes, ingresa al <a href="https://portal.campolimpio.org/ordenes-servicio" style="color: #00d084; font-weight: 600;">Portal de Coordinadores</a> y crea las órdenes de servicio correspondientes.</p>

      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Si alguno de estos registros no debería estar "Por Pagar", puedes corregir su estado de pago desde la vista de Kardex.</p>
    </div>

    <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;"><strong>Programa de Manejo de Envases Vacíos</strong> - CampoLimpio Colombia</p>
      <p style="margin: 4px 0 0;">Este es un correo automático del Portal de Coordinadores.</p>
    </div>
  </div>
</body>
</html>`;

      try {
        const recipient = isTest && testEmail ? testEmail : coord.email;
        await transport.sendMail({
          from: `"CampoLimpio - Alertas" <${process.env.EMAIL_FROM}>`,
          to: recipient,
          subject: `${isTest ? "[TEST] " : ""}⚠️ ${asunto} (${registros.length} registros)`,
          html,
        });
        emailsSent++;
        console.log(`Email sent to ${coord.name} (${coord.email}): ${registros.length} registros pendientes`);
      } catch (err) {
        const msg = `Error sending to ${coord.email}: ${err}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    return NextResponse.json({
      message: `Día ${dia}: alertas enviadas`,
      mesCierre: mesCierreLabel,
      diasRestantes,
      coordinadoresConPendientes: huerfanosPorCoord.size,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in alertas-kardex cron:", error);
    return NextResponse.json(
      { error: "Error interno", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
