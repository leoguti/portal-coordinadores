/**
 * POST /api/whatsapp/intent
 *
 * Segundo paso del flow TextIt: el agricultor ya recibió el menú y eligió un
 * número. Este endpoint re-identifica al agricultor (no confía en estado del
 * cliente), valida que la opción es válida para su rol+estado, y resuelve el
 * intent → genera un magic-link o realiza la acción (contactar-coord).
 *
 * Auth: Bearer ${WHATSAPP_BOT_API_KEY}.
 *
 * Body:  { telefono, opcion: number }
 * Resp:  { url, expira_min, mensaje_ok } o { url: null, mensaje_ok } para
 *        intents que no generan link (ej. contactar-coord).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  identificarAgricultor,
  type IdentidadAgricultor,
} from "@/lib/whatsappResolver";
import { identificarCoordinadorPorTelefono } from "@/lib/coordinadorResolver";
import { crearToken, type Intent } from "@/lib/edicionTokens";
import { getCultivosMap } from "@/lib/cultivosCache";
import { normalizarMovilCO } from "@/lib/validacionesCO";

const WHATSAPP_BOT_API_KEY = process.env.WHATSAPP_BOT_API_KEY;
const PORTAL_BASE = process.env.NEXTAUTH_URL || "https://portal.campolimpio.org";
const TTL_MIN = Number(process.env.EDICION_TOKEN_TTL_MIN || 30);

type MenuIntent =
  | "cert-nuevo"
  | "editar-datos-personales"
  | "editar-finca"
  | "editar-perfil"
  | "crear-finca"
  | "registro-generador"
  | "contactar-coord";

function validateApiKey(request: NextRequest): boolean {
  if (!WHATSAPP_BOT_API_KEY) return false;
  const auth = request.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "") === WHATSAPP_BOT_API_KEY;
}

/**
 * Reconstruye el menú actual del agricultor para validar `opcion`. Debe quedar
 * en sincronía exacta con /api/whatsapp/identificar.
 */
function opcionesParaIdentidad(identidad: IdentidadAgricultor): MenuIntent[] {
  // Titular
  if (identidad.rol === "titular") {
    // Generador con cambios pendientes → menú reducido (sin cert).
    if (identidad.generador?.estado === "pendiente_revision") {
      return ["editar-perfil", "contactar-coord"];
    }
    const fincasAprobadas = identidad.fincas.filter((f) => f.estado === "aprobado");
    if (fincasAprobadas.length === 0) {
      // Si TIENE fincas pero todas en revisión → bloqueado, menú reducido
      if (identidad.fincas.length > 0) {
        return ["editar-datos-personales", "contactar-coord"];
      }
      // Si NO tiene fincas → puede crear su primera
      return ["crear-finca", "editar-datos-personales", "contactar-coord"];
    }
    // Caso normal: con fincas aprobadas, menú colapsado a 4 opciones.
    return [
      "cert-nuevo",
      "editar-perfil",
      "crear-finca",
      "contactar-coord",
    ];
  }
  // Admin de finca
  if (identidad.rol === "admin_finca") {
    const fincasAprobadas = identidad.fincas.filter((f) => f.estado === "aprobado");
    // Todas sus fincas en revisión → no puede pedir cert, solo editar o coord.
    if (fincasAprobadas.length === 0) {
      return ["editar-finca", "contactar-coord"];
    }
    return ["cert-nuevo", "editar-finca", "contactar-coord"];
  }
  // Desconocido
  return ["registro-generador", "contactar-coord"];
}

/** Traduce el intent del menú al intent real persistido en el token. */
function intentRealParaMenu(
  menu: MenuIntent,
  identidad: IdentidadAgricultor
): Intent | "contactar-coord" {
  switch (menu) {
    case "contactar-coord":
      return "contactar-coord";
    case "cert-nuevo":
      return "cert-nuevo";
    case "crear-finca":
      return "crear-finca";
    case "registro-generador":
      return "registro-generador";
    case "editar-datos-personales":
      // Admin_finca no debería llegar aquí (no aparece en su menú); defensivo.
      if (identidad.rol !== "titular") return "contactar-coord";
      return "editar-generador";
    case "editar-finca":
      return "editar-finca";
    case "editar-perfil":
      return "editar-perfil";
  }
}

function urlParaIntent(intent: Intent, token: string): string {
  const base = PORTAL_BASE.replace(/\/$/, "");
  switch (intent) {
    case "cert-nuevo":
      return `${base}/m/cert/${token}`;
    case "cert-coordinador":
      // No se alcanza: el flujo coordinador se resuelve antes en el POST.
      return `${base}/m/cert-coord/${token}`;
    case "aprobar-cert":
      // No se alcanza: este token no nace del bot sino del email al coord.
      return `${base}/m/aprobar-cert/${token}`;
    case "editar-finca":
      return `${base}/m/finca/${token}`;
    case "editar-generador":
      return `${base}/m/generador/${token}`;
    case "editar-perfil":
      return `${base}/m/perfil/${token}`;
    case "crear-finca":
      return `${base}/m/nueva-finca/${token}`;
    case "registro-generador":
      return `${base}/m/nuevo-generador/${token}`;
  }
}

