/**
 * POST /api/m/[token]/enviar
 *
 * Recibe el formulario web del magic-link y lo despacha según el intent:
 *   - cert-nuevo:         crea Certificados con estado=pendiente (sin PDF)
 *   - editar-finca:       PATCH FINCAS + estado=pendiente_revision
 *   - editar-generador:   PATCH GENERADORES + estado=pendiente_revision
 *   - crear-finca:        crea FINCAS con estado=pendiente vinculada al gen
 *   - registro-generador: crea GENERADORES con estado=pendiente (+ FINCAS si
 *                         viene primera_finca en el body)
 *
 * Consume el token atómicamente al inicio. Si el token está expirado /
 * consumido / inexistente, responde 410.
 *
 * No requiere bearer auth — el token es la auth.
 */

import { NextRequest, NextResponse, after } from "next/server";
import {
  consumirToken,
  type EdicionToken,
  type Intent,
} from "@/lib/edicionTokens";
import { crearRegistroCertificado } from "@/lib/certificadosCore";
import { notificarSolicitudRecibida } from "@/lib/textitNotify";
import { normalizarMovilCO } from "@/lib/validacionesCO";

function intentToNotifTipo(
  intent: Intent
): "cert" | "registro-generador" | "crear-finca" | "editar-finca" | "editar-generador" {
  switch (intent) {
    case "cert-nuevo":
      return "cert";
    case "editar-finca":
      return "editar-finca";
    case "editar-generador":
      return "editar-generador";
    case "crear-finca":
      return "crear-finca";
    case "registro-generador":
      return "registro-generador";
  }
}

export const maxDuration = 30;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const WHATSAPP_FALLBACK_COORDINADOR_ID = process.env.WHATSAPP_FALLBACK_COORDINADOR_ID;

// ─── Helpers Airtable ─────────────────────────────────────────────────────

async function airtableFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

