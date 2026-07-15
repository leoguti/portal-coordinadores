"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import OrdenServicioPDF from "@/components/pdf/OrdenServicioPDF";

interface ItemOrden {
  id: string;
  tipo: "KARDEX" | "CATALOGO";
  descripcion: string;
  rubroNombre?: string;
  kardexId?: string;
  catalogoId?: string;
  formaCobro: "Por Flete" | "Por Kilo";
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  fotoBasculaUrl?: string;
  fotoBasculaEsPdf?: boolean;
}

interface GeneratePDFParams {
  numeroOrden: number;
  coordinador: {
    nombre: string;
    email: string;
  };
  beneficiario: {
    razonSocial: string;
    nit: string;
    direccion: string;
  };
  fechaPedido: string;
  estado: string;
  items: ItemOrden[];
  total: number;
  observaciones?: string;
  soportesOrden?: Array<{ url: string; filename: string }>;
}

/**
 * Generate PDF buffer for Orden de Servicio
 * Returns base64 encoded PDF ready to upload to Airtable
 */
export async function generateOrdenServicioPDF(
  params: GeneratePDFParams
): Promise<Buffer> {
  try {
    console.log(`Generating PDF for Orden #${params.numeroOrden}...`);

    // Render PDF to buffer
    const buffer = await renderToBuffer(
      <OrdenServicioPDF {...params} />
    );

    console.log(`PDF generated successfully: ${buffer.length} bytes`);
    return buffer;
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw new Error("Failed to generate PDF");
  }
}

/** Documento a fusionar: buffer solo, o buffer con título estampado en cada página */
export type PdfMergeItem = Buffer | { buf: Buffer; titulo: string };

/**
 * Merge multiple PDF buffers into a single PDF using pdf-lib.
 * Pages from each PDF are appended in order. Si el item trae `titulo`,
 * se estampa una franja con ese texto en la parte superior de sus páginas
 * (para identificar a qué registro corresponde cada soporte anexado).
 */
export async function mergePDFs(
  pdfBuffers: PdfMergeItem[],
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

  const mergedPdf = await PDFDocument.create();
  const font = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

  for (const item of pdfBuffers) {
    const buf = Buffer.isBuffer(item) ? item : item.buf;
    const titulo = Buffer.isBuffer(item) ? undefined : item.titulo;
    const doc = await PDFDocument.load(buf);
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    for (const page of pages) {
      mergedPdf.addPage(page);
      if (titulo) {
        const { width, height } = page.getSize();
        const bandH = 24;
        page.drawRectangle({
          x: 0,
          y: height - bandH,
          width,
          height: bandH,
          color: rgb(0.016, 0.153, 0.149), // #042726 CampoLimpio
        });
        const fontSize = 10;
        let texto = titulo;
        // Recortar si no cabe en el ancho de la página
        while (texto.length > 8 && font.widthOfTextAtSize(texto, fontSize) > width - 24) {
          texto = texto.slice(0, -4) + "…";
        }
        page.drawText(texto, {
          x: 12,
          y: height - bandH + 7.5,
          size: fontSize,
          font,
          color: rgb(1, 1, 1),
        });
      }
    }
  }

  const mergedBytes = await mergedPdf.save();
  console.log(`PDFs merged: ${pdfBuffers.length} documents, total ${mergedBytes.length} bytes`);
  return Buffer.from(mergedBytes);
}

/**
 * Save PDF locally to public folder
 */
export async function uploadPDFToAirtable(
  pdfBuffer: Buffer,
  filename: string
): Promise<{ success: boolean; fileUrl?: string }> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    
    // Save PDF to public folder for local access
    const publicPath = path.join(process.cwd(), "public", "temp", filename);
    
    // Ensure temp directory exists
    await fs.mkdir(path.join(process.cwd(), "public", "temp"), { recursive: true });
    
    // Write PDF file
    await fs.writeFile(publicPath, pdfBuffer);
    
    console.log(`PDF saved locally at: ${publicPath}`);
    console.log(`PDF accessible at: /temp/${filename}`);
    
    return {
      success: true,
      fileUrl: `/temp/${filename}`,
    };
  } catch (error) {
    console.error("Error saving PDF:", error);
    throw new Error("Failed to save PDF");
  }
}
