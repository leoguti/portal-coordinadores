"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import OrdenServicioPDF from "@/components/pdf/OrdenServicioPDF";

interface ItemOrden {
  id: string;
  tipo: "KARDEX" | "CATALOGO";
  descripcion: string;
  kardexId?: string;
  catalogoId?: string;
  formaCobro: "Por Flete" | "Por Kilo";
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
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

/**
 * Upload PDF buffer to Airtable attachment field
 * Saves PDF to public folder temporarily for Airtable to fetch
 */
export async function uploadPDFToAirtable(
  pdfBuffer: Buffer,
  filename: string
): Promise<Array<{ url: string; filename: string }>> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    
    // Save PDF temporarily to public folder
    const publicPath = path.join(process.cwd(), "public", "temp", filename);
    
    // Ensure temp directory exists
    await fs.mkdir(path.join(process.cwd(), "public", "temp"), { recursive: true });
    
    // Write PDF file
    await fs.writeFile(publicPath, pdfBuffer);
    
    console.log(`PDF saved temporarily at: ${publicPath}`);
    
    // Return URL for Airtable to fetch
    // Airtable will download and store the file
    const publicUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/temp/${filename}`;
    
    return [
      {
        url: publicUrl,
        filename: filename,
      },
    ];
  } catch (error) {
    console.error("Error preparing PDF for Airtable:", error);
    throw new Error("Failed to upload PDF");
  }
}