function recordIdParaToken(
  intent: Intent,
  identidad: IdentidadAgricultor
): string | null {
  switch (intent) {
    case "cert-nuevo": {
      // Solo fincas APROBADAS pueden recibir cert. Si queda 1, la
      // pre-seleccionamos; si hay varias, selector en el form (el contexto
      // también va filtrado a aprobadas).
      const aprobadas = identidad.fincas.filter((f) => f.estado === "aprobado");
      return aprobadas.length === 1 ? aprobadas[0].id : null;
    }
    case "editar-finca":
      // Admin_finca: única finca que matcheó. Titular: la primera (selector
      // en el form si hay varias).
      return identidad.fincas[0]?.id || null;
    case "editar-generador":
      return identidad.generador?.id || null;
    case "editar-perfil":
      return identidad.generador?.id || null;
    case "crear-finca":
      return identidad.generador?.id || null;
    case "registro-generador":
      return null;
    case "cert-coordinador":
      // No se alcanza: el flujo coordinador se resuelve antes en el POST.
      return null;
    case "aprobar-cert":
      // No se alcanza: este token no nace del bot sino del email al coord.
      return null;
  }
}

async function manejarContactarCoord(
  identidad: IdentidadAgricultor
): Promise<string> {
  // TODO Sprint 6: mandar email al coord asignado / admin con los datos del
  // agricultor. Por ahora solo respondemos OK.
  console.log(
    `[whatsapp/intent] contactar-coord: tel=${identidad.telefonoNormalizado} gen=${identidad.generador?.id} rol=${identidad.rol}`
  );
  return "Listo, un coordinador te contactará pronto.";
}

// Margen para cold starts + Neon/Airtable (TextIt espera la respuesta del
// webhook; visto timeout en prueba 2026-07-08 justo tras un deploy).
export const maxDuration = 30;

