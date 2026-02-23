import { NextRequest, NextResponse, after } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import CertificadoPDF from "@/components/pdf/CertificadoPDF";
import type { CertificadoPDFProps } from "@/components/pdf/CertificadoPDF";
import React from "react";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Client as PgClient } from "pg";

export const maxDuration = 60;

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const CERT_API_KEY = process.env.CERTIFICADOS_API_KEY;
const R2_PUBLIC_URL =
  process.env.R2_PUBLIC_URL ||
  "https://pub-7ae3d6e965b84710a236072921fe7e61.r2.dev";

interface GenerarRequest {
  ubicacionId: string;
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

// Upload PDF to R2 (permanent storage) - called before response
async function uploadToR2(
  pdfBuffer: Buffer,
  filename: string
): Promise<string> {
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

// Async backup: INSERT into Neon PostgreSQL (runs after response)
async function backupToNeon(
  airtableId: string,
  pdfProps: CertificadoPDFProps,
  pdfBuffer: Buffer,
  r2Url: string | null,
  coordinadorAirtableId: string,
  municipioDevolucionAirtableId: string,
  airtableCreatedTime: string
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
        "portal",
      ]
    );

    await pg.end();
    console.log(`${tag} Certificate #${p.consecutivo} backed up to Neon`);
  } catch (err) {
    console.error(`${tag} Neon backup failed (non-blocking):`, err);
  }
}

