import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getAllOrdenes, getAllCoordinadoresActivos } from "@/lib/airtable";
import {
  semaforoDeOrdenes,
  DIAS_AVISO,
  DIAS_BLOQUEO,
  type OrdenEnMora,
} from "@/lib/ordenesSemaforo";

export const maxDuration = 60;

// Fail-closed: sin CRON_SECRET configurado se rechaza todo.
function isAuthorized(request: Request): boolean {
  if (!process.env.CRON_SECRET) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

const PORTAL_URL = "https://portal.campolimpio.org/ordenes-servicio";

// Quien recibe el resumen semanal (administración ejecuta la facturación).
const ADMIN_EMAIL = process.env.SEMAFORO_ADMIN_EMAIL || "administrativa@campolimpio.org";

function crearTransporte() {
  const port = Number(process.env.EMAIL_SERVER_PORT) || 587;
  return nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function pie(): string {
  return `
    <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;"><strong>Programa de Manejo de Envases Vacíos</strong> - CampoLimpio Colombia</p>
      <p style="margin: 4px 0 0;">Este es un correo automático del Portal de Coordinadores.</p>
    </div>`;
}

function tablaOrdenes(ordenes: OrdenEnMora[], totales: Map<string, number>, conCoordinador: boolean): string {
  const rows = ordenes
    .map((o) => {
      const rojo = o.dias >= DIAS_BLOQUEO;
      return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${rojo ? "🔴" : "🟡"} <strong>#${o.numero}</strong></td>
        ${conCoordinador ? `<td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${o.coordinador || "Sin coordinador"}</td>` : ""}
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: right; font-weight: 600; color: ${rojo ? "#dc2626" : "#b45309"};">${o.dias} días</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${formatDate(o.fechaPedido)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; text-align: right;">${formatCurrency(totales.get(o.id) || 0)}</td>
      </tr>`;
    })
    .join("");
  return `
    <div style="overflow-x: auto; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background-color: #042726; color: white;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600;">Orden</th>
            ${conCoordinador ? `<th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600;">Coordinador</th>` : ""}
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600;">Sin factura</th>
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600;">Fecha de pedido</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600;">Monto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function emailCoordinador(
  nombre: string,
  cruzanAviso: OrdenEnMora[],
  cruzanBloqueo: OrdenEnMora[],
  todasSuyas: OrdenEnMora[],
  totales: Map<string, number>
): { subject: string; html: string } {
  const bloqueado = cruzanBloqueo.length > 0;
  const principal = bloqueado ? cruzanBloqueo[0] : cruzanAviso[0];
  const subject = bloqueado
    ? `🔴 Orden #${principal.numero} llegó a ${DIAS_BLOQUEO} días sin factura — creación de órdenes bloqueada`
    : `🟡 Orden #${principal.numero} lleva ${DIAS_AVISO} días sin factura — tienes ${DIAS_BLOQUEO - DIAS_AVISO} días`;
  const color = bloqueado ? "#dc2626" : "#f59e0b";
  const mensaje = bloqueado
    ? `Una o más de tus órdenes llegaron a <strong>${DIAS_BLOQUEO} días sin factura</strong>. Desde hoy <strong>no puedes crear órdenes de servicio nuevas</strong>. El bloqueo se libera automáticamente cuando administración reciba y suba la factura.`
    : `Una o más de tus órdenes llevan <strong>${DIAS_AVISO} días esperando la factura del transportador</strong>. Si a los ${DIAS_BLOQUEO} días sigue sin factura, <strong>no podrás crear órdenes de servicio nuevas</strong> hasta que se resuelva.`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #042726; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">Órdenes de Servicio sin factura</h1>
    </div>
    <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Hola <strong>${nombre}</strong>,</p>
      <div style="background-color: ${color}15; border-left: 4px solid ${color}; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
        <p style="margin: 0; color: ${color}; font-weight: 600;">${mensaje}</p>
      </div>
      <p>Estas son tus órdenes con más de ${DIAS_AVISO} días esperando factura:</p>
      ${tablaOrdenes(todasSuyas, totales, false)}
      <p><strong>Qué hacer:</strong> consigue la factura con el transportador y envíala a administración en Bogotá. En cuanto la orden pase a <strong>Facturada</strong>, el semáforo se limpia solo.</p>
      <p>Puedes ver el detalle en el <a href="${PORTAL_URL}" style="color: #00d084; font-weight: 600;">Portal de Coordinadores</a>.</p>
    </div>
    ${pie()}
  </div>
</body>
</html>`;
  return { subject, html };
}

function emailProveedor(
  razonSocial: string,
  pendientes: OrdenEnMora[],
  totales: Map<string, number>
): { subject: string; html: string } {
  const principal = pendientes[0];
  const subject =
    pendientes.length === 1
      ? `CampoLimpio: la orden de servicio #${principal.numero} está pendiente de factura`
      : `CampoLimpio: tiene ${pendientes.length} órdenes de servicio pendientes de factura`;
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #042726; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">Factura pendiente — Orden de Servicio</h1>
    </div>
    <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Estimado/a <strong>${razonSocial}</strong>,</p>
      <p>${pendientes.length === 1 ? "Se generó a su nombre la siguiente orden de servicio y a la fecha" : "Se generaron a su nombre las siguientes órdenes de servicio y a la fecha"} <strong>no hemos recibido la factura correspondiente</strong>:</p>
      ${tablaOrdenes(pendientes, totales, false)}
      <div style="background-color: #f59e0b15; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 0 6px 6px 0;">
        <p style="margin: 0; color: #b45309; font-weight: 600;">Por favor responda a este correo adjuntando la factura electrónica, o póngase en contacto con el coordinador de su zona o con administración de CampoLimpio.</p>
      </div>
      <p>Sin la factura no podemos avanzar con el trámite de su pago.</p>
      <p style="color: #6b7280; font-size: 13px;">Si ya envió la factura por otro medio, por favor confírmenos respondiendo este correo para verificarla.</p>
    </div>
    ${pie()}
  </div>
</body>
</html>`;
  return { subject, html };
}

function emailResumenAdmin(
  rojas: OrdenEnMora[],
  amarillas: OrdenEnMora[],
  totales: Map<string, number>
): { subject: string; html: string } {
  const total = rojas.length + amarillas.length;
  const subject = `Semáforo de facturación: ${total} ${total === 1 ? "orden" : "órdenes"} con más de ${DIAS_AVISO} días sin factura`;
  const coordsBloqueados = [...new Set(rojas.map((r) => r.coordinador || "Sin coordinador"))];
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #042726; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 20px;">Semáforo de facturación — resumen semanal</h1>
    </div>
    <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
      <p>Hola,</p>
      <p>Este es el estado de las órdenes de servicio <strong>Enviadas sin factura</strong> con más de ${DIAS_AVISO} días:</p>
      <ul style="font-size: 14px;">
        <li>🔴 <strong>${rojas.length}</strong> con ${DIAS_BLOQUEO}+ días — ${rojas.length > 0 ? `coordinadores bloqueados para crear órdenes: <strong>${coordsBloqueados.join(", ")}</strong>` : "nadie bloqueado"}</li>
        <li>🟡 <strong>${amarillas.length}</strong> entre ${DIAS_AVISO} y ${DIAS_BLOQUEO - 1} días (en aviso)</li>
      </ul>
      ${tablaOrdenes([...rojas, ...amarillas], totales, true)}
      <p>Al subir la factura de una orden (pasa a <strong>Facturada</strong>) sale del semáforo y, si el coordinador estaba bloqueado, se desbloquea automáticamente.</p>
      <p>Detalle en el <a href="${PORTAL_URL}" style="color: #00d084; font-weight: 600;">Portal de Coordinadores</a>.</p>
    </div>
    ${pie()}
  </div>
</body>
</html>`;
  return { subject, html };
}

/**
 * GET /api/cron/semaforo-facturacion
 *
 * Corre diario (Vercel cron). Dos correos:
 *  1. Aviso de cruce al coordinador: el día EXACTO en que una orden suya
 *     llega a 40 días (aviso) o a 60 días (bloqueo). El match exacto evita
 *     repetir el correo cada día sin necesidad de guardar estado; si el
 *     cron falla un día, el resumen semanal y los banners del portal cubren.
 *  2. Resumen semanal a administración: los lunes (hora Bogotá), todas las
 *     órdenes ≥40 días con su coordinador.
 *
 * Modos: ?dry=true (no envía, devuelve qué enviaría) ·
 *        ?test=true&email=x (envía muestras a ese correo, ignora día/cruce)
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const isDry = searchParams.get("dry") === "true";
  const isTest = searchParams.get("test") === "true";
  const testEmail = searchParams.get("email");

  const ahora = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
  );
  const esLunes = ahora.getDay() === 1;

  try {
    const [ordenes, coordinadores] = await Promise.all([
      getAllOrdenes(),
      getAllCoordinadoresActivos(),
    ]);
    const { rojas, amarillas } = semaforoDeOrdenes(ordenes, ahora);
    const morosas = [...rojas, ...amarillas];
    const totales = new Map(ordenes.map((o) => [o.id, o.fields.Total || 0]));
    const coordMap = new Map(coordinadores.map((c) => [c.id, c]));

    // ── 1. Avisos de cruce por coordinador ──────────────────────────────────
    const cruzanAviso = morosas.filter((o) => o.dias === DIAS_AVISO);
    const cruzanBloqueo = morosas.filter((o) => o.dias === DIAS_BLOQUEO);
    const coordsANotificar = new Map<string, { aviso: OrdenEnMora[]; bloqueo: OrdenEnMora[] }>();
    for (const o of cruzanAviso) {
      if (!o.coordinadorId) continue;
      const e = coordsANotificar.get(o.coordinadorId) || { aviso: [], bloqueo: [] };
      e.aviso.push(o);
      coordsANotificar.set(o.coordinadorId, e);
    }
    for (const o of cruzanBloqueo) {
      if (!o.coordinadorId) continue;
      const e = coordsANotificar.get(o.coordinadorId) || { aviso: [], bloqueo: [] };
      e.bloqueo.push(o);
      coordsANotificar.set(o.coordinadorId, e);
    }

    // ── 1b. Aviso al proveedor (tercero) cuando cruza los 40 días ───────────
    // El correo le pide enviar la factura respondiendo al mensaje; el
    // reply-to va a administración para que la factura llegue directo.
    const proveedoresANotificar = new Map<string, OrdenEnMora[]>();
    for (const o of cruzanAviso) {
      if (!o.beneficiarioId) continue;
      const lista = proveedoresANotificar.get(o.beneficiarioId) || [];
      lista.push(o);
      proveedoresANotificar.set(o.beneficiarioId, lista);
    }

    // En test: un solo coordinador y un solo proveedor con morosas (aunque
    // no crucen hoy).
    if (isTest && coordsANotificar.size === 0 && morosas.length > 0) {
      const o = morosas[0];
      if (o.coordinadorId) {
        coordsANotificar.set(o.coordinadorId, {
          aviso: o.dias < DIAS_BLOQUEO ? [o] : [],
          bloqueo: o.dias >= DIAS_BLOQUEO ? [o] : [],
        });
      }
    }
    if (isTest && proveedoresANotificar.size === 0 && morosas.length > 0) {
      const o = morosas[0];
      if (o.beneficiarioId) proveedoresANotificar.set(o.beneficiarioId, [o]);
    }

    // Correo del tercero: solo se consultan los que se van a notificar.
    const emailPorTercero = new Map<string, { correo: string; movil: string }>();
    for (const terceroId of proveedoresANotificar.keys()) {
      try {
        const res = await fetch(
          `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Terceros/${terceroId}`,
          { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` }, cache: "no-store" }
        );
        if (res.ok) {
          const rec = await res.json();
          emailPorTercero.set(terceroId, {
            correo: String(rec.fields?.["Correo Electrónico"] || "").trim(),
            movil: String(rec.fields?.Movil || "").trim(),
          });
        }
      } catch (err) {
        console.warn(`[semaforo] no se pudo leer tercero ${terceroId}:`, err);
      }
    }

    const enviarResumen = (isTest || esLunes) && morosas.length > 0;

    const plan = {
      hoyBogota: ahora.toISOString().slice(0, 10),
      esLunes,
      morosas: morosas.length,
      rojas: rojas.length,
      amarillas: amarillas.length,
      avisosCruce: [...coordsANotificar.entries()].map(([id, e]) => ({
        coordinador: coordMap.get(id)?.name || id,
        email: coordMap.get(id)?.email || "(sin email)",
        cruzanAviso: e.aviso.map((o) => `#${o.numero} (${o.dias}d)`),
        cruzanBloqueo: e.bloqueo.map((o) => `#${o.numero} (${o.dias}d)`),
      })),
      avisosProveedor: [...proveedoresANotificar.entries()].map(([id, ordenesProv]) => ({
        proveedor: ordenesProv[0].beneficiario || id,
        email: emailPorTercero.get(id)?.correo || "(sin correo)",
        ordenes: ordenesProv.map((o) => `#${o.numero} (${o.dias}d)`),
      })),
      resumenSemanal: enviarResumen ? { para: isTest && testEmail ? testEmail : ADMIN_EMAIL } : null,
    };

    if (isDry) {
      return NextResponse.json({ dry: true, ...plan });
    }

    const transport = crearTransporte();
    await transport.verify();
    let emailsSent = 0;
    const errors: string[] = [];

    for (const [coordId, cruces] of coordsANotificar) {
      const coord = coordMap.get(coordId);
      const destino = isTest && testEmail ? testEmail : coord?.email;
      if (!coord || !destino) {
        errors.push(`Coordinador ${coordId} sin email — no se pudo avisar`);
        continue;
      }
      const suyas = morosas.filter((o) => o.coordinadorId === coordId);
      const { subject, html } = emailCoordinador(coord.name, cruces.aviso, cruces.bloqueo, suyas, totales);
      try {
        await transport.sendMail({
          from: `"CampoLimpio - Alertas" <${process.env.EMAIL_FROM}>`,
          to: destino,
          subject: `${isTest ? "[TEST] " : ""}${subject}`,
          html,
        });
        emailsSent++;
        console.log(`[semaforo] aviso enviado a ${coord.name} (${destino})`);
      } catch (err) {
        errors.push(`Error enviando a ${destino}: ${err}`);
      }
    }

    for (const [terceroId, ordenesProv] of proveedoresANotificar) {
      const contacto = emailPorTercero.get(terceroId);
      const destino = isTest && testEmail ? testEmail : contacto?.correo;
      if (!destino) {
        errors.push(`Proveedor ${ordenesProv[0].beneficiario || terceroId} sin correo — no se pudo avisar`);
        continue;
      }
      // Copia al coordinador de la orden para que sepa que ya se le pidió.
      const ccCoord = isTest
        ? undefined
        : coordMap.get(ordenesProv[0].coordinadorId)?.email || undefined;
      const { subject, html } = emailProveedor(ordenesProv[0].beneficiario || "Proveedor", ordenesProv, totales);
      try {
        await transport.sendMail({
          from: `"CampoLimpio - Órdenes de Servicio" <${process.env.EMAIL_FROM}>`,
          to: destino,
          cc: ccCoord,
          replyTo: ADMIN_EMAIL,
          subject: `${isTest ? "[TEST] " : ""}${subject}`,
          html,
        });
        emailsSent++;
        console.log(`[semaforo] aviso a proveedor ${ordenesProv[0].beneficiario} (${destino})`);
      } catch (err) {
        errors.push(`Error enviando a proveedor ${destino}: ${err}`);
      }
    }

    if (enviarResumen) {
      const destino = isTest && testEmail ? testEmail : ADMIN_EMAIL;
      const { subject, html } = emailResumenAdmin(rojas, amarillas, totales);
      try {
        await transport.sendMail({
          from: `"CampoLimpio - Alertas" <${process.env.EMAIL_FROM}>`,
          to: destino,
          subject: `${isTest ? "[TEST] " : ""}${subject}`,
          html,
        });
        emailsSent++;
        console.log(`[semaforo] resumen semanal enviado a ${destino}`);
      } catch (err) {
        errors.push(`Error enviando resumen a ${destino}: ${err}`);
      }
    }

    return NextResponse.json({
      ...plan,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in semaforo-facturacion cron:", error);
    return NextResponse.json(
      { error: "Error interno", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
