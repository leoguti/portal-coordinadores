/**
 * Núcleo de certificados — funciones puras reutilizables por:
 *   - POST /api/certificados/generar (portal directo)
 *   - POST /api/certificados/[id]/aprobar (flujo magic-link con aprobación)
 *
 * Separación de responsabilidades:
 *   - crearRegistroCertificado(): crea record en Airtable + lee con lookups + arma pdfProps
 *   - generarYAdjuntarPDF():       genera PDF + Blob + PATCH attach + after() para R2/Neon/email
 *   - crearCertificadoCompleto():  combina ambos, comportamiento histórico del endpoint /generar
 */

import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Client as PgClient } from "pg";
import CertificadoPDF from "@/components/pdf/CertificadoPDF";
import type { CertificadoPDFProps } from "@/components/pdf/CertificadoPDF";
import { sendCertificadoEmail } from "@/lib/sendCertificadoEmail";
import { roundKg } from "@/lib/kilos";
import {
  resolveGeneradorDataFromFinca,
  type ResolvedGeneradorData,
} from "@/lib/fincaGeneradorResolver";
import { validarFechaDevolucion } from "@/lib/certificadosReglas";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ||
  "https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev";

// ─── Tipos públicos ────────────────────────────────────────────────────────

export interface CertificadoInput {
  /** Vía nueva (esquema GENERADORES/FINCAS). Prioritaria sobre ubicacionId. */
  fincaId?: string;
  /** Vía legacy (esquema ubicaciones). Fallback mientras se migra Telegram. */
  ubicacionId?: string;
  coordinadorId: string;
  municipioDevolucionId: string;
  rigidos: number;
  flexibles: number;
  metalicos: number;
  embalaje: number;
  triplelavado: string;
  lugardevolucion: string;
  fechadevolucion: string;
  observaciones?: string;
}

export interface CertificadoEstadoOpts {
  /** Estado inicial del registro en Airtable. Default "aprobado" (portal directo). */
  estado?: "pendiente" | "aprobado";
  /** Origen de la solicitud — para auditoría. */
  solicitudOrigen?: "portal" | "whatsapp" | "telegram";
  /** ISO timestamp de cuándo el agricultor envió la solicitud (solo si WhatsApp/Telegram). */
  fechaSolicitud?: string;
}

export interface RegistroCreado {
  recordId: string;
  /** Datos completos leídos de vuelta de Airtable (con lookups resueltos). */
  fullRecord: { id: string; fields: Record<string, unknown>; createdTime: string };
  /** Props ya armadas para renderizar el PDF. */
  pdfProps: CertificadoPDFProps;
  /** Resultado del resolver (solo en vía nueva). */
  resolved: ResolvedGeneradorData | null;
}

export interface GenerarPDFInput {
  recordId: string;
  pdfProps: CertificadoPDFProps;
  coordinadorId: string;
  municipioDevolucionId: string;
  airtableCreatedTime: string;
  /**
   * Cuándo registrar trabajo en background. Pasar `after` de "next/server"
   * cuando se invoque desde una API route — fuera de Next, se ejecuta sin
   * diferir.
   */
  after?: (cb: () => Promise<void>) => void;
}

export interface PDFGenerado {
  consecutivo: number;
  pdfUrl: string;
  /**
   * URL permanente del PDF en R2 (Cloudflare). Solo se llena si el upload
   * a R2 fue exitoso. Usar esta URL para enlaces que el usuario reciba
   * (WhatsApp, email) — `pdfUrl` (Vercel Blob) se borra a los 60s.
   */
  r2Url: string | null;
}

// ─── Helpers internos ──────────────────────────────────────────────────────

/** Formatea un ISO timestamp a fecha/hora legible en zona Bogotá: "12/06/2026 14:32". */
export function formatearFechaBogota(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(d)
    .replace(",", "");
}

async function uploadToR2(pdfBuffer: Buffer, filename: string): Promise<string> {
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: `pdfs/${filename}`,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  const url = `${R2_PUBLIC_URL}/pdfs/${filename}`;
  console.log(`[certificados/r2] PDF uploaded: ${url}`);
  return url;
}

