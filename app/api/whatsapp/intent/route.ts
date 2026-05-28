/**
 * POST /api/whatsapp/intent
 *
 * Segundo paso del flow TextIt: el agricultor ya recibió el menú y eligió un
 * número. Este endpoint re-identifica al agricultor (no confía en estado del
 * cliente), valida que la opción es válida para su estado, y resuelve el
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
import { crearToken, type Intent } from "@/lib/edicionTokens";

const WHATSAPP_BOT_API_KEY = process.env.WHATSAPP_BOT_API_KEY;
const PORTAL_BASE = process.env.NEXTAUTH_URL || "https://portal.campolimpio.org";
const TTL_MIN = Number(process.env.EDICION_TOKEN_TTL_MIN || 30);

type MenuIntent =
  | "cert-nuevo"
  | "editar-datos"
  | "crear-finca"
  | "registro-generador"
  | "contactar-coord";

function validateApiKey(request: NextRequest): boolean {
  if (!WHATSAPP_BOT_API_KEY) return false;
  const auth = request.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "") === WHATSAPP_BOT_API_KEY;
}

/** Reconstruye el menú actual del agricultor para validar `opcion`. */
function opcionesParaEstado(estado: IdentidadAgricultor["estado"]): MenuIntent[] {
  switch (estado) {
    case "conocido_con_fincas":
      return ["cert-nuevo", "editar-datos", "crear-finca", "contactar-coord"];
    case "conocido_sin_finca":
      return ["crear-finca", "editar-datos", "contactar-coord"];
    case "desconocido":
    default:
      return ["registro-generador", "contactar-coord"];
  }
}

/**
 * "editar-datos" se resuelve a editar-finca o editar-generador según qué
 * existe. Default a editar-generador si tiene generador pero no fincas.
 */
function resolverIntentReal(
  menu: MenuIntent,
  identidad: IdentidadAgricultor
): Intent | "contactar-coord" {
  if (menu === "contactar-coord") return "contactar-coord";
  if (menu === "cert-nuevo") return "cert-nuevo";
  if (menu === "crear-finca") return "crear-finca";
  if (menu === "registro-generador") return "registro-generador";
  if (menu === "editar-datos") {
    // Si hay finca(s), editar la primera (en el form pueden seleccionar otra).
    // Si solo hay generador, editar el generador.
    return identidad.fincas.length > 0 ? "editar-finca" : "editar-generador";
  }
  return "contactar-coord"; // fallback defensivo
}

function urlParaIntent(intent: Intent, token: string): string {
  const base = PORTAL_BASE.replace(/\/$/, "");
  switch (intent) {
    case "cert-nuevo":
      return `${base}/m/cert/${token}`;
    case "editar-finca":
      return `${base}/m/finca/${token}`;
    case "editar-generador":
      return `${base}/m/generador/${token}`;
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
  // Para flows que apuntan a un record existente, guardamos cuál.
  // Para registro-generador y crear-finca el record_id se llenará al enviar.
  switch (intent) {
    case "cert-nuevo":
      // Si tiene 1 finca, la pre-seleccionamos. Si tiene varias, el form
      // muestra selector — guardamos null y el contexto trae la lista.
      return identidad.fincas.length === 1 ? identidad.fincas[0].id : null;
    case "editar-finca":
      return identidad.fincas[0]?.id || null;
    case "editar-generador":
      return identidad.generador?.id || null;
    case "crear-finca":
      // Generador padre (no creamos finca pendiente todavía).
      return identidad.generador?.id || null;
    case "registro-generador":
      return null;
  }
}

async function manejarContactarCoord(
  identidad: IdentidadAgricultor
): Promise<string> {
  // TODO Sprint 6: mandar email al coord asignado / admin con los datos del
  // agricultor. Por ahora solo respondemos OK.
  console.log(
    `[whatsapp/intent] contactar-coord: tel=${identidad.telefonoNormalizado} gen=${identidad.generador?.id}`
  );
  return "Listo, un coordinador te contactará pronto.";
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

    const identidad = await identificarAgricultor(telefono);
    const opciones = opcionesParaEstado(identidad.estado);
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
    const resolved = resolverIntentReal(menuIntent, identidad);

    if (resolved === "contactar-coord") {
      const mensaje = await manejarContactarCoord(identidad);
      return NextResponse.json({
        url: null,
        expira_min: 0,
        mensaje_ok: mensaje,
      });
    }

    const recordId = recordIdParaToken(resolved, identidad);
    const contexto: Record<string, unknown> = {
      estado_inicial: identidad.estado,
      fincas: identidad.fincas.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        generadorId: f.generadorId,
      })),
      generador: identidad.generador
        ? { id: identidad.generador.id, nombre: identidad.generador.nombre }
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
    const mensaje_ok = mensajeOkParaIntent(resolved);

    console.log(
      `[whatsapp/intent] tel=${identidad.telefonoNormalizado} intent=${resolved} token=${token.token.slice(0, 8)}…`
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

function mensajeOkParaIntent(intent: Intent): string {
  switch (intent) {
    case "cert-nuevo":
      return "Vamos a generar tu certificado.";
    case "editar-finca":
      return "Vamos a actualizar los datos de tu finca.";
    case "editar-generador":
      return "Vamos a actualizar tus datos.";
    case "crear-finca":
      return "Vamos a registrar tu nueva finca.";
    case "registro-generador":
      return "Vamos a registrarte como generador.";
  }
}
