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

// TextIt espera la respuesta del webhook: dar margen a los lookups de Airtable
// (auditoría 2026-07-08: ~6% de runs con timeout en este webhook).
export const maxDuration = 30;
import {
  identificarAgricultor,
  type IdentidadAgricultor,
} from "@/lib/whatsappResolver";
import {
  identificarCoordinadorPorTelefono,
  type CoordinadorWA,
} from "@/lib/coordinadorResolver";

const WHATSAPP_BOT_API_KEY = process.env.WHATSAPP_BOT_API_KEY;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

interface MenuOpcion {
  numero: number;
  intent:
    | "cert-nuevo"
    | "cert-coordinador"
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
  rol: "titular" | "admin_finca" | "desconocido" | "coordinador";
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

/**
 * Consulta los certificados en estado 'pendiente' de las fincas del
 * agricultor y devuelve líneas legibles ("Certificado #94112 (finca X)").
 * Usa los certIds del reverse lookup (ARRAYJOIN sobre linked records no
 * sirve para filtrar por ID).
 */
async function consultarCertsPendientes(
  identidad: IdentidadAgricultor
): Promise<string[]> {
  // Map certId → nombre de finca para etiquetar el resultado.
  const fincaPorCert = new Map<string, string>();
  for (const f of identidad.fincas) {
    for (const cid of f.certIds) fincaPorCert.set(cid, f.nombre);
  }
  // Los certs más recientes quedan al final del linked record — tomamos
  // los últimos 50 por finca para mantener la fórmula corta.
  const certIds = identidad.fincas
    .flatMap((f) => f.certIds.slice(-50))
    .slice(0, 150);
  if (certIds.length === 0) return [];
  try {
    const orParts = certIds.map((id) => `RECORD_ID()='${id}'`).join(",");
    const formula = `AND({estado}='pendiente', OR(${orParts}))`;
    const p = new URLSearchParams();
    p.set("filterByFormula", formula);
    p.set("pageSize", "10");
    p.append("fields[]", "consecutivo");
    const r = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados?${p}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
    );
    if (!r.ok) return [];
    const d = (await r.json()) as {
      records: Array<{ id: string; fields: Record<string, unknown> }>;
    };
    return (d.records || []).map((rec) => {
      const consecutivo = rec.fields.consecutivo
        ? `#${rec.fields.consecutivo}`
        : "";
      const finca = fincaPorCert.get(rec.id);
      return `Certificado ${consecutivo}${finca ? ` (${finca})` : ""}`.trim();
    });
  } catch {
    return [];
  }
}

/**
 * Arma el bloque "⏳ En revisión" que se muestra al entrar, para que el
 * agricultor sepa de una vez qué procesos tiene pendientes. `soloCerts`
 * se usa en menús bloqueados cuyo intro ya explica la revisión de
 * fincas/datos (evita duplicar).
 */
function armarBloquePendientes(
  identidad: IdentidadAgricultor,
  certsPendientes: string[],
  opts?: { soloCerts?: boolean }
): string {
  const items: string[] = [];
  if (!opts?.soloCerts) {
    if (identidad.generador?.estado === "pendiente_revision") {
      const esJuridica = esEmpresa(identidad.generador.tipopersona);
      items.push(
        esJuridica
          ? "• Cambios en los datos de la empresa"
          : "• Cambios en tus datos personales"
      );
    }
    for (const f of identidad.fincas) {
      if (f.estado === "pendiente_revision") {
        items.push(`• Cambios en la finca ${f.nombre || "(sin nombre)"}`);
      } else if (f.estado === "pendiente") {
        items.push(`• Registro de la finca ${f.nombre || "(sin nombre)"}`);
      }
    }
  }
  items.push(...certsPendientes.map((c) => `• ${c}`));
  if (items.length === 0) return "";
  return `⏳ *En revisión por tu coordinador:*\n${items.join("\n")}`;
}

function esEmpresa(tipopersona: string): boolean {
  const t = tipopersona.toLowerCase();
  return t === "juridica" || t === "jurídica" || t.includes("juridic");
}

