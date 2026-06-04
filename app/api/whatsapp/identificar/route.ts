/**
 * POST /api/whatsapp/identificar
 *
 * Llamado por TextIt al principio del flow `30-agricultor-router`. Recibe el
 * teléfono del agricultor y devuelve:
 *   - estado: conocido_con_fincas / conocido_sin_finca / desconocido (compat)
 *   - rol: titular / admin_finca / desconocido
 *   - saludo personalizado
 *   - menu_texto: el texto del menú listo para mostrar en WhatsApp
 *   - opciones[]: mapping numero → intent (para el siguiente paso /intent)
 *
 * Wording rules:
 *   - "generador" jamás aparece en WhatsApp cuando el titular es persona
 *     natural — se usa el nombre propio.
 *   - Para persona jurídica se usa "empresa" + razón social.
 *   - El admin_finca ve un mensaje explícito que aclara su alcance limitado.
 *
 * Auth: Bearer ${WHATSAPP_BOT_API_KEY}.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  identificarAgricultor,
  type IdentidadAgricultor,
} from "@/lib/whatsappResolver";

const WHATSAPP_BOT_API_KEY = process.env.WHATSAPP_BOT_API_KEY;

interface MenuOpcion {
  numero: number;
  intent:
    | "cert-nuevo"
    | "editar-datos-personales"
    | "editar-finca"
    | "editar-perfil"
    | "crear-finca"
    | "registro-generador"
    | "contactar-coord";
  label: string;
}

interface RespuestaIdentificar {
  estado: "conocido_con_fincas" | "conocido_sin_finca" | "desconocido";
  rol: "titular" | "admin_finca" | "desconocido";
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

function truncar(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function esEmpresa(tipopersona: string): boolean {
  const t = tipopersona.toLowerCase();
  return t === "juridica" || t === "jurídica" || t.includes("juridic");
}

function armarRespuestaTitular(
  identidad: IdentidadAgricultor
): RespuestaIdentificar {
  const generador = identidad.generador!;
  const fincasAprobadas = identidad.fincas.filter((f) => f.estado === "aprobado");
  const nombreCorto = truncar(generador.nombre, 40);
  const esJuridica = esEmpresa(generador.tipopersona);

  // Sin fincas todavía o todas en revisión por el coord
  if (fincasAprobadas.length === 0) {
    const saludo = `Hola ${nombreCorto} 👋`;
    // Caso A: tiene fincas pero todas en pendiente_revision / pendiente
    const tieneFincasEnRevision = identidad.fincas.length > 0;
    const nombresFincas = identidad.fincas
      .map((f) => f.nombre)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    let intro: string;
    let opciones: MenuOpcion[];
    if (tieneFincasEnRevision) {
      const prefijo = esJuridica
        ? `Estás escribiendo como *${nombreCorto}*.\n\n`
        : "";
      intro =
        `${prefijo}` +
        `Tu coordinador está revisando ${
          identidad.fincas.length === 1 ? "tu finca" : "tus fincas"
        }${nombresFincas ? ` (${nombresFincas})` : ""}.\n\n` +
        `No puedes generar certificados hasta que apruebe los cambios. Te aviso por aquí cuando esté lista.`;
      opciones = [
        {
          numero: 1,
          intent: "editar-datos-personales",
          label: esJuridica
            ? "1️⃣ Actualizar datos de la empresa"
            : "1️⃣ Actualizar mis datos personales",
        },
        { numero: 2, intent: "contactar-coord", label: "2️⃣ Hablar con un coordinador" },
      ];
    } else {
      // Caso B: realmente no tiene fincas
      intro = esJuridica
        ? `Estás escribiendo como *${nombreCorto}*.\n\nTe falta registrar tu primera finca para poder generar certificados.`
        : `Te falta registrar tu primera finca para poder generar certificados.`;
      opciones = [
        { numero: 1, intent: "crear-finca", label: "1️⃣ Registrar mi primera finca" },
        {
          numero: 2,
          intent: "editar-datos-personales",
          label: esJuridica
            ? "2️⃣ Actualizar datos de la empresa"
            : "2️⃣ Actualizar mis datos personales",
        },
        { numero: 3, intent: "contactar-coord", label: "3️⃣ Hablar con un coordinador" },
      ];
    }
    return baseResp(identidad, saludo, intro, opciones, generador.nombre);
  }

  // Label de "Actualizar mis datos" según tipopersona + nº de fincas.
  // Evitamos la palabra "empresa" para personas naturales (la mayoría son
  // unipersonales con 1 finca y no se identifican como empresa).
  const labelActualizar = (numero: number) => {
    const n = `${numero}️⃣`;
    if (esJuridica) {
      return fincasAprobadas.length === 1
        ? `${n} Actualizar datos de la empresa y la finca`
        : `${n} Actualizar datos de la empresa y mis fincas`;
    }
    return fincasAprobadas.length === 1
      ? `${n} Actualizar mis datos y los de mi finca`
      : `${n} Actualizar mis datos y los de mis fincas`;
  };

  // Una sola finca
  if (fincasAprobadas.length === 1) {
    const finca = fincasAprobadas[0];
    const nombreFinca = truncar(finca.nombre || "tu finca", 30);
    const saludo = `Hola ${nombreCorto} 👋`;
    const intro = esJuridica
      ? `Estás escribiendo como *${nombreCorto}*.\nTienes registrada la finca *${nombreFinca}*.\n\n¿Qué quieres hacer?`
      : `Te tengo registrado con la finca *${nombreFinca}*.\n\n¿Qué quieres hacer?`;
    const opciones: MenuOpcion[] = [
      { numero: 1, intent: "cert-nuevo", label: "1️⃣ Solicitar un nuevo certificado" },
      { numero: 2, intent: "editar-perfil", label: labelActualizar(2) },
      { numero: 3, intent: "crear-finca", label: "3️⃣ Registrar otra finca" },
      { numero: 4, intent: "contactar-coord", label: "4️⃣ Hablar con un coordinador" },
    ];
    return baseResp(identidad, saludo, intro, opciones, generador.nombre);
  }

  // Varias fincas
  const saludo = `Hola ${nombreCorto} 👋`;
  const intro = esJuridica
    ? `Estás escribiendo como *${nombreCorto}*.\nTienes registradas ${fincasAprobadas.length} fincas.\n\n¿Qué quieres hacer?`
    : `Tienes registradas ${fincasAprobadas.length} fincas.\n\n¿Qué quieres hacer?`;
  const opciones: MenuOpcion[] = [
    { numero: 1, intent: "cert-nuevo", label: "1️⃣ Solicitar un nuevo certificado" },
    { numero: 2, intent: "editar-perfil", label: labelActualizar(2) },
    { numero: 3, intent: "crear-finca", label: "3️⃣ Registrar otra finca" },
    { numero: 4, intent: "contactar-coord", label: "4️⃣ Hablar con un coordinador" },
  ];
  return baseResp(identidad, saludo, intro, opciones, generador.nombre);
}

function armarRespuestaAdminFinca(
  identidad: IdentidadAgricultor
): RespuestaIdentificar {
  const finca = identidad.fincas[0];
  const generador = identidad.generador;
  const nombreFinca = truncar(finca?.nombre || "tu finca", 30);
  const nombreGen = generador ? truncar(generador.nombre, 40) : null;
  const esJuridica = generador ? esEmpresa(generador.tipopersona) : false;

  const saludo = `Hola 👋`;
  const intro = nombreGen
    ? esJuridica
      ? `Eres responsable de la finca *${nombreFinca}*\n(parte de la empresa ${nombreGen}).\n\nSolo puedes gestionar lo de tu finca. Para cambios de ${nombreGen}, contacta a la empresa.\n\n¿Qué quieres hacer?`
      : `Eres responsable de la finca *${nombreFinca}*\n(registrada a nombre de ${nombreGen}).\n\nSolo puedes gestionar lo de tu finca. Para cambios de los datos personales del titular, contáctalo a él.\n\n¿Qué quieres hacer?`
    : `Eres responsable de la finca *${nombreFinca}*.\n\n¿Qué quieres hacer?`;

  const opciones: MenuOpcion[] = [
    {
      numero: 1,
      intent: "cert-nuevo",
      label: `1️⃣ Solicitar certificado para ${nombreFinca}`,
    },
    {
      numero: 2,
      intent: "editar-finca",
      label: `2️⃣ Actualizar datos de ${nombreFinca}`,
    },
    { numero: 3, intent: "contactar-coord", label: "3️⃣ Hablar con un coordinador" },
  ];
  return baseResp(identidad, saludo, intro, opciones, generador?.nombre || null);
}

function armarRespuestaDesconocido(
  identidad: IdentidadAgricultor
): RespuestaIdentificar {
  const saludo = "Hola 👋";
  const intro = "No te tengo registrado todavía con este número.\n\n¿Qué quieres hacer?";
  const opciones: MenuOpcion[] = [
    { numero: 1, intent: "registro-generador", label: "1️⃣ Registrarme como agricultor" },
    { numero: 2, intent: "contactar-coord", label: "2️⃣ Hablar con un coordinador" },
  ];
  return baseResp(identidad, saludo, intro, opciones, null);
}

function baseResp(
  identidad: IdentidadAgricultor,
  saludo: string,
  intro: string,
  opciones: MenuOpcion[],
  nombre: string | null
): RespuestaIdentificar {
  // El saludo NO se incluye en menu_texto: el flow 30 lo manda por separado
  // como `saludo_personalizado`. Si se incluyera acá, sale duplicado.
  const menu_texto = `${intro}\n\n${opciones.map((o) => o.label).join("\n")}`;
  return {
    estado: identidad.estado,
    rol: identidad.rol,
    telefonoNormalizado: identidad.telefonoNormalizado,
    nombre,
    saludo_personalizado: saludo,
    menu_texto,
    opciones,
  };
}

function armarRespuesta(identidad: IdentidadAgricultor): RespuestaIdentificar {
  if (identidad.rol === "titular") return armarRespuestaTitular(identidad);
  if (identidad.rol === "admin_finca") return armarRespuestaAdminFinca(identidad);
  return armarRespuestaDesconocido(identidad);
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
      `[whatsapp/identificar] tel=${respuesta.telefonoNormalizado} rol=${respuesta.rol} estado=${respuesta.estado}`
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
