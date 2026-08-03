/**
 * Detección de PDFs con clave — SIN IA, determinístico (pdfjs).
 *
 * Distingue dos casos que se confunden fácil:
 *  - "protegido": pide contraseña para ABRIR (inservible para revisión) → se
 *    rechaza en la subida.
 *  - "restringido": solo tiene restricciones de permisos (imprimir/copiar)
 *    pero abre normal — MUY común en certificaciones bancarias → se acepta.
 */

export type AnalisisPdf = "abierto" | "restringido" | "protegido" | "ilegible";

export function esPdf(filename: string, contentType?: string): boolean {
  return (
    (contentType || "").toLowerCase() === "application/pdf" ||
    filename.toLowerCase().endsWith(".pdf")
  );
}

export async function analizarPdf(buffer: Buffer): Promise<AnalisisPdf> {
  const tieneEncrypt = buffer.includes("/Encrypt");
  try {
    // Build legacy: funciona en Node/serverless sin worker.
    const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
    }).promise;
    await doc.destroy?.();
    return tieneEncrypt ? "restringido" : "abierto";
  } catch (e: any) {
    if (e?.name === "PasswordException") return "protegido";
    return "ilegible";
  }
}

/** Mensaje para el usuario cuando el PDF no sirve (null = PDF aceptable). */
export function motivoRechazoPdf(analisis: AnalisisPdf): string | null {
  if (analisis === "protegido") {
    return "El PDF está protegido con contraseña y no se puede revisar. Pide el archivo sin clave y súbelo de nuevo.";
  }
  if (analisis === "ilegible") {
    return "El PDF no se puede abrir (parece dañado o incompleto). Genera o descarga el archivo de nuevo y vuelve a subirlo.";
  }
  return null;
}