function armarRespuestaTitular(
  identidad: IdentidadAgricultor,
  certsPendientes: string[]
): RespuestaIdentificar {
  const generador = identidad.generador!;
  const fincasAprobadas = identidad.fincas.filter((f) => f.estado === "aprobado");
  const nombreCorto = truncar(generador.nombre, 40);
  const esJuridica = esEmpresa(generador.tipopersona);
  const generadorEnRevision = generador.estado === "pendiente_revision";

  // Generador con cambios pendientes de aprobación — bloquear cert porque
  // saldría con datos no aprobados. Solo permitir editar datos (refrescar
  // los cambios) o hablar con coord.
  if (generadorEnRevision) {
    const saludo = `Hola ${nombreCorto} 👋`;
    const sujeto = esJuridica
      ? "los cambios que enviaste para tu empresa"
      : "los cambios que enviaste para tus datos";
    const intro =
      `Tu coordinador está revisando ${sujeto}.\n\n` +
      `No puedes generar certificados hasta que apruebe los cambios. Te aviso por aquí cuando estén listos.`;
    const opciones: MenuOpcion[] = [
      {
        numero: 1,
        intent: "editar-perfil",
        label: esJuridica
          ? "1️⃣ Revisar / actualizar mis datos"
          : "1️⃣ Revisar / actualizar mis datos",
      },
      { numero: 2, intent: "contactar-coord", label: "2️⃣ Hablar con un coordinador" },
    ];
    // El intro ya explica la revisión del generador — el bloque solo
    // agrega certs pendientes si los hay.
    const bloque = armarBloquePendientes(identidad, certsPendientes, {
      soloCerts: true,
    });
    return baseResp(identidad, saludo, intro, opciones, generador.nombre, bloque);
  }

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
    // El intro ya explica la revisión de fincas — el bloque solo agrega
    // certs pendientes.
    const bloqueCerts = armarBloquePendientes(identidad, certsPendientes, {
      soloCerts: true,
    });
    return baseResp(
      identidad,
      saludo,
      intro,
      opciones,
      generador.nombre,
      bloqueCerts
    );
  }

  // Bloque de procesos pendientes (fincas en revisión, certs sin aprobar)
  // para los menús normales — el agricultor lo ve de una al entrar.
  const bloquePend = armarBloquePendientes(identidad, certsPendientes);

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
    return baseResp(identidad, saludo, intro, opciones, generador.nombre, bloquePend);
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
  return baseResp(identidad, saludo, intro, opciones, generador.nombre, bloquePend);
}

function armarRespuestaAdminFinca(
  identidad: IdentidadAgricultor,
  certsPendientes: string[]
): RespuestaIdentificar {
  const fincasAprobadas = identidad.fincas.filter((f) => f.estado === "aprobado");
  const finca = fincasAprobadas[0] || identidad.fincas[0];
  const generador = identidad.generador;
  const nombreFinca = truncar(finca?.nombre || "tu finca", 30);
  const nombreGen = generador ? truncar(generador.nombre, 40) : null;
  const esJuridica = generador ? esEmpresa(generador.tipopersona) : false;

  const saludo = `Hola 👋`;

  // Todas las fincas que administra están en revisión → bloquear cert.
  if (fincasAprobadas.length === 0 && identidad.fincas.length > 0) {
    const nombresFincas = identidad.fincas
      .map((f) => f.nombre)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const intro =
      `Tu coordinador está revisando los cambios de ${
        identidad.fincas.length === 1 ? "tu finca" : "tus fincas"
      }${nombresFincas ? ` (${nombresFincas})` : ""}.\n\n` +
      `No puedes generar certificados hasta que apruebe los cambios. Te aviso por aquí cuando estén listos.`;
    const opciones: MenuOpcion[] = [
      {
        numero: 1,
        intent: "editar-finca",
        label: `1️⃣ Revisar / actualizar datos de la finca`,
      },
      { numero: 2, intent: "contactar-coord", label: "2️⃣ Hablar con un coordinador" },
    ];
    const bloqueCerts = armarBloquePendientes(identidad, certsPendientes, {
      soloCerts: true,
    });
    return baseResp(
      identidad,
      saludo,
      intro,
      opciones,
      generador?.nombre || null,
      bloqueCerts
    );
  }

  const bloquePend = armarBloquePendientes(identidad, certsPendientes);

  // Si administra varias fincas, mencionarlas (cert va a la aprobada;
  // si hay varias aprobadas, el form deja elegir).
  const fincasLinea =
    fincasAprobadas.length > 1
      ? `Eres responsable de ${fincasAprobadas.length} fincas: ${fincasAprobadas
          .map((f) => f.nombre)
          .filter(Boolean)
          .slice(0, 3)
          .join(", ")}.`
      : `Eres responsable de la finca *${nombreFinca}*`;

  const intro = nombreGen
    ? esJuridica
      ? `${fincasLinea}\n(parte de la empresa ${nombreGen}).\n\nSolo puedes gestionar lo de tu finca. Para cambios de ${nombreGen}, contacta a la empresa.\n\n¿Qué quieres hacer?`
      : `${fincasLinea}\n(registrada a nombre de ${nombreGen}).\n\nSolo puedes gestionar lo de tu finca. Para cambios de los datos personales del titular, contáctalo a él.\n\n¿Qué quieres hacer?`
    : `${fincasLinea}.\n\n¿Qué quieres hacer?`;

  const labelCert =
    fincasAprobadas.length > 1
      ? "1️⃣ Solicitar un certificado"
      : `1️⃣ Solicitar certificado para ${nombreFinca}`;
  const labelEditar =
    identidad.fincas.length > 1
      ? "2️⃣ Actualizar datos de una finca"
      : `2️⃣ Actualizar datos de ${nombreFinca}`;

  const opciones: MenuOpcion[] = [
    { numero: 1, intent: "cert-nuevo", label: labelCert },
    { numero: 2, intent: "editar-finca", label: labelEditar },
    { numero: 3, intent: "contactar-coord", label: "3️⃣ Hablar con un coordinador" },
  ];
  return baseResp(
    identidad,
    saludo,
    intro,
    opciones,
    generador?.nombre || null,
    bloquePend
  );
}