async function backupToNeon(
  airtableId: string,
  pdfProps: CertificadoPDFProps,
  pdfBuffer: Buffer,
  r2Url: string | null,
  coordinadorAirtableId: string,
  municipioDevolucionAirtableId: string,
  airtableCreatedTime: string,
  fuente: string = "portal"
) {
  const tag = "[certificados/backup]";
  try {
    const filename = `certificado_${pdfProps.consecutivo}.pdf`;
    const pg = new PgClient({
      connectionString: process.env.NEON_DATABASE_URL!,
    });
    await pg.connect();

    const p = pdfProps;
    const year = p.fechadevolucion
      ? new Date(p.fechadevolucion).getFullYear()
      : null;

    await pg.query(
      `INSERT INTO certificados (
        airtable_id, consecutivo,
        nombregenerador, cedulagenerador, emailgenerador, movilgenerador,
        tipogenerador, cultivogenerador, direcciongenerador, municipiogenerador,
        coordinador_airtable_id, nombrecoordinador, emailcoordinador, movilcoordinador,
        fechadevolucion, lugardevolucion, municipiodevolucion, idmunicipiodevolucion_airtable,
        rigidos, flexibles, metalicos, embalaje, total,
        triplelavado, ano,
        certificadopdf_filename, certificadopdf_r2_url, certificadopdf_size,
        airtable_created_time, observaciones, fuente
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
      ) ON CONFLICT (airtable_id) DO NOTHING`,
      [
        airtableId,
        p.consecutivo,
        p.nombregenerador || null,
        p.cedulagenerador || null,
        p.emailgenerador || null,
        p.movilgenerador || null,
        p.tipogenerador || null,
        p.cultivogenerador || null,
        p.direcciongenerador || null,
        p.municipiogenerador || null,
        coordinadorAirtableId,
        p.nombrecoordinador || null,
        p.emailcoordinador || null,
        p.movilcoordinador || null,
        p.fechadevolucion || null,
        p.lugardevolucion || null,
        p.municipiodevolucion || null,
        municipioDevolucionAirtableId,
        p.rigidos,
        p.flexibles,
        p.metalicos,
        p.embalaje,
        p.total,
        p.triplelavado || null,
        year,
        r2Url ? filename : null,
        r2Url,
        r2Url ? pdfBuffer.length : null,
        airtableCreatedTime,
        p.observaciones || null,
        fuente,
      ]
    );

    await pg.end();
    console.log(`${tag} Certificate #${p.consecutivo} backed up to Neon`);
  } catch (err) {
    console.error(`${tag} Neon backup failed (non-blocking):`, err);
  }
}

// ─── API pública ───────────────────────────────────────────────────────────

/**
 * Crea el record en Airtable y devuelve los datos listos para generar el PDF.
 * No genera el PDF: eso se hace en `generarYAdjuntarPDF`.
 */