// Keep-warm: /intent es una función SEPARADA de /identificar — el ping de
// UptimeRobot a /identificar no la calienta. Ping a este GET la mantiene viva.
export async function GET() {
  return NextResponse.json({ ok: true, warm: true });
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      telefono?: string;
      opcion?: number | string;
    };
    const telefono = String(body.telefono || "").trim();
    const opcion = Number(body.opcion);
    if (!telefono || !Number.isFinite(opcion) || opcion < 1) {
      return NextResponse.json(
        { error: "Faltan campos `telefono` y `opcion` (numérico ≥ 1)" },
        { status: 400 }
      );
    }

    // Coordinador PRIMERO — misma precedencia que /identificar (en vivo,
    // el Rol puede cambiar). Su menú tiene una sola opción: generar cert.
    const coord = await identificarCoordinadorPorTelefono(telefono);
    if (coord) {
      if (opcion !== 1) {
        return NextResponse.json(
          {
            error: "Opción fuera de rango",
            mensaje_ok: "Por favor responde 1 para generar un certificado.",
          },
          { status: 400 }
        );
      }
      const token = await crearToken({
        intent: "cert-coordinador",
        recordId: coord.id,
        telefonoValidado: coord.telefono,
        contexto: {
          rol: "coordinador",
          coordinador: { id: coord.id, nombre: coord.nombre },
        },
        ttlMinutes: TTL_MIN,
      });
      const base = PORTAL_BASE.replace(/\/$/, "");
      console.log(
        `[whatsapp/intent] tel=${coord.telefono} rol=coordinador intent=cert-coordinador token=${token.token.slice(0, 8)}…`
      );
      return NextResponse.json({
        url: `${base}/m/cert-coord/${token.token}`,
        expira_min: TTL_MIN,
        mensaje_ok:
          "Vamos a generar un certificado. En el formulario busca al agricultor por su cédula o nombre. El certificado sale aprobado de una vez, a tu nombre.",
        intent: "cert-coordinador",
      });
    }

    const identidad = await identificarAgricultor(telefono);
    const opciones = opcionesParaIdentidad(identidad);
    const idx = opcion - 1;
    if (idx < 0 || idx >= opciones.length) {
      return NextResponse.json(
        {
          error: "Opción fuera de rango",
          mensaje_ok: `Por favor elige un número entre 1 y ${opciones.length}.`,
        },
        { status: 400 }
      );
    }
    const menuIntent = opciones[idx];
    const resolved = intentRealParaMenu(menuIntent, identidad);

    if (resolved === "contactar-coord") {
      const mensaje = await manejarContactarCoord(identidad);
      return NextResponse.json({
        url: null,
        expira_min: 0,
        mensaje_ok: mensaje,
      });
    }

    const recordId = recordIdParaToken(resolved, identidad);
    // Para cert-nuevo el contexto solo lleva fincas APROBADAS — el form
    // arma su selector desde acá y una finca en revisión no debe aparecer
    // (el backend de /enviar también lo valida, esto es UX).
    const fincasParaContexto =
      resolved === "cert-nuevo"
        ? identidad.fincas.filter((f) => f.estado === "aprobado")
        : identidad.fincas;
    const contexto: Record<string, unknown> = {
      rol: identidad.rol,
      estado_inicial: identidad.estado,
      fincas: fincasParaContexto.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        generadorId: f.generadorId,
      })),
      generador: identidad.generador
        ? {
            id: identidad.generador.id,
            nombre: identidad.generador.nombre,
            tipopersona: identidad.generador.tipopersona,
          }
        : null,
    };

    const token = await crearToken({
      intent: resolved,
      recordId,
      telefonoValidado: identidad.telefonoNormalizado,
      contexto,
      ttlMinutes: TTL_MIN,
    });

    const url = urlParaIntent(resolved, token.token);
    const mensaje_ok =
      (await mensajeOkParaIntent(resolved, identidad)) +
      (await lineaContactoCoordinador(identidad));

    console.log(
      `[whatsapp/intent] tel=${identidad.telefonoNormalizado} rol=${identidad.rol} intent=${resolved} token=${token.token.slice(0, 8)}…`
    );

    return NextResponse.json({
      url,
      expira_min: TTL_MIN,
      mensaje_ok,
      intent: resolved,
    });
  } catch (err) {
    console.error("[whatsapp/intent] Error:", err);
    return NextResponse.json(
      {
        error: "Error interno",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

async function mensajeOkParaIntent(
  intent: Intent,
  identidad: IdentidadAgricultor
): Promise<string> {
  const esEmpresa = (identidad.generador?.tipopersona || "")
    .toLowerCase()
    .includes("juridic");
  const fincasAprobadas = identidad.fincas.filter((f) => f.estado === "aprobado");
  switch (intent) {
    case "cert-nuevo": {
      if (fincasAprobadas.length === 1) {
        const f = fincasAprobadas[0];
        const cultivos = await resolverNombresCultivos(f.cultivoIds);
        const cultivosBloque =
          cultivos.length > 0
            ? `\n\n🌱 *Cultivos registrados:*\n${cultivos.map((c) => `• ${c}`).join("\n")}`
            : "";
        return `Vamos a generar tu certificado para la finca *${f.nombre}*.${cultivosBloque}`;
      }
      if (fincasAprobadas.length > 1) {
        return `Vamos a generar tu certificado. Tienes ${fincasAprobadas.length} fincas — elige una en el formulario.`;
      }
      return "Vamos a generar tu certificado.";
    }
    case "editar-finca": {
      if (fincasAprobadas.length === 1) {
        return `Vamos a actualizar los datos de la finca *${fincasAprobadas[0].nombre}*.`;
      }
      return "Vamos a actualizar los datos de tu finca.";
    }
    case "editar-generador":
      return esEmpresa
        ? `Vamos a actualizar los datos de la empresa *${identidad.generador?.nombre || ""}*.`
        : `Vamos a actualizar tus datos personales.`;
    case "editar-perfil": {
      const labelMia = esEmpresa
        ? "los datos de tu empresa"
        : "tus datos personales";
      const labelFincas =
        fincasAprobadas.length === 1 ? "de tu finca" : "de tus fincas";
      return `En este enlace puedes actualizar ${labelMia} y los ${labelFincas}. Ahí verás toda tu información — cambia solo lo que necesites.`;
    }
    case "crear-finca":
      return "Vamos a registrar tu nueva finca.";
    case "registro-generador":
      return "Vamos a registrarte como agricultor.";
    case "cert-coordinador":
      // No se alcanza: el flujo coordinador se resuelve antes en el POST.
      return "Vamos a generar un certificado.";
    case "aprobar-cert":
      // No se alcanza: este token no nace del bot sino del email al coord.
      return "Vamos a revisar la solicitud.";
  }
}

/**
 * Línea de contacto del coordinador asignado al generador, para anexar al
 * mensaje del enlace ("si tienes dudas escríbele..."). Vacía si no hay
 * coordinador resoluble o falla la consulta.
 */
async function lineaContactoCoordinador(
  identidad: IdentidadAgricultor
): Promise<string> {
  const coordId = identidad.generador?.coordinadorId || "";
  if (!coordId) return "";
  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Coordinadores/${coordId}`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` }, cache: "no-store" }
    );
    if (!r.ok) return "";
    const d = (await r.json()) as { fields?: Record<string, unknown> };
    const nombre = String(d.fields?.Name || "").trim();
    const tel10 = normalizarMovilCO(String(d.fields?.telefono || ""));
    if (!nombre || !tel10) return "";
    return `\n\nTu coordinador es *${nombre}* — si tienes dudas escríbele:\n👉 wa.me/57${tel10}`;
  } catch {
    return "";
  }
}

async function resolverNombresCultivos(cultivoIds: string[]): Promise<string[]> {
  if (cultivoIds.length === 0) return [];
  try {
    const map = await getCultivosMap();
    return cultivoIds.map((id) => map.get(id) || "").filter(Boolean);
  } catch {
    return [];
  }
}
