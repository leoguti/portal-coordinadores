import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import CertificadoPDF from "@/components/pdf/CertificadoPDF";
import { sendCertificadoEmail } from "@/lib/sendCertificadoEmail";
import React from "react";

export const maxDuration = 60;

/**
 * Test endpoint: generates a sample PDF and sends it via email.
 *
 * Usage:
 *   GET /api/certificados/test-email?to=your@email.com
 *   GET /api/certificados/test-email?to=email1@test.com,email2@test.com
 *
 * Protected by CERTIFICADOS_API_KEY (query param or header).
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
    const { searchParams } = new URL(request.url);
    const apiKey =
      searchParams.get("key") ||
      request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey || apiKey !== process.env.CERTIFICADOS_API_KEY) {
      return NextResponse.json(
        { error: "No autorizado. Pasa ?key=... o header Authorization: Bearer ..." },
        { status: 401 }
      );
    }

    // Get recipient(s)
    const toParam = searchParams.get("to");
    if (!toParam) {
      return NextResponse.json(
        { error: "Falta parámetro ?to=email@example.com" },
        { status: 400 }
      );
    }
    const emails = toParam.split(",").map((e) => e.trim()).filter(Boolean);

    // 1. Generate a test PDF (same sample data as test-pdf)
    const sampleData = {
      consecutivo: 99999,
      nombregenerador: "EMPRESA TEST S.A.S",
      cedulagenerador: "900123456",
      movilgenerador: "3001234567",
      direcciongenerador: "Calle 100 #15-20, Bogotá",
      cultivogenerador: "Hortalizas",
      emailgenerador: "test@example.com",
      municipiogenerador: "Bogotá D.C. - Cundinamarca",
      tipogenerador: "AGRICOLA",
      rigidos: 10,
      flexibles: 25,
      metalicos: 5,
      embalaje: 50,
      total: 90,
      triplelavado: "SI",
      lugardevolucion: "CENTRO DE ACOPIO PRINCIPAL",
      municipiodevolucion: "Bogotá D.C. - Cundinamarca",
      fechadevolucion: new Date().toISOString().slice(0, 10),
      nombrecoordinador: "COORDINADOR PRUEBA",
      movilcoordinador: "310 9876543",
      emailcoordinador: "coordinador@test.com",
      observaciones: "Este es un certificado de prueba para verificar el correo electrónico.",
    };

    console.log("[test-email] Generating test PDF...");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(CertificadoPDF, sampleData) as any;
    const pdfBuffer = await renderToBuffer(element);
    console.log(`[test-email] PDF generated: ${pdfBuffer.length} bytes`);

    // 2. Send email
    console.log(`[test-email] Sending to: ${emails.join(", ")}`);
    const result = await sendCertificadoEmail({
      consecutivo: 99999,
      pdfBuffer: Buffer.from(pdfBuffer),
      emails,
    });

    if (result.success) {
      return NextResponse.json({
        status: "ok",
        message: result.message,
        pdfSize: pdfBuffer.length,
      });
    } else {
      return NextResponse.json(
        { status: "error", message: result.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[test-email] Error:", error);
    return NextResponse.json(
      { error: "Error en test-email", details: String(error) },
      { status: 500 }
    );
  }
}
