import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

// Configurar worker de pdf.js para el navegador
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

const TARGET_DPI = 100;
const JPEG_QUALITY = 0.65;
const PDF_POINTS_PER_INCH = 72;

/**
 * Comprime un PDF renderizando cada página como imagen JPEG a 100 DPI
 * y rearmando un nuevo PDF. Equivalente a Ghostscript -dPDFSETTINGS=/ebook.
 *
 * @param file - Archivo PDF original
 * @returns Archivo PDF comprimido (o el original si ya es pequeño)
 */
export async function compressPdf(file: File, maxSizeMB: number = 5): Promise<File> {
  // Si ya es menor al límite, no comprimir
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const newPdf = await PDFDocument.create();

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });

    // Calcular escala para renderizar a TARGET_DPI
    const scale = TARGET_DPI / PDF_POINTS_PER_INCH;
    const scaledViewport = page.getViewport({ scale });

    // Crear canvas para renderizar
    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

    // Exportar como JPEG comprimido
    const jpegDataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(",")[1]), (c) => c.charCodeAt(0));

    // Agregar imagen al nuevo PDF con las dimensiones originales (en puntos)
    const jpegImage = await newPdf.embedJpg(jpegBytes);
    const newPage = newPdf.addPage([viewport.width, viewport.height]);
    newPage.drawImage(jpegImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });

    // Limpiar canvas
    canvas.width = 0;
    canvas.height = 0;
  }

  const compressedBytes = await newPdf.save();
  return new File([compressedBytes.buffer as ArrayBuffer], file.name, { type: "application/pdf" });
}

/**
 * Comprime una imagen redimensionándola si excede el límite
 *
 * @param file - Archivo de imagen original
 * @returns Archivo de imagen comprimido (o el original si ya es pequeño)
 */
export async function compressImage(file: File, maxSizeMB: number = 5): Promise<File> {
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Reducir dimensiones proporcionalmente hasta que quepa
      const maxDim = 1600;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.7
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
