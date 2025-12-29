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
