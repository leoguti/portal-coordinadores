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
  crearToken,
  type EdicionToken,
  type Intent,
} from "@/lib/edicionTokens";
import { sendEmailAprobacionCert } from "@/lib/emailAprobacionCert";
import {
  crearRegistroCertificado,
  crearCertificadoCompleto,
} from "@/lib/certificadosCore";
import {
  notificarSolicitudRecibida,
  notificarCertAprobado,
} from "@/lib/textitNotify";
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
    case "editar-perfil":
      // El aviso al agricultor reutiliza el wording de "editar-generador"
      // por simplicidad — el resumen del cuerpo aclara qué cambió.
      return "editar-generador";
    case "crear-finca":
      return "crear-finca";
    case "registro-generador":
      return "registro-generador";
    case "cert-coordinador":
      // No se usa: el aviso de cert-coordinador es notificarCertAprobado
      // (con PDF), manejado aparte en el after() del POST.
      return "cert";
    case "aprobar-cert":
      // No se usa: los tokens aprobar-cert no pasan por /enviar (tienen sus
      // propios endpoints aprobar-cert / rechazar-cert).
      return "cert";
  }
}

// El cert del coordinador genera el PDF inline (render + Blob + R2) — igual
// presupuesto que /api/certificados/generar.
export const maxDuration = 60;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const WHATSAPP_FALLBACK_COORDINADOR_ID = process.env.WHATSAPP_FALLBACK_COORDINADOR_ID;
const PORTAL_BASE = (process.env.NEXTAUTH_URL || "https://portal.campolimpio.org").replace(/\/$/, "");
/** Vigencia del enlace de aprobación por email: 7 días. */
const APROBAR_CERT_TTL_MIN = 7 * 24 * 60;

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
  // Tolerar coma decimal ("10,5"): Number("10,5") = NaN → se volvía 0 silencioso
  const n = typeof v === "string" ? Number(v.trim().replace(",", ".")) : Number(v);
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
  /** URL permanente del PDF (solo cert-coordinador, para el aviso WA). */
  pdfUrl?: string;
  /** Resumen humano de los datos enviados — se envía al agricultor por WA
   *  para que pueda revisar errores antes de la aprobación del coord. */
  resumen?: string;
  /** wa.me corto del coord para contactarlo (solo en cert-nuevo). */
  coordContactoWaUrl?: string;
  /** Nombre del coord asignado — usado en el aviso "Recibimos…" para que
   *  el agricultor sepa exactamente quién va a revisar. */
  nombreCoordinador?: string;
}