export async function crearRegistroCertificado(
  input: CertificadoInput,
  opts: CertificadoEstadoOpts = {}
): Promise<RegistroCreado> {
  const useFinca = Boolean(input.fincaId);

  if (
    (!input.fincaId && !input.ubicacionId) ||
    !input.coordinadorId ||
    !input.municipioDevolucionId
  ) {
    throw new Error(
      "Faltan campos requeridos: (fincaId o ubicacionId), coordinadorId, municipioDevolucionId"
    );
  }

  // Política de fechas unificada (las 3 vías pasan por aquí).
  const errorFecha = validarFechaDevolucion(input.fechadevolucion || "");
  if (errorFecha) throw new Error(errorFecha);

  // Resolver datos de finca (vía nueva) antes de crear, para fallar temprano.
  let resolved: ResolvedGeneradorData | null = null;
  if (useFinca) {
    resolved = await resolveGeneradorDataFromFinca(
      AIRTABLE_API_KEY,
      AIRTABLE_BASE_ID,
      input.fincaId!
    );
  }

  const fields: Record<string, unknown> = {
    coordinador: [input.coordinadorId],
    idmunicipiodevolucion: [input.municipioDevolucionId],
    rigidos: input.rigidos || 0,
    flexibles: input.flexibles || 0,
    metalicos: input.metalicos || 0,
    embalaje: input.embalaje || 0,
    observaciones: input.observaciones || "",
    triplelavado: input.triplelavado || "PENDIENTE",
    lugardevolucion: input.lugardevolucion || "",
    fechadevolucion: input.fechadevolucion || "",
  };

  // Campos del flujo de aprobación (V4). Si la tabla no los tiene aún,
  // typecast:true los crea como single-select / text según definición.
  //
  // IMPORTANTE: si el caller no pasó un estado explícito, asumimos
  // "aprobado". Esto cubre el flujo del portal del coordinador (genera cert
  // directo, no pasa por aprobación). Solo el flujo WhatsApp pasa
  // estado="pendiente" explícitamente.
  fields.estado = opts.estado || "aprobado";
  if (opts.solicitudOrigen) fields.solicitud_origen = opts.solicitudOrigen;
  if (opts.fechaSolicitud) fields.fecha_solicitud = opts.fechaSolicitud;

  if (useFinca && resolved) {
    fields.FINCAS = [resolved.fincaId];
    if (resolved.cultivoIds.length > 0) {
      fields.cultivos_certificado = resolved.cultivoIds;
    }
  } else {
    fields.link_ubicacion = [input.ubicacionId];
  }

  const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados`;
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, typecast: true }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Airtable create failed: ${errorText}`);
  }
  const createData = await createResponse.json();
  const recordId = createData.id as string;

  // Releer para obtener lookups (consecutivo + datos del coord).
  const readUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${recordId}`;
  const readResponse = await fetch(readUrl, {
    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
  });
  if (!readResponse.ok) {
    const errorText = await readResponse.text();
    throw new Error(`Airtable read failed: ${errorText}`);
  }
  const fullRecord = await readResponse.json();

  // Fechas del pie de página del PDF. En el flujo directo (portal/Telegram,
  // estado aprobado de una) generación y aprobación coinciden con la creación
  // del registro. En el flujo con aprobación (WhatsApp) el PDF NO se genera
  // aquí sino en /aprobar, que pasa sus propias fechas.
  const esAprobadoDirecto = (opts.estado || "aprobado") === "aprobado";
  const pdfProps = construirPdfProps(fullRecord.fields, resolved, {
    generacion: opts.fechaSolicitud || fullRecord.createdTime,
    aprobacion: esAprobadoDirecto ? fullRecord.createdTime : undefined,
  });

  return { recordId, fullRecord, pdfProps, resolved };
}

/**
 * Arma las props del PDF a partir de los campos leídos del record.
 * Útil también para `/aprobar`, donde el record ya existía y solo necesitamos
 * volver a construir las props para regenerar el PDF.
 */
export function construirPdfProps(
  fields: Record<string, unknown>,
  resolved: ResolvedGeneradorData | null,
  fechas?: { generacion?: string; aprobacion?: string }
): CertificadoPDFProps {
  const f = fields as Record<string, unknown>;
  const firstStr = (v: unknown): string => {
    if (Array.isArray(v) && v.length > 0) return String(v[0]);
    return "";
  };
  return {
    consecutivo: Number(f.consecutivo) || 0,
    nombregenerador: resolved ? resolved.nombregenerador : firstStr(f.nombregenerador),
    cedulagenerador: resolved ? resolved.cedulagenerador : firstStr(f.cedulagenerador),
    movilgenerador: resolved ? resolved.movilgenerador : firstStr(f.movilgenerador),
    direcciongenerador: resolved ? resolved.direcciongenerador : firstStr(f.direcciongenerador),
    cultivogenerador: resolved ? resolved.cultivogenerador : firstStr(f.cultivogenerador),
    emailgenerador: resolved ? resolved.emailgenerador : firstStr(f.emailgenerador),
    municipiogenerador: resolved ? resolved.municipiogenerador : firstStr(f.municipiogenerador),
    tipogenerador: resolved ? resolved.tipogenerador : firstStr(f.tipogenerador),
    nombrefinca: resolved?.fincaNombre || "",
    // roundKg: la fórmula `total` de Airtable llega con artefactos de punto
    // flotante por la API (437.9+332.2 → 770.0999999999999) — bug 2026-07-08
    rigidos: roundKg(Number(f.rigidos) || 0),
    flexibles: roundKg(Number(f.flexibles) || 0),
    metalicos: roundKg(Number(f.metalicos) || 0),
    embalaje: roundKg(Number(f.embalaje) || 0),
    total: roundKg(Number(f.total) || 0),
    triplelavado: String(f.triplelavado || ""),
    lugardevolucion: String(f.lugardevolucion || ""),
    municipiodevolucion: firstStr(f.municipiodevolucion),
    fechadevolucion: String(f.fechadevolucion || ""),
    nombrecoordinador: firstStr(f.nombrecoordinador),
    movilcoordinador: firstStr(f.movilcoordinador),
    emailcoordinador: firstStr(f.emailcoordinador),
    observaciones: String(f.observaciones || ""),
    fechageneracion: formatearFechaBogota(
      fechas?.generacion || String(f.fecha_solicitud || "")
    ),
    fechaaprobacion: formatearFechaBogota(
      fechas?.aprobacion || String(f.fecha_aprobacion || "")
    ),
  };
}

/**
 * Render PDF + Blob + PATCH attach. Programa R2/Neon/email/cleanup en background
 * vía `after` (si se provee).
 */
export async function generarYAdjuntarPDF(
  input: GenerarPDFInput,
  fuenteBackup: string = "portal"
): Promise<PDFGenerado> {
  const { recordId, pdfProps, coordinadorId, municipioDevolucionId, airtableCreatedTime } = input;

  // 1. Render PDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(CertificadoPDF, pdfProps) as any;
  const pdfBuffer = await renderToBuffer(element);
  console.log(`[certificados/core] PDF generated: ${pdfBuffer.length} bytes`);

  // 2. Upload to Vercel Blob
  const { put, del } = await import("@vercel/blob");
  const filename = `certificado_${pdfProps.consecutivo}.pdf`;
  const blob = await put(filename, pdfBuffer, {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: true,
  });
  console.log(`[certificados/core] Blob uploaded: ${blob.url}`);

  // 3. PATCH Airtable con URL del PDF
  const patchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${recordId}`;
  const patchResponse = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: { certificadopdf: [{ url: blob.url }] },
    }),
  });

  if (!patchResponse.ok) {
    const errorText = await patchResponse.text();
    await del(blob.url);
    throw new Error(`Airtable PDF attach failed: ${errorText}`);
  }

  // 4. R2 upload SINCRÓNICO (~200-500ms). El R2 URL es permanente y se
  // devuelve al caller para usar en mensajes que el agricultor recibe
  // (WhatsApp, email). El Blob temporal se borra en 60s en background.
  let r2Url: string | null = null;
  try {
    r2Url = await uploadToR2(pdfBuffer, filename);
  } catch (err) {
    console.error("[certificados/core] R2 upload failed (non-blocking):", err);
  }

  // 5. Background: Neon + email + cleanup del blob (R2 ya está hecho).
  const blobUrl = blob.url;
  const backgroundWork = async () => {
    await backupToNeon(
      recordId,
      pdfProps,
      pdfBuffer,
      r2Url,
      coordinadorId,
      municipioDevolucionId,
      airtableCreatedTime,
      fuenteBackup
    );
    try {
      const emailRecipients = [
        "certificados@campolimpio.org",
        "leogiga@gmail.com",
        pdfProps.emailgenerador,
        pdfProps.emailcoordinador,
      ].filter(Boolean);
      if (emailRecipients.length > 0) {
        const emailResult = await sendCertificadoEmail({
          consecutivo: pdfProps.consecutivo,
          pdfBuffer: Buffer.from(pdfBuffer),
          emails: emailRecipients,
        });
        console.log(`[certificados/core] Email: ${emailResult.message}`);
      }
    } catch (err) {
      console.error("[certificados/core] Email send failed (non-blocking):", err);
    }
    // Esperar 60s antes de borrar el blob — Airtable descarga el adjunto async.
    await new Promise((resolve) => setTimeout(resolve, 60000));
    try {
      const { del } = await import("@vercel/blob");
      await del(blobUrl);
      console.log(`[certificados/core] Blob deleted: ${blobUrl}`);
    } catch (err) {
      console.error("[certificados/core] Blob delete failed:", err);
    }
  };

  if (input.after) {
    input.after(backgroundWork);
  } else {
    // Fuera de un request Next (ej. test): ejecutar inline y olvidar errores.
    backgroundWork().catch((err) =>
      console.error("[certificados/core] Background work failed:", err)
    );
  }

  return { consecutivo: pdfProps.consecutivo, pdfUrl: blob.url, r2Url };
}

/**
 * Comportamiento histórico del endpoint /api/certificados/generar: crea +
 * genera + adjunta + programa background work.
 */
export async function crearCertificadoCompleto(
  input: CertificadoInput,
  opts: CertificadoEstadoOpts & { after?: (cb: () => Promise<void>) => void } = {}
): Promise<PDFGenerado & { recordId: string }> {
  const { after, ...estadoOpts } = opts;
  const created = await crearRegistroCertificado(input, estadoOpts);
  const result = await generarYAdjuntarPDF(
    {
      recordId: created.recordId,
      pdfProps: created.pdfProps,
      coordinadorId: input.coordinadorId,
      municipioDevolucionId: input.municipioDevolucionId,
      airtableCreatedTime: created.fullRecord.createdTime,
      after,
    },
    estadoOpts.solicitudOrigen || "portal"
  );
  return { ...result, recordId: created.recordId };
}
