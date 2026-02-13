import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

// Configurar worker de pdf.js para el navegador
if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

const PDF_POINTS_PER_INCH = 72;

// Límite seguro para Vercel serverless (4.5MB body limit, dejamos margen para FormData overhead)
const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024; // 4MB

// Niveles de compresión progresivos: [DPI, calidad JPEG]
const COMPRESSION_LEVELS: [number, number][] = [
  [100, 0.65], // Nivel 1: buena calidad
  [85, 0.50],  // Nivel 2: calidad media
  [72, 0.40],  // Nivel 3: calidad aceptable
  [60, 0.35],  // Nivel 4: último recurso
];

/**
 * Renderiza un PDF a un nuevo PDF con páginas como imágenes JPEG
 * usando los parámetros de DPI y calidad especificados.
 */
async function renderPdfAtQuality(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  dpi: number,
  jpegQuality: number
): Promise<Uint8Array> {
  const newPdf = await PDFDocument.create();

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });

    const scale = dpi / PDF_POINTS_PER_INCH;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext("2d")!;

    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

    const jpegDataUrl = canvas.toDataURL("image/jpeg", jpegQuality);
    const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(",")[1]), (c) => c.charCodeAt(0));

    const jpegImage = await newPdf.embedJpg(jpegBytes);
    const newPage = newPdf.addPage([viewport.width, viewport.height]);
    newPage.drawImage(jpegImage, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height,
    });

    canvas.width = 0;
    canvas.height = 0;
  }

  return await newPdf.save();
}

/**
 * Comprime un PDF renderizando cada página como imagen JPEG.
 * Usa compresión progresiva: intenta la mejor calidad primero,
 * y si el resultado excede 4MB (límite de Vercel), baja la calidad
 * automáticamente hasta que quepa.
 *
 * @param file - Archivo PDF original
 * @param maxSizeMB - Umbral para activar compresión (por defecto 4MB)
 * @returns Archivo PDF comprimido (o el original si ya es pequeño)
 */
export async function compressPdf(file: File, maxSizeMB: number = 4): Promise<File> {
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  for (const [dpi, quality] of COMPRESSION_LEVELS) {
    const compressedBytes = await renderPdfAtQuality(pdfDoc, dpi, quality);

    if (compressedBytes.length <= UPLOAD_LIMIT_BYTES) {
      console.log(
        `PDF comprimido: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressedBytes.length / 1024 / 1024).toFixed(1)}MB (${dpi} DPI, calidad ${quality})`
      );
      return new File([compressedBytes.buffer as ArrayBuffer], file.name, { type: "application/pdf" });
    }

    console.log(
      `Compresión a ${dpi} DPI / calidad ${quality}: ${(compressedBytes.length / 1024 / 1024).toFixed(1)}MB — excede 4MB, intentando más agresivo...`
    );
  }

  // Si ningún nivel logró bajar de 4MB, devolver el último intento (más agresivo)
  const lastLevel = COMPRESSION_LEVELS[COMPRESSION_LEVELS.length - 1];
  const finalBytes = await renderPdfAtQuality(pdfDoc, lastLevel[0], lastLevel[1]);
  console.warn(
    `PDF comprimido al máximo: ${(finalBytes.length / 1024 / 1024).toFixed(1)}MB (puede fallar en upload si > 4MB)`
  );
  return new File([finalBytes.buffer as ArrayBuffer], file.name, { type: "application/pdf" });
}

/**
 * Comprime una imagen redimensionándola si excede el límite
 *
 * @param file - Archivo de imagen original
 * @returns Archivo de imagen comprimido (o el original si ya es pequeño)
 */
export async function compressImage(file: File, maxSizeMB: number = 4): Promise<File> {
  if (file.size <= maxSizeMB * 1024 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
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