async function patchRecord(
  table: string,
  id: string,
  fields: Record<string, unknown>
) {
  const r = await airtableFetch(`/${table}/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!r.ok) {
    throw new Error(`PATCH ${table}/${id} failed: ${r.status} ${await r.text()}`);
  }
  return r.json();
}

async function createRecord(table: string, fields: Record<string, unknown>) {
  const r = await airtableFetch(`/${table}`, {
    method: "POST",
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!r.ok) {
    throw new Error(`POST ${table} failed: ${r.status} ${await r.text()}`);
  }
  return r.json() as Promise<{ id: string; fields: Record<string, unknown> }>;
}

// ─── Validaciones simples ──────────────────────────────────────────────────

function asNumber(v: unknown, def = 0): number {
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : def;
}

function asString(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Handlers por intent ───────────────────────────────────────────────────

interface ResultadoOk {
  ok: true;
  intent: Intent;
  recordId: string;
  mensaje: string;
  /** Consecutivo del cert recién creado (solo aplica a cert-nuevo). */
  consecutivo?: number;
  /** Resumen humano de los datos enviados — se envía al agricultor por WA
   *  para que pueda revisar errores antes de la aprobación del coord. */
  resumen?: string;
  /** wa.me corto del coord para contactarlo (solo en cert-nuevo). */
  coordContactoWaUrl?: string;
}

function fmtNumKg(n: number): string {
  return `${n} kg`;
}

function buscarNombreFincaEnContexto(
  contexto: Record<string, unknown>,
  fincaId: string
): string | null {
  const fincas = asArray<{ id: string; nombre: string }>(contexto.fincas);
  const m = fincas.find((f) => f.id === fincaId);
  return m?.nombre || null;
}

async function coordinadorInfo(
  coordinadorId: string
): Promise<{ nombre: string; telefono: string }> {
  try {
    const r = await airtableFetch(`/Coordinadores/${coordinadorId}`);
    if (!r.ok) return { nombre: "", telefono: "" };
    const d = (await r.json()) as { fields: Record<string, unknown> };
    return {
      nombre: String(d.fields?.Name || "").trim(),
      telefono: String(d.fields?.telefono || "").trim(),
    };
  } catch {
    return { nombre: "", telefono: "" };
  }
}

async function manejarCertNuevo(
  t: EdicionToken,
  body: Record<string, unknown>
): Promise<ResultadoOk> {
  const fincaId = asString(body.fincaId);
  const coordinadorId = asString(body.coordinadorId);
  const municipioDevolucionId = asString(body.municipioDevolucionId);
  const fechadevolucion = asString(body.fechadevolucion);

  if (!fincaId) throw new Error("Falta fincaId");
  if (!coordinadorId) throw new Error("Falta coordinadorId");
  if (!municipioDevolucionId) throw new Error("Falta municipioDevolucionId");
  if (!fechadevolucion) throw new Error("Falta fechadevolucion");

  // Anti-spoof: la finca debe pertenecer a un agricultor con el teléfono validado.
  // El cliente puede pasar cualquier fincaId; verificamos que esté en el contexto
  // del token o que su móvil (o el del generador) coincida con el teléfono.
  const fincasDelToken = asArray<{ id: string }>(t.contexto.fincas as unknown);
  const fincaPermitida = fincasDelToken.some((f) => f.id === fincaId);
  if (!fincaPermitida) {
    throw new Error("Finca no autorizada para este link");
  }

  const rigidos = asNumber(body.rigidos);
  const flexibles = asNumber(body.flexibles);
  const metalicos = asNumber(body.metalicos);
  const embalaje = asNumber(body.embalaje);
  if (rigidos + flexibles + metalicos + embalaje <= 0) {
    throw new Error("El total de kilos debe ser mayor a 0");
  }

  const result = await crearRegistroCertificado(
    {
      fincaId,
      coordinadorId,
      municipioDevolucionId,
      rigidos,
      flexibles,
      metalicos,
      embalaje,
      triplelavado: asString(body.triplelavado) || "PENDIENTE",
      lugardevolucion: asString(body.lugardevolucion),
      fechadevolucion,
      observaciones: asString(body.observaciones),
    },
    {
      estado: "pendiente",
      solicitudOrigen: "whatsapp",
      fechaSolicitud: nowIso(),
    }
  );

  const fincaNombre = buscarNombreFincaEnContexto(t.contexto, fincaId) || "(finca)";
  const coord = await coordinadorInfo(coordinadorId);
  const coordNombre = coord.nombre || "(coordinador)";
  const coordTel10 = coord.telefono ? normalizarMovilCO(coord.telefono) : "";
  // wa.me corto (sin ?text= largo) — el texto pre-relleno inflaba el URL
  // y se veía horrible en el WhatsApp del agricultor. El agricultor
  // escribe su propio mensaje al tap.
  const coordContactoWaUrl = coordTel10 ? `wa.me/57${coordTel10}` : "";
  const coordLinea = `• Coordinador: ${coordNombre}`;
  const total = rigidos + flexibles + metalicos + embalaje;
  const triplelavadoLbl = asString(body.triplelavado) || "PENDIENTE";
  const lugar = asString(body.lugardevolucion) || "(no especificado)";
  const fechaLbl = fechadevolucion;
  const lineas = [
    `• Finca: ${fincaNombre}`,
    coordLinea,
    `• Rígidos: ${fmtNumKg(rigidos)}`,
    `• Flexibles: ${fmtNumKg(flexibles)}`,
    `• Metálicos: ${fmtNumKg(metalicos)}`,
    `• Embalaje: ${fmtNumKg(embalaje)}`,
    `• Total: ${fmtNumKg(total)}`,
    `• Triple lavado: ${triplelavadoLbl}`,
    `• Devolución: ${lugar}`,
    `• Fecha devolución: ${fechaLbl}`,
  ];
  return {
    ok: true,
    intent: "cert-nuevo",
    recordId: result.recordId,
    consecutivo: Number(result.fullRecord.fields.consecutivo) || undefined,
    mensaje:
      "Solicitud enviada. Tu coordinador la revisará y la aprobará, y luego recibirás el PDF.",
    resumen: lineas.join("\n"),
    coordContactoWaUrl,
  };
}

async function manejarEditarFinca(
  t: EdicionToken,
  body: Record<string, unknown>
): Promise<ResultadoOk> {
  if (!t.recordId) throw new Error("Token sin recordId");
  const cambios: Record<string, unknown> = {};
  // Campos editables vía magic-link (no permitimos NIT, generador, etc.)
  const camposPermitidos = ["nombre", "movil", "email"];
  for (const k of camposPermitidos) {
    if (k in body && body[k] != null) cambios[k] = asString(body[k]);
  }
  if ("municipioId" in body && typeof body.municipioId === "string" && body.municipioId) {
    cambios.municipio = [body.municipioId];
  }
  if ("cultivosIds" in body) {
    const ids = asArray<string>(body.cultivosIds).filter(Boolean);
    if (ids.length > 0) cambios.cultivos = ids;
  }
  if (Object.keys(cambios).length === 0) {
    throw new Error("No se enviaron cambios");
  }

  // Marcar como pendiente_revision + guardar diff
  const cambiosPendientes = {
    cambios,
    enviadoEn: nowIso(),
    desde: "whatsapp_magic_link",
  };

  await patchRecord("FINCAS", t.recordId, {
    ...cambios,
    estado: "pendiente_revision",
    cambios_pendientes: JSON.stringify(cambiosPendientes),
    fecha_solicitud: nowIso(),
    solicitud_origen: "whatsapp",
  });

  const lineas: string[] = [];
  if ("nombre" in cambios) lineas.push(`• Nombre: ${cambios.nombre}`);
  if ("movil" in cambios) lineas.push(`• Móvil: ${cambios.movil}`);
  if ("email" in cambios) lineas.push(`• Email: ${cambios.email || "(vacío)"}`);
  if ("municipio" in cambios) lineas.push(`• Municipio: (actualizado)`);
  if ("cultivos" in cambios)
    lineas.push(`• Cultivos: ${(cambios.cultivos as string[]).length} seleccionados`);

  return {
    ok: true,
    intent: "editar-finca",
    recordId: t.recordId,
    mensaje:
      "Cambios enviados. Tu coordinador los revisará antes de que queden firmes.",
    resumen: lineas.join("\n"),
  };
}

async function manejarEditarGenerador(
  t: EdicionToken,
  body: Record<string, unknown>
): Promise<ResultadoOk> {
  if (!t.recordId) throw new Error("Token sin recordId");
  const cambios: Record<string, unknown> = {};
  // Campos editables: nombre, dirección, móvil, email, tipo. NO: nit, tipopersona.
  for (const k of ["nombre", "movil", "email", "tipo"]) {
    if (k in body && body[k] != null) cambios[k] = asString(body[k]);
  }
  if ("direccion" in body) cambios.direccion_sede = asString(body.direccion);
  if ("municipioId" in body && typeof body.municipioId === "string" && body.municipioId) {
    cambios.municipio = [body.municipioId];
  }
  if (Object.keys(cambios).length === 0) {
    throw new Error("No se enviaron cambios");
  }

  const cambiosPendientes = {
    cambios,
    enviadoEn: nowIso(),
    desde: "whatsapp_magic_link",
  };

  await patchRecord("GENERADORES", t.recordId, {
    ...cambios,
    estado: "pendiente_revision",
    cambios_pendientes: JSON.stringify(cambiosPendientes),
    fecha_solicitud: nowIso(),
    solicitud_origen: "whatsapp",
  });

  const lineas: string[] = [];
  if ("nombre" in cambios) lineas.push(`• Nombre: ${cambios.nombre}`);
  if ("tipo" in cambios) lineas.push(`• Tipo actividad: ${cambios.tipo}`);
  if ("direccion_sede" in cambios)
    lineas.push(`• Dirección: ${cambios.direccion_sede || "(vacía)"}`);
  if ("movil" in cambios) lineas.push(`• Móvil: ${cambios.movil}`);
  if ("email" in cambios) lineas.push(`• Email: ${cambios.email || "(vacío)"}`);
  if ("municipio" in cambios) lineas.push(`• Municipio: (actualizado)`);

  return {
    ok: true,
    intent: "editar-generador",
    recordId: t.recordId,
    mensaje:
      "Cambios enviados. Tu coordinador los revisará antes de que queden firmes.",
    resumen: lineas.join("\n"),
  };
}

async function manejarCrearFinca(
  t: EdicionToken,
  body: Record<string, unknown>
): Promise<ResultadoOk> {
  if (!t.recordId) throw new Error("Token sin generador padre");
  const nombre = asString(body.nombre);
  const municipioId = asString(body.municipioId);
  const cultivos = asArray<string>(body.cultivosIds).filter(Boolean);
  if (!nombre) throw new Error("Falta nombre de la finca");
  if (!municipioId) throw new Error("Falta municipio");

  const movil = asString(body.movil) || t.telefonoValidado;
  const email = asString(body.email);

  const fields: Record<string, unknown> = {
    nombre,
    generador: [t.recordId],
    municipio: [municipioId],
    movil,
    email,
    estado: "pendiente",
    solicitud_origen: "whatsapp",
    fecha_solicitud: nowIso(),
  };
  if (cultivos.length > 0) fields.cultivos = cultivos;

  const created = await createRecord("FINCAS", fields);
  const lineas = [
    `• Nombre finca: ${nombre}`,
    `• Móvil: ${movil}`,
  ];
  if (email) lineas.push(`• Email: ${email}`);
  if (cultivos.length > 0) lineas.push(`• Cultivos: ${cultivos.length} seleccionados`);
  return {
    ok: true,
    intent: "crear-finca",
    recordId: created.id,
    mensaje:
      "Solicitud enviada. Tu coordinador aprobará la finca antes de que puedas generar certificados.",
    resumen: lineas.join("\n"),
  };
}

async function manejarRegistroGenerador(
  t: EdicionToken,
  body: Record<string, unknown>
): Promise<ResultadoOk> {
  const nombre = asString(body.nombre);
  const nit = asString(body.nit);
  const tipopersona = asString(body.tipopersona);
  const tipo = asString(body.tipo);
  const direccion = asString(body.direccion);
  const municipioId = asString(body.municipioId);
  const email = asString(body.email);
  const coordinadorSolicitadoId = asString(body.coordinadorSolicitadoId);
  const movil = asString(body.movil) || t.telefonoValidado;

  if (!nombre) throw new Error("Falta nombre / razón social");
  if (!nit) throw new Error("Falta cédula / NIT");
  if (!tipopersona) throw new Error("Falta tipo de persona");
  if (!tipo) throw new Error("Falta tipo (AGRICOLA / PECUARIO / ...)");

  const genFields: Record<string, unknown> = {
    nombre,
    nit,
    tipopersona,
    tipo,
    direccion_sede: direccion,
    movil,
    email,
    estado: "pendiente",
    solicitud_origen: "whatsapp",
    fecha_solicitud: nowIso(),
  };
  if (municipioId) genFields.municipio = [municipioId];
  if (coordinadorSolicitadoId) {
    genFields.coordinador_solicitado = [coordinadorSolicitadoId];
  } else if (WHATSAPP_FALLBACK_COORDINADOR_ID) {
    genFields.coordinador_solicitado = [WHATSAPP_FALLBACK_COORDINADOR_ID];
  }

  const created = await createRecord("GENERADORES", genFields);

  // Si el form incluyó primera finca, crearla ya vinculada al gen pendiente.
  const fincaBody = body.primera_finca as Record<string, unknown> | undefined;
  if (fincaBody && asString(fincaBody.nombre)) {
    const fincaFields: Record<string, unknown> = {
      nombre: asString(fincaBody.nombre),
      generador: [created.id],
      movil: asString(fincaBody.movil) || movil,
      email: asString(fincaBody.email) || email,
      estado: "pendiente",
      solicitud_origen: "whatsapp",
      fecha_solicitud: nowIso(),
    };
    const fincaMunicipio = asString(fincaBody.municipioId);
    if (fincaMunicipio) fincaFields.municipio = [fincaMunicipio];
    const fincaCultivos = asArray<string>(fincaBody.cultivosIds).filter(Boolean);
    if (fincaCultivos.length > 0) fincaFields.cultivos = fincaCultivos;
    await createRecord("FINCAS", fincaFields);
  }

  const lineas = [
    `• Nombre / razón social: ${nombre}`,
    `• Cédula / NIT: ${nit}`,
    `• Tipo persona: ${tipopersona}`,
    `• Tipo actividad: ${tipo}`,
  ];
  if (direccion) lineas.push(`• Dirección: ${direccion}`);
  lineas.push(`• Móvil: ${movil}`);
  if (email) lineas.push(`• Email: ${email}`);
  if (fincaBody && asString(fincaBody.nombre)) {
    lineas.push(`• Primera finca: ${asString(fincaBody.nombre)}`);
  }
  return {
    ok: true,
    intent: "registro-generador",
    recordId: created.id,
    mensaje:
      "Solicitud de registro enviada. Tu coordinador la aprobará para que puedas empezar a generar certificados.",
    resumen: lineas.join("\n"),
  };
}

// ─── Handler ───────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Token inválido" }, { status: 400 });
  }

  // Consumir token ATÓMICO. Si retorna null, no se puede usar.
  const t = await consumirToken(token);
  if (!t) {
    return NextResponse.json(
      {
        error:
          "Este link ya no es válido (puede que haya expirado o ya lo usaste). Vuelve a escribir al bot para recibir uno nuevo.",
        code: "INVALID",
      },
      { status: 410 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    let result: ResultadoOk;
    switch (t.intent) {
      case "cert-nuevo":
        result = await manejarCertNuevo(t, body);
        break;
      case "editar-finca":
        result = await manejarEditarFinca(t, body);
        break;
      case "editar-generador":
        result = await manejarEditarGenerador(t, body);
        break;
      case "crear-finca":
        result = await manejarCrearFinca(t, body);
        break;
      case "registro-generador":
        result = await manejarRegistroGenerador(t, body);
        break;
      default:
        throw new Error(`Intent desconocido: ${t.intent}`);
    }
    console.log(
      `[m/enviar] intent=${t.intent} record=${result.recordId} tel=${t.telefonoValidado}`
    );

    // Notificar al agricultor por WhatsApp que recibimos su solicitud
    // (background — no bloquea la respuesta del POST).
    after(async () => {
      try {
        const tipo = intentToNotifTipo(t.intent);
        const r = await notificarSolicitudRecibida({
          telefono: t.telefonoValidado,
          tipo,
          consecutivo: result.consecutivo,
          resumen: result.resumen,
          coordContactoWaUrl: result.coordContactoWaUrl,
        });
        console.log(`[m/enviar wa] ${r.ok ? "OK" : "FAIL"}: ${r.message}`);
      } catch (err) {
        console.error("[m/enviar wa] Error:", err);
      }
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[m/enviar] Error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 422 }
    );
  }
}