/**
 * Menú para coordinadores (Rol="Coordinador" en Airtable, consultado en
 * vivo — el rol puede cambiar en cualquier momento). Un coordinador puede
 * generar certificados para CUALQUIER agricultor desde su WhatsApp.
 */
function armarRespuestaCoordinador(
  coord: CoordinadorWA
): RespuestaIdentificar {
  const nombreCorto = truncar(coord.nombre || "Coordinador", 40);
  const saludo = `Hola ${nombreCorto} 👋`;
  const intro =
    `Te tengo registrado como *coordinador(a)*.\n\n¿Qué quieres hacer?`;
  const opciones: MenuOpcion[] = [
    {
      numero: 1,
      intent: "cert-coordinador",
      label: "1️⃣ Generar un certificado (cualquier agricultor)",
    },
  ];
  const menu_texto = [intro, opciones.map((o) => o.label).join("\n")].join(
    "\n\n"
  );
  return {
    estado: "conocido_con_fincas",
    rol: "coordinador",
    telefonoNormalizado: coord.telefono,
    nombre: coord.nombre,
    saludo_personalizado: saludo,
    menu_texto,
    opciones,
  };
}

function armarRespuestaDesconocido(
  identidad: IdentidadAgricultor
): RespuestaIdentificar {
  const saludo = "Hola 👋";
  const intro = "No te tengo registrado todavía con este número.\n\n¿Qué quieres hacer?";
  const opciones: MenuOpcion[] = [
    { numero: 1, intent: "registro-generador", label: "1️⃣ Inscribirme para generar certificados" },
    { numero: 2, intent: "contactar-coord", label: "2️⃣ Hablar con un coordinador" },
  ];
  return baseResp(identidad, saludo, intro, opciones, null);
}

function baseResp(
  identidad: IdentidadAgricultor,
  saludo: string,
  intro: string,
  opciones: MenuOpcion[],
  nombre: string | null,
  bloquePendientes = ""
): RespuestaIdentificar {
  // El saludo NO se incluye en menu_texto: el flow 30 lo manda por separado
  // como `saludo_personalizado`. Si se incluyera acá, sale duplicado.
  // El bloque de pendientes va ANTES de "¿Qué quieres hacer?" para que la
  // pregunta quede pegada a las opciones.
  const PREGUNTA = "¿Qué quieres hacer?";
  let introBase = intro;
  let pregunta = "";
  if (bloquePendientes && intro.trimEnd().endsWith(PREGUNTA)) {
    introBase = intro.trimEnd().slice(0, -PREGUNTA.length).trimEnd();
    pregunta = PREGUNTA;
  }
  const menu_texto = [
    introBase,
    bloquePendientes,
    pregunta,
    opciones.map((o) => o.label).join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
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

function armarRespuesta(
  identidad: IdentidadAgricultor,
  certsPendientes: string[]
): RespuestaIdentificar {
  if (identidad.rol === "titular")
    return armarRespuestaTitular(identidad, certsPendientes);
  if (identidad.rol === "admin_finca")
    return armarRespuestaAdminFinca(identidad, certsPendientes);
  return armarRespuestaDesconocido(identidad);
}

/**
 * GET — keep-warm ping. Un monitor externo (UptimeRobot) lo llama cada
 * 5 min para evitar cold starts de esta función: TextIt corta el webhook
 * si tardamos demasiado (6/52 runs fallaron con status 0 entre el 1-10
 * de junio, todos arranques en frío). No toca Airtable ni requiere auth.
 */
export async function GET() {
  return NextResponse.json({ ok: true, warm: true });
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

    // Coordinador PRIMERO (gana sobre titular/admin_finca): hay coords que
    // registraron fincas de agricultores con su propio número. La lista se
    // consulta en vivo en Airtable (el Rol puede cambiar en cualquier momento).
    const coord = await identificarCoordinadorPorTelefono(telefono);
    if (coord) {
      const respuesta = armarRespuestaCoordinador(coord);
      console.log(
        `[whatsapp/identificar] tel=${respuesta.telefonoNormalizado} rol=coordinador (${coord.nombre})`
      );
      return NextResponse.json(respuesta);
    }

    const identidad = await identificarAgricultor(telefono);
    const certsPendientes = await consultarCertsPendientes(identidad);
    const respuesta = armarRespuesta(identidad, certsPendientes);
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
