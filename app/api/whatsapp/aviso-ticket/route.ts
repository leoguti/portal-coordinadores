/**
 * POST /api/whatsapp/aviso-ticket
 *
 * Llamado por el flow `32-abrir-ticket` de TextIt justo después de abrir el
 * ticket de "hablar con una persona". Manda el email de aviso al buzón de
 * atención (CONTACTO_WEB_EMAIL) con el enlace directo al ticket.
 *
 * Auth: Bearer ${WHATSAPP_BOT_API_KEY} (misma llave que identificar/intent).
 *
 * Body: {
 *   telefono: string,  // URN de TextIt, ej. "whatsapp:573001234567"
 *   ticket?: string,   // UUID del ticket; vacío si open_ticket falló
 *   tema?: string      // lo que escribió la persona (nota del ticket)
 * }
 *
 * Responde rápido (el email sale en `after()`) — el flow espera el webhook.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { enviarAvisoContactoDesconocido } from "@/lib/emailContactoDesconocido";

const WHATSAPP_BOT_API_KEY = process.env.WHATSAPP_BOT_API_KEY;

function validateApiKey(request: NextRequest): boolean {
  if (!WHATSAPP_BOT_API_KEY) return false;
  const auth = request.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "") === WHATSAPP_BOT_API_KEY;
}

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      telefono?: string;
      ticket?: string;
      tema?: string;
    };
    const tel10 = String(body.telefono || "")
      .replace(/\D/g, "")
      .slice(-10);
    if (tel10.length !== 10) {
      return NextResponse.json(
        { error: "Falta `telefono` válido" },
        { status: 400 }
      );
    }
    // El UUID viene de @locals._new_ticket; si open_ticket falló llega vacío
    // y el email sale sin botón de ticket (aviso simple, mejor que nada).
    const ticketUuid =
      /^[0-9a-f-]{32,36}$/i.test(String(body.ticket || "").trim())
        ? String(body.ticket).trim()
        : undefined;
    const tema = String(body.tema || "").trim().slice(0, 500) || undefined;

    console.log(
      `[whatsapp/aviso-ticket] tel=${tel10} ticket=${ticketUuid || "(sin)"} tema=${tema ? "sí" : "(no)"}`
    );
    after(() => enviarAvisoContactoDesconocido(tel10, tema, ticketUuid));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
}
