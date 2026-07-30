/**
 * Helper para mandar mensajes de WhatsApp al agricultor fuera de flow,
 * vía la API de TextIt.
 *
 * Dos vías:
 *   1) `enviarBroadcastTelefono` — `POST /api/v2/broadcasts.json`.
 *      Solo funciona dentro del 24h. Se usa para confirmaciones inmediatas
 *      (notificarSolicitudRecibida) donde el agricultor acaba de escribir.
 *
 *   2) `enviarAvisoActualizacionSolicitud` — `POST /api/v2/flow_starts.json`,
 *      dispara el flow `31-aviso-cierre` que internamente decide:
 *        - dentro del 24h → manda texto libre (fallback del nodo)
 *        - fuera del 24h → manda template aprobado `actualizacion_solicitud`
 *      Esto es OBLIGATORIO para avisos de cierre (aprobado/rechazado/anulado)
 *      porque el agricultor puede no haber escrito al bot en >24h.
 *
 *      ¿Por qué un flow y no la API directa? La API pública de TextIt
 *      (BroadcastWriteSerializer) NO acepta `template` ni `template_variables`
 *      — esos campos del modelo Broadcast son privados a la UI. La única
 *      forma de disparar una plantilla aprobada por API es vía flow que
 *      tenga el nodo "Send WhatsApp Template" configurado.
 *
 * El flow `31-aviso-cierre` tiene un único nodo "Send Message" con la
 * plantilla `actualizacion_solicitud` (es) seleccionada y 3 variables
 * leyendo `@trigger.params.var1`, `@trigger.params.var2`, `@trigger.params.var3`.
 *
 * Configuración:
 *   TEXTIT_API_TOKEN              — bearer de la cuenta de TextIt
 *   TEXTIT_API_URL                — default https://textit.com/api/v2
 *   TEXTIT_CHANNEL_UUID (opcional) — para forzar canal específico
 *   TEXTIT_FLOW_AVISO_CIERRE_UUID — UUID del flow `31-aviso-cierre`
 *
 * Falla silencioso (loggea pero no rompe) — la notificación es nice-to-have,
 * no debe bloquear la acción principal.
 */

const TEXTIT_API_TOKEN = process.env.TEXTIT_API_TOKEN;
const TEXTIT_API_URL = (process.env.TEXTIT_API_URL || "https://textit.com/api/v2").replace(/\/$/, "");
const TEXTIT_CHANNEL_UUID = process.env.TEXTIT_CHANNEL_UUID || "";
const TEXTIT_FLOW_AVISO_CIERRE_UUID = process.env.TEXTIT_FLOW_AVISO_CIERRE_UUID || "";
const TEXTIT_FLOW_ABRIR_TICKET_UUID = process.env.TEXTIT_FLOW_ABRIR_TICKET_UUID || "";

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

/**
 * Dispara el flow `31-aviso-cierre` en TextIt, que envía la plantilla
 * aprobada `actualizacion_solicitud` (UTILITY, es) al agricultor. Funciona
 * dentro y fuera del 24h:
 *   - Dentro del 24h, el nodo del flow tiene texto libre como fallback.
 *   - Fuera del 24h, TextIt manda el template aprobado a 360Dialog.
 *
 * Variables del template (cuerpo aprobado por Meta):
 *   {{1}} = descriptor de la solicitud (ej. "#1234 de certificado",
 *           "de registro como generador", "de nueva finca \"Las Flores\"")
 *   {{2}} = estado en participio (ej. "aprobada", "rechazada", "anulada")
 *   {{3}} = detalle libre (ej. "Descarga el PDF: https://...",
 *           "Motivo: faltó foto", "Ya puedes generar certificados...")
 *
 * Si TEXTIT_FLOW_AVISO_CIERRE_UUID no está configurado, retorna ok:false
 * (útil para entornos dev/test).
 */
