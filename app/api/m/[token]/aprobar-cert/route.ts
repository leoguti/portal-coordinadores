/**
 * Enlace mágico de aprobación de certificados (email al coordinador).
 *
 *   GET  /api/m/[token]/aprobar-cert  → datos de la solicitud para la página
 *   POST /api/m/[token]/aprobar-cert  → aprueba el certificado
 *
 * El token es la auth (intent "aprobar-cert", TTL 7 días, un solo uso).
 * Invalidación doble:
 *   (a) SIEMPRE se verifica el estado vivo del certificado — si ya no está
 *       "pendiente" (se decidió por el link, por la bandeja o se anuló), el
 *       GET responde { resuelto: true } y el POST rechaza con 409.
 *   (b) el token se marca consumido al decidir (aquí o en rechazar-cert).
 */

import { NextRequest, NextResponse, after } from "next/server";
import { consumirToken, estaConsumido } from "@/lib/edicionTokens";
import {
  aprobarCertificado,
  cargarCertPendiente,
  normalizarDispositivo,
  DecisionCertError,
} from "@/lib/certificadosDecision";
import {
  validarTokenAprobacion,
  leerCert,
  coordIdParaDecision,
} from "@/lib/aprobarCertToken";
import { construirPdfProps } from "@/lib/certificadosCore";
import { resolveGeneradorDataFromFinca } from "@/lib/fincaGeneradorResolver";
import { normalizarMovilCO } from "@/lib/validacionesCO";

// Aprobar genera el PDF inline — mismo presupuesto que /aprobar del portal.
export const maxDuration = 60;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

// ─── GET: datos para la página ─────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const v = await validarTokenAprobacion(token);
  if ("error" in v) return v.error;
  const { t } = v;

  try {
    const rec = await leerCert(t.recordId!);
    if (!rec) {
      return NextResponse.json(
        { error: "Certificado no encontrado" },
        { status: 404 }
      );
    }
    const estado = String(rec.fields.estado || "");
    const consecutivo = Number(rec.fields.consecutivo) || 0;

    // Invalidación (a): estado vivo. Si ya se decidió (por este link, por la
    // bandeja o se anuló), la página muestra "ya fue resuelta" sin acciones.
    if (estado !== "pendiente" || estaConsumido(t)) {
      return NextResponse.json({
        resuelto: true,
        estado: estado || "desconocido",
        consecutivo,
      });
    }

    // Resolver datos frescos del generador/finca (igual que la aprobación).
    const fincaIds = Array.isArray(rec.fields.FINCAS)
      ? (rec.fields.FINCAS as string[])
      : [];
    const resolved = fincaIds[0]
      ? await resolveGeneradorDataFromFinca(
          AIRTABLE_API_KEY,
          AIRTABLE_BASE_ID,
          fincaIds[0]
        ).catch(() => null)
      : null;
    const p = construirPdfProps(rec.fields, resolved);

    const movilAgr10 = p.movilgenerador
      ? normalizarMovilCO(p.movilgenerador)
      : "";
    const waTexto = `Hola, soy tu coordinador de CampoLimpio. Estoy revisando tu solicitud de certificado #${consecutivo} y quiero confirmar unos datos contigo.`;
    const waAgricultorUrl = movilAgr10
      ? `https://wa.me/57${movilAgr10}?text=${encodeURIComponent(waTexto)}`
      : null;

    return NextResponse.json({
      resuelto: false,
      consecutivo,
      expiraEn: t.expira.toISOString(),
      coordinadorNombre: p.nombrecoordinador,
      waAgricultorUrl,
      solicitud: {
        nombreAgricultor: p.nombregenerador,
        cedulaAgricultor: p.cedulagenerador,
        finca: p.nombrefinca,
        municipioDevolucion: p.municipiodevolucion,
        lugarDevolucion: p.lugardevolucion,
        fechaRecoleccion: p.fechadevolucion,
        fechaSolicitud: String(rec.fields.fecha_solicitud || ""),
        rigidos: p.rigidos,
        flexibles: p.flexibles,
        metalicos: p.metalicos,
        embalaje: p.embalaje,
        total: p.total,
        triplelavado: p.triplelavado,
        observaciones: p.observaciones,
      },
    });
  } catch (err) {
    console.error("[m/aprobar-cert GET] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ─── POST: aprobar ─────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const v = await validarTokenAprobacion(token);
  if ("error" in v) return v.error;
  const { t } = v;

  if (estaConsumido(t)) {
    return NextResponse.json(
      { error: "Esta solicitud ya fue resuelta.", code: "RESUELTO" },
      { status: 409 }
    );
  }

  let body: { dispositivo?: string } = {};
  try {
    body = (await request.json()) as { dispositivo?: string };
  } catch {
    body = {};
  }

  try {
    // Invalidación (a): verifica estado vivo — 409 si ya no está pendiente.
    const rec = await cargarCertPendiente(t.recordId!);
    const coordId = coordIdParaDecision(t, rec);
    if (!coordId) {
      return NextResponse.json(
        { error: "El certificado no tiene coordinador asignado" },
        { status: 500 }
      );
    }

    const { consecutivo } = await aprobarCertificado({
      rec,
      coordId,
      meta: {
        via: "link",
        dispositivo: normalizarDispositivo(body.dispositivo),
      },
      after,
    });

    // Invalidación (b): consumir el token — el enlace queda de un solo uso.
    await consumirToken(token);

    return NextResponse.json({ ok: true, consecutivo, estado: "aprobado" });
  } catch (err) {
    if (err instanceof DecisionCertError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.status === 409 ? "RESUELTO" : undefined,
        },
        { status: err.status }
      );
    }
    console.error("[m/aprobar-cert POST] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