// Validate API key from Authorization header
function validateApiKey(request: NextRequest): boolean {
  if (!CERT_API_KEY) {
    console.warn("[certificados/generar] CERTIFICADOS_API_KEY not set — allowing request without auth");
    return true;
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === CERT_API_KEY;
}

export async function POST(request: NextRequest) {
  // 1. Validate API key
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: "No autorizado" },
      { status: 401 }
    );
  }

  let recordId: string | null = null;

  try {
    const body: GenerarRequest = await request.json();

    // Basic validation
    if (!body.ubicacionId || !body.coordinadorId || !body.municipioDevolucionId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: ubicacionId, coordinadorId, municipioDevolucionId" },
        { status: 400 }
      );
    }

    console.log("[certificados/generar] Starting certificate generation...");

    // 2. CREATE record in Airtable (webhook 1)
    console.log("[certificados/generar] Step 1: Creating Airtable record...");
    const createUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados`;
    const createResponse = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          link_ubicacion: [body.ubicacionId],
          coordinador: [body.coordinadorId],
          idmunicipiodevolucion: [body.municipioDevolucionId],
          rigidos: body.rigidos || 0,
          flexibles: body.flexibles || 0,
          metalicos: body.metalicos || 0,
          embalaje: body.embalaje || 0,
          observaciones: body.observaciones || "",
          triplelavado: body.triplelavado || "PENDIENTE",
          lugardevolucion: body.lugardevolucion || "",
          fechadevolucion: body.fechadevolucion || "",
        },
        typecast: true,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[certificados/generar] Airtable create failed:", errorText);
      return NextResponse.json(
        { error: "Error creando registro en Airtable", details: errorText },
        { status: 500 }
      );
    }

    const createData = await createResponse.json();
    recordId = createData.id;
    console.log(`[certificados/generar] Record created: ${recordId}`);

    // 3. READ record back to get calculated/lookup fields (webhook 2)
    console.log("[certificados/generar] Step 2: Reading record with lookups...");
    const readUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${recordId}`;
    const readResponse = await fetch(readUrl, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    if (!readResponse.ok) {
      const errorText = await readResponse.text();
      console.error("[certificados/generar] Airtable read failed:", errorText);
      return NextResponse.json(
        { error: "Error leyendo registro de Airtable", details: errorText },
        { status: 500 }
      );
    }

    const fullRecord = await readResponse.json();
    const f = fullRecord.fields;

    const consecutivo = f.consecutivo;
    console.log(`[certificados/generar] Consecutivo: ${consecutivo}`);

    // 4. Map Airtable fields to PDF props
    const pdfProps: CertificadoPDFProps = {
      consecutivo: consecutivo || 0,
      nombregenerador: (f.nombregenerador || [])[0] || "",
      cedulagenerador: (f.cedulagenerador || [])[0] || "",
      movilgenerador: (f.movilgenerador || [])[0] || "",
      direcciongenerador: (f.direcciongenerador || [])[0] || "",
      cultivogenerador: (f.cultivogenerador || [])[0] || "",
      emailgenerador: (f.emailgenerador || [])[0] || "",
      municipiogenerador: (f.municipiogenerador || [])[0] || "",
      tipogenerador: (f.tipogenerador || [])[0] || "",
      rigidos: f.rigidos || 0,
      flexibles: f.flexibles || 0,
      metalicos: f.metalicos || 0,
      embalaje: f.embalaje || 0,
      total: f.total || 0,
      triplelavado: f.triplelavado || "",
      lugardevolucion: f.lugardevolucion || "",
      municipiodevolucion: (f.municipiodevolucion || [])[0] || "",
      fechadevolucion: f.fechadevolucion || "",
      nombrecoordinador: (f.nombrecoordinador || [])[0] || "",
      movilcoordinador: (f.movilcoordinador || [])[0] || "",
      emailcoordinador: (f.emailcoordinador || [])[0] || "",
      observaciones: f.observaciones || "",
    };

    // 5. Generate PDF with @react-pdf/renderer (webhook 3)
    console.log("[certificados/generar] Step 3: Generating PDF...");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(CertificadoPDF, pdfProps) as any;
    const pdfBuffer = await renderToBuffer(element);
    console.log(`[certificados/generar] PDF generated: ${pdfBuffer.length} bytes`);

    // 6. Upload to Vercel Blob
    console.log("[certificados/generar] Step 4: Uploading to Vercel Blob...");
    const { put, del } = await import("@vercel/blob");
    const filename = `certificado_${consecutivo}.pdf`;
    const blob = await put(filename, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
      addRandomSuffix: true,
    });
    console.log(`[certificados/generar] Blob uploaded: ${blob.url}`);

    // 7. PATCH Airtable with PDF URL (webhook 4)
    console.log("[certificados/generar] Step 5: Attaching PDF to Airtable...");
    const patchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${recordId}`;
    const patchResponse = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          certificadopdf: [{ url: blob.url }],
        },
      }),
    });

    if (!patchResponse.ok) {
      const errorText = await patchResponse.text();
      console.error("[certificados/generar] Airtable PDF attach failed:", errorText);
      await del(blob.url);
      return NextResponse.json(
        { error: "Error adjuntando PDF en Airtable", details: errorText },
        { status: 500 }
      );
    }

    // 8. Async: R2 backup + Neon INSERT + delete blob after 60s
    const blobUrl = blob.url;
    after(async () => {
      let r2Url: string | null = null;
      try {
        r2Url = await uploadToR2(pdfBuffer, filename);
      } catch (err) {
        console.error("[certificados/r2] Upload failed (non-blocking):", err);
      }
      await backupToNeon(
        recordId!,
        pdfProps,
        pdfBuffer,
        r2Url,
        body.coordinadorId,
        body.municipioDevolucionId,
        fullRecord.createdTime
      );
      // Wait 60s for Airtable + TextIt/Telegram to download, then cleanup
      await new Promise((resolve) => setTimeout(resolve, 60000));
      try {
        const { del } = await import("@vercel/blob");
        await del(blobUrl);
        console.log(`[certificados/cleanup] Blob deleted: ${blobUrl}`);
      } catch (err) {
        console.error("[certificados/cleanup] Blob delete failed:", err);
      }
    });

    // 10. Return result
    console.log(`[certificados/generar] Certificate ${consecutivo} generated successfully`);
    return NextResponse.json({
      consecutivo,
      recordId,
      pdfUrl: blob.url,
      status: "ok",
    });
  } catch (error) {
    console.error("[certificados/generar] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Error interno generando certificado",
        details: String(error),
        recordId,
      },
      { status: 500 }
    );
  }
}
