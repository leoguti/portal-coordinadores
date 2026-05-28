/**
 * POST /api/whatsapp/identificar
 *
 * Llamado por TextIt al principio del flow `30-agricultor-router`. Recibe el
 * teléfono del agricultor y devuelve:
 *   - estado: conocido_con_fincas / conocido_sin_finca / desconocido
 *   - saludo personalizado (con nombre si lo conocemos)
 *   - menu_texto: el texto del menú listo para mostrar en WhatsApp
 *   - opciones[]: mapping numero → intent (para el siguiente paso /intent)
 *
 * Auth: Bearer ${WHATSAPP_BOT_API_KEY}.
 */

import { NextRequest, NextResponse } from "next/server";
import { identificarAgricultor } from "@/lib/whatsappResolver";

const WHATSAPP_BOT_API_KEY = process.env.WHATSAPP_BOT_API_KEY;

interface MenuOpcion {
  numero: number;
  intent:
    | "cert-nuevo"
    | "editar-datos"
    | "crear-finca"
    | "registro-generador"
    | "contactar-coord";
  label: string;
}

interface RespuestaIdentificar {
  estado: "conocido_con_fincas" | "conocido_sin_finca" | "desconocido";
  telefonoNormalizado: string;
  nombre: string | null;
  saludo_personalizado: string;
  menu_texto: string;
  opciones: MenuOpcion[];
}

function validateApiKey(request: NextRequest): boolean {
  if (!WHATSAPP_BOT_API_KEY) {
    console.warn(
      "[whatsapp/identificar] WHATSAPP_BOT_API_KEY no definido — denegando"
    );
    return false;
  }
  const auth = request.headers.get("authorization") || "";
  return auth.replace(/^Bearer\s+/i, "") === WHATSAPP_BOT_API_KEY;
}

function armarRespuesta(
  identidad: Awaited<ReturnType<typeof identificarAgricultor>>
): RespuestaIdentificar {
  const nombre = identidad.generador?.nombre || null;
  const primerNombre = nombre ? nombre.split(/\s+/)[0] : null;

  let opciones: MenuOpcion[] = [];
  let saludo = "Hola 👋";
  let intro = "";

  switch (identidad.estado) {
    case "conocido_con_fincas":
      saludo = primerNombre ? `Hola ${primerNombre} 👋` : "Hola 👋";
      opciones = [
        { numero: 1, intent: "cert-nuevo", label: "1️⃣ Generar un certificado" },
        { numero: 2, intent: "editar-datos", label: "2️⃣ Actualizar mis datos" },
        { numero: 3, intent: "crear-finca", label: "3️⃣ Agregar otra finca" },
        { numero: 4, intent: "contactar-coord", label: "4️⃣ Hablar con mi coordinador" },
      ];
      intro = "¿Qué necesitas hoy?";
      break;

    case "conocido_sin_finca":
      saludo = primerNombre ? `Hola ${primerNombre} 👋` : "Hola 👋";
      opciones = [
        { numero: 1, intent: "crear-finca", label: "1️⃣ Registrar mi primera finca" },
        { numero: 2, intent: "editar-datos", label: "2️⃣ Actualizar mis datos" },
        { numero: 3, intent: "contactar-coord", label: "3️⃣ Hablar con un coordinador" },
      ];
      intro =
        "Te falta registrar tu primera finca para poder generar certificados.";
      break;

    case "desconocido":
    default:
      saludo = "Hola 👋";
      opciones = [
        { numero: 1, intent: "registro-generador", label: "1️⃣ Registrarme como generador" },
        { numero: 2, intent: "contactar-coord", label: "2️⃣ Hablar con un coordinador" },
      ];
      intro = "No te encuentro en nuestro sistema.";
      break;
  }

  const menu_texto = `${intro}\n\n${opciones.map((o) => o.label).join("\n")}`;
  return {
    estado: identidad.estado,
    telefonoNormalizado: identidad.telefonoNormalizado,
    nombre,
    saludo_personalizado: saludo,
    menu_texto,
    opciones,
  };
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { telefono?: string };
    const telefono = String(body.telefono || "").trim();
    if (!telefono) {
      return NextResponse.json(
        { error: "Falta el campo `telefono` en el body" },
        { status: 400 }
      );
    }

    const identidad = await identificarAgricultor(telefono);
    const respuesta = armarRespuesta(identidad);
    console.log(
      `[whatsapp/identificar] tel=${respuesta.telefonoNormalizado} estado=${respuesta.estado}`
    );
    return NextResponse.json(respuesta);
  } catch (err) {
    console.error("[whatsapp/identificar] Error:", err);
    return NextResponse.json(
      {
        error: "Error interno",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
