import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  TIPOS_DOCUMENTO,
  TipoDocumento,
  construirKeyR2,
  crearRegistroDocumento,
  listarDocumentosTercero,
  sha256Hex,
  subirArchivoR2,
} from "@/lib/documentosTerceros";
import { analizarPdf, esPdf, motivoRechazoPdf } from "@/lib/pdfProtegido";
import { isAdmin } from "@/lib/roles";

export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const TIPOS_ARCHIVO_OK = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

/**
 * GET /api/documentos-terceros?terceroId=recXXX
 * Historial de versiones de documentos del tercero (todas, nunca se borran).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const terceroId = req.nextUrl.searchParams.get("terceroId");
  if (!terceroId) {
    return NextResponse.json({ error: "terceroId requerido" }, { status: 400 });
  }
  try {
    const documentos = await listarDocumentosTercero(terceroId);
    // El key de R2 no se expone al cliente: el archivo se sirve por id.
    return NextResponse.json({
      documentos: documentos.map(({ archivoKey: _omit, ...d }) => d),
    });
  } catch (err) {
    console.error("[documentos-terceros] GET error:", err);
    return NextResponse.json({ error: "Error listando documentos" }, { status: 500 });
  }
}

/**
 * POST /api/documentos-terceros — multipart/form-data
 *   file: File · terceroId · tipo · fechaExpedicion? (YYYY-MM-DD)
 *
 * Crea la versión n+1 del documento (nunca reemplaza ni borra). El archivo va
 * a R2 con key aleatoria; el registro nace en estado `pendiente`.
 * No existe DELETE: los documentos no se borran desde el portal.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Se espera multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  const terceroId = String(form.get("terceroId") || "").trim();
  const tipo = String(form.get("tipo") || "").trim() as TipoDocumento;
  const fechaExpedicion = String(form.get("fechaExpedicion") || "").trim() || null;
  // Solo administradores: subir y aprobar en el acto (documento que el
  // propio admin tiene a la mano y revisa al subirlo).
  const aprobarDirecto =
    String(form.get("aprobarDirecto") || "") === "1" && isAdmin(session.user.rol);

  if (!file || !terceroId || !tipo) {
    return NextResponse.json(
      { error: "Faltan campos: file, terceroId, tipo" },
      { status: 400 }
    );
  }
  if (!TIPOS_DOCUMENTO.includes(tipo)) {
    return NextResponse.json({ error: `Tipo de documento inválido: ${tipo}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el máximo de 15 MB" },
      { status: 400 }
    );
  }
  if (file.type && !TIPOS_ARCHIVO_OK.has(file.type)) {
    return NextResponse.json(
      { error: "Solo se aceptan PDF o imágenes (JPG, PNG, WebP)" },
      { status: 400 }
    );
  }
  if (fechaExpedicion && !/^\d{4}-\d{2}-\d{2}$/.test(fechaExpedicion)) {
    return NextResponse.json(
      { error: "fechaExpedicion debe ser YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    // Nombre del tercero (para la etiqueta legible del registro).
    const tRes = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Terceros/${terceroId}`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` }, cache: "no-store" }
    );
    if (!tRes.ok) {
      return NextResponse.json({ error: "Tercero no encontrado" }, { status: 404 });
    }
    const tercero = await tRes.json();
    const terceroNombre = String(tercero.fields?.RazonSocial || terceroId);

    // Versionado: n+1 sobre lo existente del mismo tipo.
    const existentes = await listarDocumentosTercero(terceroId);
    const delTipo = existentes.filter((d) => d.tipo === tipo);
    const version = delTipo.reduce((m, d) => Math.max(m, d.version), 0) + 1;
    const desmarcarVigentes = delTipo.filter((d) => d.vigente).map((d) => d.id);

    // Candado: sobre un documento APROBADO no se aceptan versiones nuevas
    // hasta la ventana de renovación (30 días antes del vencimiento). Los
    // administradores no pasan por la regla (pueden corregir siempre).
    if (!isAdmin(session.user.rol)) {
      const { puedeSubirVersion } = await import("@/lib/documentosTercerosReglas");
      const regla = puedeSubirVersion(delTipo, tipo);
      if (!regla.permitido) {
        return NextResponse.json({ error: regla.motivo }, { status: 403 });
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // PDFs con clave de apertura o dañados se rechazan en el acto (sin IA:
    // detección determinística con pdfjs). Los "restringidos" (solo permisos,
    // típicos de certificaciones bancarias) sí pasan.
    if (esPdf(file.name || "", file.type)) {
      const analisis = await analizarPdf(buffer);
      const motivo = motivoRechazoPdf(analisis);
      if (motivo) {
        return NextResponse.json({ error: motivo }, { status: 400 });
      }
    }

    const key = construirKeyR2(terceroId, tipo, version, file.name || "documento.pdf");
    await subirArchivoR2(key, buffer, file.type || "application/octet-stream");

    const docId = await crearRegistroDocumento({
      terceroId,
      terceroNombre,
      tipo,
      version,
      archivoKey: key,
      archivoNombre: file.name || `documento-v${version}`,
      archivoHash: sha256Hex(buffer),
      archivoSize: buffer.length,
      subidoPorId: session.user.coordinatorRecordId,
      fechaExpedicion,
      origen: "portal",
      desmarcarVigentes,
      estadoInicial: aprobarDirecto ? "aprobado" : "pendiente",
      aprobadoPorId: aprobarDirecto ? session.user.coordinatorRecordId : null,
    });

    return NextResponse.json(
      { id: docId, version, tipo, estado: aprobarDirecto ? "aprobado" : "pendiente" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[documentos-terceros] POST error:", err);
    return NextResponse.json({ error: "Error subiendo el documento" }, { status: 500 });
  }
}