export async function enviarAvisoActualizacionSolicitud(
  telefono: string,
  var1: string,
  var2: string,
  var3: string
): Promise<BroadcastResult> {
  if (!TEXTIT_API_TOKEN) {
    console.warn("[textitNotify] TEXTIT_API_TOKEN no configurado — skip");
    return { ok: false, message: "TEXTIT_API_TOKEN no configurado" };
  }
  if (!TEXTIT_FLOW_AVISO_CIERRE_UUID) {
    console.warn(
      "[textitNotify] TEXTIT_FLOW_AVISO_CIERRE_UUID no configurado — skip"
    );
    return {
      ok: false,
      message: "TEXTIT_FLOW_AVISO_CIERRE_UUID no configurado",
    };
  }
  const tel10 = telefono.replace(/\D/g, "").slice(-10);
  if (tel10.length !== 10) {
    return { ok: false, message: `Teléfono inválido: ${telefono}` };
  }
  // TextIt rechaza el "+" en URNs (mismo motivo que en broadcasts).
  const urn = `whatsapp:57${tel10}`;

  const body: Record<string, unknown> = {
    flow: TEXTIT_FLOW_AVISO_CIERRE_UUID,
    urns: [urn],
    restart_participants: true,
    params: {
      var1,
      var2,
      var3,
    },
  };

  try {
    const r = await fetch(`${TEXTIT_API_URL}/flow_starts.json`, {
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
        `[textitNotify] flow_starts falló (${r.status}):`,
        JSON.stringify(data).slice(0, 300)
      );
      return {
        ok: false,
        message: `TextIt ${r.status}: ${JSON.stringify(data).slice(0, 100)}`,
      };
    }
    return {
      ok: true,
      message: "Flow aviso-cierre disparado",
    };
  } catch (err) {
    console.error("[textitNotify] Error flow_starts:", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Dispara el flow `32-abrir-ticket`: abre un ticket en TextIt para el
 * contacto (asignado al agente de atención) y el flow llama de vuelta a
 * `/api/whatsapp/aviso-ticket` con el UUID del ticket, que es quien manda
 * el email con el enlace directo.
 *
 * Se usa cuando alguien pide "hablar con una persona" y no tiene
 * coordinador asignado. `tema` viaja como @trigger.params.tema y queda como
 * nota del ticket.
 */
export async function iniciarFlowAbrirTicket(
  telefono: string,
  tema: string
): Promise<BroadcastResult> {
  if (!TEXTIT_API_TOKEN) {
    console.warn("[textitNotify] TEXTIT_API_TOKEN no configurado — skip");
    return { ok: false, message: "TEXTIT_API_TOKEN no configurado" };
  }
  if (!TEXTIT_FLOW_ABRIR_TICKET_UUID) {
    console.warn(
      "[textitNotify] TEXTIT_FLOW_ABRIR_TICKET_UUID no configurado — skip"
    );
    return {
      ok: false,
      message: "TEXTIT_FLOW_ABRIR_TICKET_UUID no configurado",
    };
  }
  const tel10 = telefono.replace(/\D/g, "").slice(-10);
  if (tel10.length !== 10) {
    return { ok: false, message: `Teléfono inválido: ${telefono}` };
  }
  // TextIt rechaza el "+" en URNs (mismo motivo que en broadcasts).
  const urn = `whatsapp:57${tel10}`;

  try {
    const r = await fetch(`${TEXTIT_API_URL}/flow_starts.json`, {
      method: "POST",
      headers: {
        Authorization: `Token ${TEXTIT_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        flow: TEXTIT_FLOW_ABRIR_TICKET_UUID,
        urns: [urn],
        restart_participants: true,
        params: { tema },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(
        `[textitNotify] flow abrir-ticket falló (${r.status}):`,
        JSON.stringify(data).slice(0, 300)
      );
      return {
        ok: false,
        message: `TextIt ${r.status}: ${JSON.stringify(data).slice(0, 100)}`,
      };
    }
    return { ok: true, message: "Flow abrir-ticket disparado" };
  } catch (err) {
    console.error("[textitNotify] Error flow abrir-ticket:", err);
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

/**
 * Sube un archivo remoto al storage de TextIt (POST /media.json) y
 * devuelve el attachment listo ("content_type:url"). La API de
 * broadcasts NO acepta URLs externas como adjunto ("No such object",
 * verificado 2026-06-11) — solo media de su propio storage.
 */
async function subirMediaTextIt(
  fileUrl: string,
  filename: string
): Promise<string | null> {
  if (!TEXTIT_API_TOKEN) return null;
  try {
    const archivo = await fetch(fileUrl, { cache: "no-store" });
    if (!archivo.ok) return null;
    const blob = await archivo.blob();
    const form = new FormData();
    form.append("file", blob, filename);
    const r = await fetch(`${TEXTIT_API_URL}/media.json`, {
      method: "POST",
      headers: { Authorization: `Token ${TEXTIT_API_TOKEN}` },
      body: form,
    });
    if (!r.ok) {
      console.warn(`[textitNotify] media.json falló (${r.status})`);
      return null;
    }
    const d = (await r.json()) as { content_type?: string; url?: string };
    if (!d.content_type || !d.url) return null;
    return `${d.content_type}:${d.url}`;
  } catch (err) {
    console.warn("[textitNotify] subirMediaTextIt error:", err);
    return null;
  }
}

export async function notificarCertAprobado(
  p: AprobadoCertParams
): Promise<BroadcastResult> {
  // Dentro de 24h: texto bonito + PDF como documento adjunto (subido al
  // storage de TextIt — no acepta URLs externas).
  // Fuera de 24h: template plano del flow 31 con el link en var3
  // (el template de Meta no soporta adjuntos).
  let attachment: string | null = null;
  if (p.pdfUrl && (await ventana24hAbierta(p.telefono))) {
    attachment = await subirMediaTextIt(
      p.pdfUrl,
      `certificado_${p.consecutivo}.pdf`
    );
  }
  const textoLibre =
    `🎉 *¡Tu certificado fue aprobado!*\n\n` +
    `📄 *Certificado #${p.consecutivo}*\n` +
    `👤 *Coordinador:* ${p.nombreCoordinador}\n\n` +
    (attachment
      ? `Aquí tienes tu certificado en PDF. 👆`
      : p.pdfUrl
        ? `Descárgalo aquí: ${p.pdfUrl}`
        : `El PDF te llegará también por email.`);

  const var1 = `#${p.consecutivo} de certificado`;
  const var2 = "aprobada";
  const detalle = p.pdfUrl
    ? `Descarga el PDF: ${p.pdfUrl}`
    : "El PDF te llegará también por email.";
  const var3 = `Coordinador: ${p.nombreCoordinador}. ${detalle}`;
  return enviarConFallback(
    p.telefono,
    textoLibre,
    var1,
    var2,
    var3,
    attachment ? [attachment] : undefined
  );
}

export interface RechazadoCertParams {
  telefono: string;
  consecutivo?: number;
  motivo: string;
  nombreCoordinador: string;
  /** wa.me corto del coord (sin ?text=) para resolver dudas del rechazo. */
  coordContactoWaUrl?: string;
}

export async function notificarCertRechazado(
  p: RechazadoCertParams
): Promise<BroadcastResult> {
  const solicitudLbl = p.consecutivo ? `#${p.consecutivo}` : "";
  const contacto = p.coordContactoWaUrl
    ? `Si necesitas más información, escríbele a tu coordinador:\n👉 ${p.coordContactoWaUrl}`
    : `Si necesitas más información, escríbele a tu coordinador. 💬`;
  const textoLibre =
    `❌ *Tu solicitud de certificado ${solicitudLbl} fue rechazada.*\n\n` +
    `📋 *Motivo:* ${p.motivo}\n` +
    `👤 *Coordinador:* ${p.nombreCoordinador}\n\n` +
    contacto;
  const var1 = p.consecutivo
    ? `#${p.consecutivo} de certificado`
    : "de certificado";
  const var2 = "rechazada";
  const var3 = `Motivo: ${p.motivo}. Coordinador: ${p.nombreCoordinador}. ${p.coordContactoWaUrl ? `Si necesitas más información, escríbele a tu coordinador: ${p.coordContactoWaUrl}` : "Si necesitas más información, escríbele a tu coordinador."}`;
  return enviarConFallback(p.telefono, textoLibre, var1, var2, var3);
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
  const textoLibre =
    `⚠️ *Tu certificado #${p.consecutivo} fue anulado.*\n\n` +
    `📋 *Motivo:* ${p.motivo}\n` +
    `👤 *Anulado por:* ${p.nombreCoordinador}\n\n` +
    `Este certificado ya no es válido. Si necesitas uno nuevo, contacta a tu coordinador. 💬`;
  const var1 = `#${p.consecutivo} de certificado`;
  const var2 = "anulada";
  const var3 = `Motivo: ${p.motivo}. Por: ${p.nombreCoordinador}. Este certificado ya no es válido. Si necesitas uno nuevo, contacta a tu coordinador.`;
  return enviarConFallback(p.telefono, textoLibre, var1, var2, var3);
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

// ─── Plantillas: solicitud recibida (apenas el agricultor termina) ─────────

export interface SolicitudRecibidaParams {
  telefono: string;
  tipo: "cert" | "registro-generador" | "crear-finca" | "editar-finca" | "editar-generador";
  consecutivo?: number;
  /** Resumen de los datos enviados, mostrado al agricultor para que pueda
   *  detectar errores antes de que el coord revise. */
  resumen?: string;
  /** wa.me corto del coord para contactarlo si detecta un error. Se incluye
   *  como call-to-action debajo del resumen. */
  coordContactoWaUrl?: string;
  /** Nombre del coordinador asignado — se intercala en el detalle para
   *  que el agricultor sepa exactamente quién va a revisar la solicitud. */
  nombreCoordinador?: string;
}

export async function notificarSolicitudRecibida(
  p: SolicitudRecibidaParams
): Promise<BroadcastResult> {
  let titulo = "✅ ¡Recibimos tu solicitud!";
  let detalle = "";
  const coord = p.nombreCoordinador ? `*${p.nombreCoordinador}*` : "tu coordinador";
  // Variantes de "tu coordinador" en mayúscula y minúscula según contexto:
  const coordCap = p.nombreCoordinador
    ? `Tu coordinador *${p.nombreCoordinador}*`
    : "Tu coordinador";

  switch (p.tipo) {
    case "cert":
      titulo = "✅ ¡Recibimos tu solicitud de certificado!";
      detalle = p.consecutivo
        ? `Solicitud #${p.consecutivo}. ${coordCap} la revisará y aprobará. Te aviso por aquí cuando esté lista. 👋`
        : `${coordCap} la revisará y aprobará. Te aviso por aquí cuando esté lista. 👋`;
      break;
    case "registro-generador":
      titulo = "✅ ¡Recibimos tu solicitud de registro!";
      detalle = `${coordCap} revisará tus datos y te aviso por aquí. Recuerda: los certificados se generan por finca — podrás pedirlos cuando tu finca esté registrada y aprobada. 🌱`;
      break;
    case "crear-finca":
      titulo = "✅ ¡Recibimos tu solicitud de nueva finca!";
      detalle = `${coordCap} la revisará y aprobará. Te aviso por aquí cuando esté lista. 👋`;
      break;
    case "editar-finca":
      titulo = "✅ ¡Recibimos tu solicitud de cambios en la finca!";
      detalle = `${coordCap} los revisará. Te aviso por aquí cuando estén aprobados. 👋`;
      break;
    case "editar-generador":
      titulo = "✅ ¡Recibimos tu solicitud de cambios en tus datos!";
      detalle = `${coordCap} los revisará. Te aviso por aquí cuando estén aprobados. 👋`;
      break;
  }
  // Silenciar warning de unused — coord queda disponible si quieren usarla.
  void coord;

  const partes = [titulo];
  if (p.resumen && p.resumen.trim()) {
    partes.push(`📋 *Estos son los datos que registramos:*\n${p.resumen.trim()}`);
    if (p.coordContactoWaUrl) {
      partes.push(
        `_Si ves un error, escríbele a tu coordinador antes:_\n👉 ${p.coordContactoWaUrl}`
      );
    } else {
      partes.push(
        "_Si ves un error, escríbele a tu coordinador antes de que apruebe._"
      );
    }
  }
  partes.push(detalle);

  const texto = partes.join("\n\n");
  return enviarBroadcastTelefono(p.telefono, texto);
}

// ─── Plantillas Generador / Finca ──────────────────────────────────────────

/**
 * ¿Está abierta la ventana de 24h de WhatsApp para este teléfono?
 *
 * La ventana se abre cada vez que el contacto escribe; `last_seen_on` de
 * TextIt registra exactamente eso. Margen de 23h para no enviar al filo.
 *
 * IMPORTANTE (verificado 2026-06-11 con prueba real): un broadcast de
 * texto libre fuera de ventana NO falla en la API — devuelve 200 y el
 * mensaje muere asíncrono con status=failed. Por eso hay que decidir
 * ANTES de enviar; el fallback por HTTP status nunca se dispara.
 *
 * Si no se puede determinar (contacto no existe, error de red), se asume
 * CERRADA → template, que funciona en cualquier caso.
 */
async function ventana24hAbierta(telefono: string): Promise<boolean> {
  if (!TEXTIT_API_TOKEN) return false;
  const tel10 = telefono.replace(/\D/g, "").slice(-10);
  if (tel10.length !== 10) return false;
  try {
    const r = await fetch(
      `${TEXTIT_API_URL}/contacts.json?urn=${encodeURIComponent(`whatsapp:57${tel10}`)}`,
      { headers: { Authorization: `Token ${TEXTIT_API_TOKEN}` }, cache: "no-store" }
    );
    if (!r.ok) return false;
    const d = (await r.json()) as {
      results: Array<{ last_seen_on?: string | null }>;
    };
    const lastSeen = d.results?.[0]?.last_seen_on;
    if (!lastSeen) return false;
    const horas = (Date.now() - new Date(lastSeen).getTime()) / 3_600_000;
    return horas < 23;
  } catch {
    return false;
  }
}

/**
 * Envía texto libre formateado (bullets/bold/emojis) si la ventana de
 * 24h está abierta; si no, va directo al template aprobado vía flow 31.
 * `attachments` (formato "mimetype:url") solo aplican a la vía texto
 * libre — el template es de texto plano, ahí va el link dentro de var3.
 */
async function enviarConFallback(
  telefono: string,
  textoLibre: string,
  var1: string,
  var2: string,
  var3: string,
  attachments?: string[]
): Promise<BroadcastResult> {
  if (await ventana24hAbierta(telefono)) {
    const r = await enviarBroadcastTelefono(telefono, textoLibre, attachments);
    if (r.ok) return r;
    console.warn(
      `[textitNotify] Broadcast directo falló (${r.message}), reintentando con template via flow`
    );
  } else {
    console.log(
      `[textitNotify] Ventana 24h cerrada para ${telefono.slice(-4)} — template directo`
    );
  }
  return enviarAvisoActualizacionSolicitud(telefono, var1, var2, var3);
}

export async function notificarGeneradorAprobado(p: {
  telefono: string;
  nombre: string;
  nombreCoordinador: string;
  esRevision?: boolean;
  /** ¿Tiene al menos una finca APROBADA en este momento? Los certificados
   *  se generan por finca: prometer "ya puedes generar certificados" sin
   *  finca aprobada confunde a la gente (reporte cliente 2026-07-30). */
  tieneFincaAprobada?: boolean;
}): Promise<BroadcastResult> {
  let textoLibre: string;
  let var1: string;
  let var3: string;
  if (p.esRevision) {
    textoLibre =
      `✅ *¡Tus cambios fueron aprobados!*\n\n` +
      `📋 *Datos actualizados:*\n` +
      `• Nombre: *${p.nombre}*\n` +
      `• Coordinador: ${p.nombreCoordinador}\n\n` +
      `Tus datos ya están firmes. 👍`;
    var1 = "de cambios en tus datos";
    var3 = `Nombre: ${p.nombre}. Coordinador: ${p.nombreCoordinador}. Tus datos actualizados ya están firmes.`;
  } else if (p.tieneFincaAprobada) {
    textoLibre =
      `🎉 *¡Tu registro fue aprobado!*\n\n` +
      `📋 *Datos:*\n` +
      `• Nombre: *${p.nombre}*\n` +
      `• Coordinador: ${p.nombreCoordinador}\n\n` +
      `Ya puedes generar certificados desde el bot. Escríbeme cualquier mensaje para empezar. 👋`;
    var1 = "de registro como generador";
    var3 = `Nombre: ${p.nombre}. Coordinador: ${p.nombreCoordinador}. Ya puedes generar certificados desde el bot. Escríbeme cualquier mensaje para empezar.`;
  } else {
    // Registro aprobado pero SIN finca aprobada todavía: dejar claro que el
    // certificado se genera por finca y que falta ese paso.
    textoLibre =
      `🎉 *¡Tu registro fue aprobado!*\n\n` +
      `📋 *Datos:*\n` +
      `• Nombre: *${p.nombre}*\n` +
      `• Coordinador: ${p.nombreCoordinador}\n\n` +
      `⚠️ *Importante:* los certificados se generan por finca. Cuando tu finca quede registrada y aprobada te aviso por aquí — desde ese momento podrás pedirlos. 🌱`;
    var1 = "de registro como generador";
    var3 = `Nombre: ${p.nombre}. Coordinador: ${p.nombreCoordinador}. Importante: los certificados se generan por finca — te avisaremos cuando tu finca quede aprobada para que puedas pedirlos.`;
  }
  return enviarConFallback(p.telefono, textoLibre, var1, "aprobada", var3);
}

export async function notificarGeneradorRechazado(p: {
  telefono: string;
  nombre: string;
  motivo: string;
  nombreCoordinador: string;
  esRevision?: boolean;
  /** wa.me corto del coordinador (ej. "wa.me/573001234567"). */
  coordContactoWaUrl?: string;
}): Promise<BroadcastResult> {
  const contacto = p.coordContactoWaUrl
    ? `Si tienes dudas, escríbele a tu coordinador:\n👉 ${p.coordContactoWaUrl}`
    : `Si tienes dudas, escríbele a tu coordinador. 💬`;
  const contactoPlano = p.coordContactoWaUrl
    ? `Si tienes dudas, escríbele a tu coordinador: ${p.coordContactoWaUrl}`
    : `Si tienes dudas, escríbele a tu coordinador.`;
  let textoLibre: string;
  let var1: string;
  let var3: string;
  if (p.esRevision) {
    textoLibre =
      `❌ *Tus cambios fueron rechazados.*\n\n` +
      `📋 *Detalle:*\n` +
      `• Motivo: ${p.motivo}\n` +
      `• Coordinador: ${p.nombreCoordinador}\n\n` +
      `Tus datos vuelven al estado anterior. ${contacto}`;
    var1 = "de cambios en tus datos";
    var3 = `Motivo: ${p.motivo}. Coordinador: ${p.nombreCoordinador}. Tus datos vuelven al estado anterior. ${contactoPlano}`;
  } else {
    textoLibre =
      `❌ *Tu registro fue rechazado.*\n\n` +
      `📋 *Detalle:*\n` +
      `• Motivo: ${p.motivo}\n` +
      `• Coordinador: ${p.nombreCoordinador}\n\n` +
      contacto;
    var1 = "de registro como generador";
    var3 = `Motivo: ${p.motivo}. Coordinador: ${p.nombreCoordinador}. ${contactoPlano}`;
  }
  return enviarConFallback(p.telefono, textoLibre, var1, "rechazada", var3);
}

export async function notificarFincaAprobada(p: {
  telefono: string;
  nombreFinca: string;
  nombreCoordinador: string;
  esRevision?: boolean;
}): Promise<BroadcastResult> {
  const textoLibre = p.esRevision
    ? `✅ *¡Los cambios en tu finca fueron aprobados!*\n\n` +
      `🌱 *Finca:* ${p.nombreFinca}\n` +
      `👤 *Coordinador:* ${p.nombreCoordinador}\n\n` +
      `Los datos actualizados ya están firmes. 👍`
    : `🎉 *¡Tu finca fue aprobada!*\n\n` +
      `🌱 *Finca:* ${p.nombreFinca}\n` +
      `👤 *Coordinador:* ${p.nombreCoordinador}\n\n` +
      `📄 *Genera tu primer certificado así:* escríbeme cualquier mensaje (por ejemplo "hola") y elige *1️⃣ Solicitar un nuevo certificado*.`;
  const var1 = p.esRevision
    ? `de cambios en la finca "${p.nombreFinca}"`
    : `de nueva finca "${p.nombreFinca}"`;
  const detalle = p.esRevision
    ? "Los datos actualizados ya están firmes."
    : `Genera tu primer certificado así: escríbenos cualquier mensaje (por ejemplo "hola") y elige la opción 1, Solicitar un nuevo certificado.`;
  const var3 = `Coordinador: ${p.nombreCoordinador}. ${detalle}`;
  return enviarConFallback(p.telefono, textoLibre, var1, "aprobada", var3);
}

export async function notificarFincaRechazada(p: {
  telefono: string;
  nombreFinca: string;
  motivo: string;
  nombreCoordinador: string;
  esRevision?: boolean;
  /** wa.me corto del coordinador (ej. "wa.me/573001234567"). */
  coordContactoWaUrl?: string;
}): Promise<BroadcastResult> {
  const contacto = p.coordContactoWaUrl
    ? `Si tienes dudas, escríbele a tu coordinador:\n👉 ${p.coordContactoWaUrl}`
    : `Si tienes dudas, escríbele a tu coordinador. 💬`;
  const contactoPlano = p.coordContactoWaUrl
    ? `Si tienes dudas, escríbele a tu coordinador: ${p.coordContactoWaUrl}`
    : `Si tienes dudas, escríbele a tu coordinador.`;
  const textoLibre = p.esRevision
    ? `❌ *Los cambios en tu finca fueron rechazados.*\n\n` +
      `🌱 *Finca:* ${p.nombreFinca}\n` +
      `📋 *Motivo:* ${p.motivo}\n` +
      `👤 *Coordinador:* ${p.nombreCoordinador}\n\n` +
      `Los datos de la finca vuelven al estado anterior. ${contacto}`
    : `❌ *Tu finca fue rechazada.*\n\n` +
      `🌱 *Finca:* ${p.nombreFinca}\n` +
      `📋 *Motivo:* ${p.motivo}\n` +
      `👤 *Coordinador:* ${p.nombreCoordinador}\n\n` +
      contacto;
  const var1 = p.esRevision
    ? `de cambios en la finca "${p.nombreFinca}"`
    : `de nueva finca "${p.nombreFinca}"`;
  const var3 = `Motivo: ${p.motivo}. Coordinador: ${p.nombreCoordinador}. ${contactoPlano}`;
  return enviarConFallback(p.telefono, textoLibre, var1, "rechazada", var3);
}
