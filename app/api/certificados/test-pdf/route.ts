import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import CertificadoPDF from "@/components/pdf/CertificadoPDF";
import React from "react";

export const maxDuration = 60;

// Test endpoint: generates a certificate PDF with sample data
// matching certificado_86025 for visual comparison
export async function GET() {
  try {
    const sampleData = {
      consecutivo: 86025,
      nombregenerador: "BAM SAS",
      cedulagenerador: "860058979",
      movilgenerador: "3212055140",
      direcciongenerador:
        "Aut medellin km 1 5 costado norte bg 2 par empresarial san bernardo",
      cultivogenerador: "distribuidor",
      emailgenerador: "auxiliar.operaciones@bam.com.co",
      municipiogenerador: "Cota - Cundinamarca",
      tipogenerador: "AGRICOLA",
      rigidos: 0,
      flexibles: 0,
      metalicos: 0,
      embalaje: 609,
      total: 609,
      triplelavado: "SI",
      lugardevolucion: "VEREDA PRADO SANTA MARTHA",
      municipiodevolucion: "Facatativá - Cundinamarca",
      fechadevolucion: "2025-05-24",
      nombrecoordinador: "LOGISTICS & SERVICES TRANS E U",
      movilcoordinador: "318 6986460",
      emailcoordinador: "",
      observaciones: "",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(CertificadoPDF, sampleData) as any;
    const buffer = await renderToBuffer(element);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'inline; filename="certificado_test_86025.pdf"',
      },
    });
  } catch (error) {
    console.error("Error generating test PDF:", error);
    return NextResponse.json(
      { error: "Error generating PDF", details: String(error) },
      { status: 500 }
    );
  }
}
