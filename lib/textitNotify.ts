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
  // Vía flow `31-aviso-cierre` para que TextIt mande template fuera del 24h.
  // Wording del template (aprobado en Meta):
  //   "Tu solicitud {{1}} fue {{2}}.\n\n{{3}}"
  const var1 = `#${p.consecutivo} de certificado`;
  const var2 = "aprobada";
  const detalle = p.pdfUrl
    ? `Descarga el PDF: ${p.pdfUrl}`
    : "El PDF te llegará también por email.";
  const var3 = `Coordinador: ${p.nombreCoordinador}. ${detalle}`;
  return enviarAvisoActualizacionSolicitud(p.telefono, var1, var2, var3);
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
  const var1 = p.consecutivo
    ? `#${p.consecutivo} de certificado`
    : "de certificado";
  const var2 = "rechazada";
  const var3 = `Motivo: ${p.motivo}. Coordinador: ${p.nombreCoordinador}. Si necesitas más información, escríbele a tu coordinador.`;
  return enviarAvisoActualizacionSolicitud(p.telefono, var1, var2, var3);
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
  const var1 = `#${p.consecutivo} de certificado`;
  const var2 = "anulada";
  const var3 = `Motivo: ${p.motivo}. Por: ${p.nombreCoordinador}. Este certificado ya no es válido. Si necesitas uno nuevo, contacta a tu coordinador.`;
  return enviarAvisoActualizacionSolicitud(p.telefono, var1, var2, var3);
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
}

export async function notificarSolicitudRecibida(
  p: SolicitudRecibidaParams
): Promise<BroadcastResult> {
  let titulo = "✅ ¡Recibimos tu solicitud!";
  let detalle = "";

  switch (p.tipo) {
    case "cert":
      titulo = "✅ ¡Recibimos tu solicitud de certificado!";
      detalle = p.consecutivo
        ? `Solicitud #${p.consecutivo}. Tu coordinador la revisará y aprobará. Te aviso por aquí cuando esté lista. 👋`
        : "Tu coordinador la revisará y aprobará. Te aviso por aquí cuando esté lista. 👋";
      break;
    case "registro-generador":
      titulo = "✅ ¡Recibimos tu solicitud de registro!";
      detalle =
        "Tu coordinador revisará tus datos y te avisará cuando esté aprobado para que puedas empezar a generar certificados. 👋";
      break;
    case "crear-finca":
      titulo = "✅ ¡Recibimos tu solicitud de nueva finca!";
      detalle =
        "Tu coordinador la revisará y aprobará. Te aviso por aquí cuando esté lista. 👋";
      break;
    case "editar-finca":
      titulo = "✅ ¡Recibimos tu solicitud de cambios en la finca!";
      detalle =
        "Tu coordinador los revisará. Te aviso por aquí cuando estén aprobados. 👋";
      break;
    case "editar-generador":
      titulo = "✅ ¡Recibimos tu solicitud de cambios en tus datos!";
      detalle =
        "Tu coordinador los revisará. Te aviso por aquí cuando estén aprobados. 👋";
      break;
  }

  const partes = [titulo];
  if (p.resumen && p.resumen.trim()) {
    partes.push(`📋 *Estos son los datos que registramos:*\n${p.resumen.trim()}`);
    partes.push(
      "_Si ves un error, escríbele a tu coordinador antes de que apruebe._"
    );
  }
  partes.push(detalle);

  const texto = partes.join("\n\n");
  return enviarBroadcastTelefono(p.telefono, texto);
}

// ─── Plantillas Generador / Finca ──────────────────────────────────────────

export async function notificarGeneradorAprobado(p: {
  telefono: string;
  nombre: string;
  nombreCoordinador: string;
}): Promise<BroadcastResult> {
  const var1 = "de registro como generador";
  const var2 = "aprobada";
  const var3 = `Nombre: ${p.nombre}. Coordinador: ${p.nombreCoordinador}. Ya puedes generar certificados desde el bot. Escríbeme cualquier mensaje para empezar.`;
  return enviarAvisoActualizacionSolicitud(p.telefono, var1, var2, var3);
}

export async function notificarGeneradorRechazado(p: {
  telefono: string;
  nombre: string;
  motivo: string;
  nombreCoordinador: string;
}): Promise<BroadcastResult> {
  const var1 = "de registro como generador";
  const var2 = "rechazada";
  const var3 = `Motivo: ${p.motivo}. Coordinador: ${p.nombreCoordinador}. Si tienes dudas, escríbele a tu coordinador.`;
  return enviarAvisoActualizacionSolicitud(p.telefono, var1, var2, var3);
}

export async function notificarFincaAprobada(p: {
  telefono: string;
  nombreFinca: string;
  nombreCoordinador: string;
  esRevision?: boolean;
}): Promise<BroadcastResult> {
  const var1 = p.esRevision
    ? `de cambios en la finca "${p.nombreFinca}"`
    : `de nueva finca "${p.nombreFinca}"`;
  const var2 = "aprobada";
  const detalle = p.esRevision
    ? "Los datos actualizados ya están firmes."
    : "Ya puedes generar certificados para esta finca.";
  const var3 = `Coordinador: ${p.nombreCoordinador}. ${detalle}`;
  return enviarAvisoActualizacionSolicitud(p.telefono, var1, var2, var3);
}

export async function notificarFincaRechazada(p: {
  telefono: string;
  nombreFinca: string;
  motivo: string;
  nombreCoordinador: string;
  esRevision?: boolean;
}): Promise<BroadcastResult> {
  const var1 = p.esRevision
    ? `de cambios en la finca "${p.nombreFinca}"`
    : `de nueva finca "${p.nombreFinca}"`;
  const var2 = "rechazada";
  const var3 = `Motivo: ${p.motivo}. Coordinador: ${p.nombreCoordinador}. Si tienes dudas, escríbele a tu coordinador.`;
  return enviarAvisoActualizacionSolicitud(p.telefono, var1, var2, var3);
}