function fmtNumKg(n: number): string {
  // Redondear a 3 decimales: 10.1+20.2 = 30.299999999999997 (artefacto de
  // punto flotante); 3 decimales preserva gramos de báscula (76.981 kg)
  return `${Math.round((n + Number.EPSILON) * 1000) / 1000} kg`;
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
): Promise<{ nombre: string; telefono: string; email: string }> {
  try {
    const r = await airtableFetch(`/Coordinadores/${coordinadorId}`);
    if (!r.ok) return { nombre: "", telefono: "", email: "" };
    const d = (await r.json()) as { fields: Record<string, unknown> };
    return {
      nombre: String(d.fields?.Name || "").trim(),
      telefono: String(d.fields?.telefono || "").trim(),
      email: String(d.fields?.email || "").trim(),
    };
  } catch {
    return { nombre: "", telefono: "", email: "" };
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

  // Verificar que la finca esté aprobada. Si está en pendiente_revision
  // (porque el agricultor editó datos y el coord aún no aprobó), bloquear
  // la generación del cert hasta que se apruebe.
  const fincaRec = await airtableFetch(`/FINCAS/${fincaId}`);
  if (!fincaRec.ok) {
    throw new Error("No se pudo verificar el estado de la finca");
  }
  const fincaData = (await fincaRec.json()) as { fields: Record<string, unknown> };
  const fincaEstado = String(fincaData.fields?.estado || "").toLowerCase();
  if (fincaEstado !== "aprobado") {
    throw new Error(
      "Tu finca está en revisión por el coordinador. No puedes generar certificados hasta que apruebe los cambios. Te avisaré por aquí cuando esté lista."
    );
  }

  const rigidos = asNumber(body.rigidos);
  const flexibles = asNumber(body.flexibles);
  const metalicos = asNumber(body.metalicos);
  const embalaje = asNumber(body.embalaje);
  if (rigidos + flexibles + metalicos + embalaje <= 0) {
    throw new Error("El total de kilos debe ser mayor a 0");
  }

  const triplelavado = asString(body.triplelavado);
  if (!["SI", "NO", "NO APLICA"].includes(triplelavado)) {
    throw new Error("Indica si hiciste triple lavado");
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
      triplelavado,
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
  const triplelavadoLbl = triplelavado;
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

  // Avisar al coordinador por EMAIL con un enlace mágico para decidir
  // (aprobar/rechazar). En background: si el email falla, la solicitud del
  // agricultor ya quedó creada y NO se bloquea su respuesta.
  const consecutivoCert = Number(result.fullRecord.fields.consecutivo) || 0;
  const telefonoAgricultor = t.telefonoValidado;
  after(async () => {
    try {
      const p = result.pdfProps;
      const tokenAprobacion = await crearToken({
        intent: "aprobar-cert",
        recordId: result.recordId,
        // Teléfono del agricultor que originó la solicitud (trazabilidad);
        // la auth de este token es el email del coordinador, no un teléfono.
        telefonoValidado: telefonoAgricultor,
        contexto: {
          coordinadorId,
          consecutivo: consecutivoCert,
          nombreAgricultor: p.nombregenerador,
          movilAgricultor: p.movilgenerador,
          finca: p.nombrefinca,
        },
        ttlMinutes: APROBAR_CERT_TTL_MIN,
      });

      const movilAgr10 = p.movilgenerador
        ? normalizarMovilCO(p.movilgenerador)
        : "";
      const waTexto = `Hola, soy tu coordinador de CampoLimpio. Estoy revisando tu solicitud de certificado #${consecutivoCert} y quiero confirmar unos datos contigo.`;
      const waAgricultorUrl = movilAgr10
        ? `https://wa.me/57${movilAgr10}?text=${encodeURIComponent(waTexto)}`
        : null;

      const emailRes = await sendEmailAprobacionCert({
        coordinadorEmail: coord.email,
        coordinadorNombre: coord.nombre,
        consecutivo: consecutivoCert,
        nombreAgricultor: p.nombregenerador,
        cedulaAgricultor: p.cedulagenerador,
        finca: p.nombrefinca || "",
        municipioDevolucion: p.municipiodevolucion,
        lugarDevolucion: p.lugardevolucion,
        fechaRecoleccion: p.fechadevolucion,
        rigidos: p.rigidos,
        flexibles: p.flexibles,
        metalicos: p.metalicos,
        embalaje: p.embalaje,
        total: p.total,
        triplelavado: p.triplelavado,
        observaciones: p.observaciones,
        urlDecision: `${PORTAL_BASE}/m/aprobar-cert/${tokenAprobacion.token}`,
        waAgricultorUrl,
        urlBandeja: `${PORTAL_BASE}/certificados/pendientes`,
      });
      console.log(
        `[m/enviar email-coord] ${emailRes.success ? "OK" : "FAIL"}: ${emailRes.message}`
      );
    } catch (err) {
      console.error("[m/enviar email-coord] Error:", err);
    }
  });

  return {
    ok: true,
    intent: "cert-nuevo",
    recordId: result.recordId,
    consecutivo: consecutivoCert || undefined,
    mensaje:
      "Solicitud enviada. Tu coordinador la revisará y la aprobará, y luego recibirás el PDF.",
    resumen: lineas.join("\n"),
    coordContactoWaUrl,
    nombreCoordinador: coord.nombre || undefined,
  };
}

/**
 * Certificado generado por un COORDINADOR desde WhatsApp (intent
 * cert-coordinador). A diferencia de cert-nuevo:
 *   - La finca puede ser CUALQUIERA (el token del coordinador es la auth).
 *   - Sale en estado "aprobado" de una vez, con PDF inline — paridad con el
 *     portal del coordinador.
 *   - coordinadorId = recordId del token (no viene del body).
 */
async function manejarCertCoordinador(
  t: EdicionToken,
  body: Record<string, unknown>
): Promise<ResultadoOk> {
  const coordinadorId = t.recordId;
  if (!coordinadorId) throw new Error("Token sin coordinador");

  const fincaId = asString(body.fincaId);
  const municipioDevolucionId = asString(body.municipioDevolucionId);
  const fechadevolucion = asString(body.fechadevolucion);
  if (!fincaId) throw new Error("Falta seleccionar la finca");
  if (!municipioDevolucionId) throw new Error("Falta el municipio de devolución");
  if (!fechadevolucion) throw new Error("Falta la fecha de recolección");

  const rigidos = asNumber(body.rigidos);
  const flexibles = asNumber(body.flexibles);
  const metalicos = asNumber(body.metalicos);
  const embalaje = asNumber(body.embalaje);
  if (rigidos + flexibles + metalicos + embalaje <= 0) {
    throw new Error("El total de kilos debe ser mayor a 0");
  }
  const triplelavado = asString(body.triplelavado);
  if (!["SI", "NO", "NO APLICA"].includes(triplelavado)) {
    throw new Error("Indica si se hizo triple lavado");
  }

  const result = await crearCertificadoCompleto(
    {
      fincaId,
      coordinadorId,
      municipioDevolucionId,
      rigidos,
      flexibles,
      metalicos,
      embalaje,
      triplelavado,
      lugardevolucion: asString(body.lugardevolucion),
      fechadevolucion,
      observaciones: asString(body.observaciones),
    },
    {
      estado: "aprobado",
      solicitudOrigen: "whatsapp",
      fechaSolicitud: nowIso(),
      after,
    }
  );

  const coord = await coordinadorInfo(coordinadorId);
  return {
    ok: true,
    intent: "cert-coordinador",
    recordId: result.recordId,
    consecutivo: result.consecutivo || undefined,
    pdfUrl: result.r2Url || result.pdfUrl || undefined,
    nombreCoordinador: coord.nombre || undefined,
    mensaje: `Certificado #${result.consecutivo} generado y aprobado. Te llega el PDF por WhatsApp en un momento.`,
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

  // Staging: NO aplicar al record. Solo guardar diff.
  await patchRecord("FINCAS", t.recordId, {
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
  // Campos editables: nombre, dirección, email, tipo. NO: nit, tipopersona,
  // ni MOVIL — el móvil del titular es la identidad del bot (decisión
  // 2026-06-11, opción A): cambiarlo solo puede hacerlo el coordinador
  // desde el portal tras verificar por su canal.
  for (const k of ["nombre", "email", "tipo"]) {
    if (k in body && body[k] != null) cambios[k] = asString(body[k]);
  }
  if ("direccion" in body) cambios.direccion_sede = asString(body.direccion);
  if ("municipioId" in body && typeof body.municipioId === "string" && body.municipioId) {
    cambios.municipio = [body.municipioId];
  }
  if (Object.keys(cambios).length === 0) {
    throw new Error("No se enviaron cambios");
  }

  const coordinadorId = asString(body.coordinadorId);
  if (!coordinadorId) {
    throw new Error("Falta coordinadorId que revisará el cambio");
  }

  const cambiosPendientes = {
    cambios,
    enviadoEn: nowIso(),
    desde: "whatsapp_magic_link",
  };

  // Staging: NO aplicar al record. Solo guardar diff.
  await patchRecord("GENERADORES", t.recordId, {
    estado: "pendiente_revision",
    cambios_pendientes: JSON.stringify(cambiosPendientes),
    fecha_solicitud: nowIso(),
    solicitud_origen: "whatsapp",
    coordinador_solicitado: [coordinadorId],
  });

  const lineas: string[] = [];
  if ("nombre" in cambios) lineas.push(`• Nombre: ${cambios.nombre}`);
  if ("tipo" in cambios) lineas.push(`• Tipo actividad: ${cambios.tipo}`);
  if ("direccion_sede" in cambios)
    lineas.push(`• Dirección: ${cambios.direccion_sede || "(vacía)"}`);
  if ("email" in cambios) lineas.push(`• Email: ${cambios.email || "(vacío)"}`);
  if ("municipio" in cambios) lineas.push(`• Municipio: (actualizado)`);

  const coord = await coordinadorInfo(coordinadorId);
  return {
    ok: true,
    intent: "editar-generador",
    recordId: t.recordId,
    mensaje:
      "Cambios enviados. Tu coordinador los revisará antes de que queden firmes.",
    resumen: lineas.join("\n"),
    nombreCoordinador: coord.nombre || undefined,
  };
}

async function manejarEditarPerfil(
  t: EdicionToken,
  body: Record<string, unknown>
): Promise<ResultadoOk> {
  if (!t.recordId) throw new Error("Token sin recordId");
  const coordinadorId = asString(body.coordinadorId);
  if (!coordinadorId) {
    throw new Error("Falta coordinadorId que revisará el cambio");
  }

  const empresaInput = (body.empresa as Record<string, unknown> | null) || null;
  const fincasInput = asArray<Record<string, unknown>>(body.fincas);

  if (!empresaInput && fincasInput.length === 0) {
    throw new Error("No se enviaron cambios");
  }

  const resumenLineas: string[] = [];

  // Empresa (opcional). El móvil del titular NO es editable por acá —
  // es la identidad del bot (decisión 2026-06-11, opción A).
  if (empresaInput) {
    const cambiosEmpresa: Record<string, unknown> = {};
    for (const k of ["nombre", "email", "tipo"]) {
      if (k in empresaInput && empresaInput[k] != null)
        cambiosEmpresa[k] = asString(empresaInput[k]);
    }
    if ("direccion" in empresaInput)
      cambiosEmpresa.direccion_sede = asString(empresaInput.direccion);
    if (
      "municipioId" in empresaInput &&
      typeof empresaInput.municipioId === "string" &&
      empresaInput.municipioId
    ) {
      cambiosEmpresa.municipio = [empresaInput.municipioId];
    }
    if (Object.keys(cambiosEmpresa).length > 0) {
      const cambiosPendientes = {
        cambios: cambiosEmpresa,
        enviadoEn: nowIso(),
        desde: "whatsapp_magic_link",
      };
      // Staging: NO aplicamos cambios al record — solo el diff.
      await patchRecord("GENERADORES", t.recordId, {
        estado: "pendiente_revision",
        cambios_pendientes: JSON.stringify(cambiosPendientes),
        fecha_solicitud: nowIso(),
        solicitud_origen: "whatsapp",
        coordinador_solicitado: [coordinadorId],
      });
      resumenLineas.push("📋 Cambios en la empresa:");
      if ("nombre" in cambiosEmpresa)
        resumenLineas.push(`  • Nombre: ${cambiosEmpresa.nombre}`);
      if ("tipo" in cambiosEmpresa)
        resumenLineas.push(`  • Tipo: ${cambiosEmpresa.tipo}`);
      if ("direccion_sede" in cambiosEmpresa)
        resumenLineas.push(
          `  • Dirección: ${cambiosEmpresa.direccion_sede || "(vacía)"}`
        );
      if ("email" in cambiosEmpresa)
        resumenLineas.push(`  • Email: ${cambiosEmpresa.email || "(vacío)"}`);
      if ("municipio" in cambiosEmpresa)
        resumenLineas.push(`  • Municipio: (actualizado)`);
    }
  }

  // Fincas (opcional, multi)
  for (const f of fincasInput) {
    const fincaId = asString(f.id);
    if (!fincaId) continue;
    const cambiosFinca: Record<string, unknown> = {};
    for (const k of ["nombre", "movil", "email"]) {
      if (k in f && f[k] != null) cambiosFinca[k] = asString(f[k]);
    }
    if ("municipioId" in f && typeof f.municipioId === "string" && f.municipioId) {
      cambiosFinca.municipio = [f.municipioId];
    }
    if ("cultivosIds" in f) {
      const ids = asArray<string>(f.cultivosIds).filter(Boolean);
      if (ids.length > 0) cambiosFinca.cultivos = ids;
    }
    if (Object.keys(cambiosFinca).length === 0) continue;
    const cambiosPendientes = {
      cambios: cambiosFinca,
      enviadoEn: nowIso(),
      desde: "whatsapp_magic_link",
    };
    // Staging: NO aplicamos los cambios al record. Solo guardamos el
    // diff en cambios_pendientes — aprobar lo aplicará, rechazar lo
    // descartará.
    await patchRecord("FINCAS", fincaId, {
      estado: "pendiente_revision",
      cambios_pendientes: JSON.stringify(cambiosPendientes),
      fecha_solicitud: nowIso(),
      solicitud_origen: "whatsapp",
    });
    const nombreFinca = (cambiosFinca.nombre as string) || fincaId;
    resumenLineas.push(`🌱 Cambios en finca *${nombreFinca}*:`);
    if ("nombre" in cambiosFinca)
      resumenLineas.push(`  • Nombre: ${cambiosFinca.nombre}`);
    if ("movil" in cambiosFinca)
      resumenLineas.push(`  • Móvil: ${cambiosFinca.movil}`);
    if ("email" in cambiosFinca)
      resumenLineas.push(`  • Email: ${cambiosFinca.email || "(vacío)"}`);
    if ("municipio" in cambiosFinca)
      resumenLineas.push(`  • Municipio: (actualizado)`);
    if ("cultivos" in cambiosFinca)
      resumenLineas.push(
        `  • Cultivos: ${(cambiosFinca.cultivos as string[]).length} seleccionados`
      );
  }

  if (resumenLineas.length === 0) {
    throw new Error("No se detectaron cambios reales");
  }

  const coord = await coordinadorInfo(coordinadorId);
  return {
    ok: true,
    intent: "editar-perfil",
    recordId: t.recordId,
    mensaje:
      "Cambios enviados. Tu coordinador los revisará antes de que queden firmes.",
    resumen: resumenLineas.join("\n"),
    nombreCoordinador: coord.nombre || undefined,
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
  // Nombre del coord que revisará (el solicitado o el fallback).
  const coordEfectivoId =
    coordinadorSolicitadoId || WHATSAPP_FALLBACK_COORDINADOR_ID || "";
  const coord = coordEfectivoId
    ? await coordinadorInfo(coordEfectivoId)
    : { nombre: "", telefono: "" };
  return {
    ok: true,
    intent: "registro-generador",
    recordId: created.id,
    mensaje:
      "Solicitud de registro enviada. Tu coordinador la aprobará para que puedas empezar a generar certificados.",
    resumen: lineas.join("\n"),
    nombreCoordinador: coord.nombre || undefined,
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
      case "editar-perfil":
        result = await manejarEditarPerfil(t, body);
        break;
      case "crear-finca":
        result = await manejarCrearFinca(t, body);
        break;
      case "registro-generador":
        result = await manejarRegistroGenerador(t, body);
        break;
      case "cert-coordinador":
        result = await manejarCertCoordinador(t, body);
        break;
      default:
        throw new Error(`Intent desconocido: ${t.intent}`);
    }
    console.log(
      `[m/enviar] intent=${t.intent} record=${result.recordId} tel=${t.telefonoValidado}`
    );

    // Notificar por WhatsApp (background — no bloquea la respuesta del POST).
    // cert-coordinador: el cert ya salió aprobado → mandar directamente el
    // PDF al coordinador (mismo aviso bonito de la aprobación).
    // Resto de intents: aviso "Recibimos tu solicitud…" al agricultor.
    after(async () => {
      try {
        if (t.intent === "cert-coordinador") {
          if (result.consecutivo && result.pdfUrl) {
            const r = await notificarCertAprobado({
              telefono: t.telefonoValidado,
              consecutivo: result.consecutivo,
              pdfUrl: result.pdfUrl,
              nombreCoordinador: result.nombreCoordinador || "Coordinador",
            });
            console.log(
              `[m/enviar wa coord] ${r.ok ? "OK" : "FAIL"}: ${r.message}`
            );
          }
          return;
        }
        const tipo = intentToNotifTipo(t.intent);
        const r = await notificarSolicitudRecibida({
          telefono: t.telefonoValidado,
          tipo,
          consecutivo: result.consecutivo,
          resumen: result.resumen,
          coordContactoWaUrl: result.coordContactoWaUrl,
          nombreCoordinador: result.nombreCoordinador,
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
