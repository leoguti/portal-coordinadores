import { NextRequest, NextResponse, after } from "next/server";
import {
  crearCertificadoCompleto,
  type CertificadoInput,
} from "@/lib/certificadosCore";

export const maxDuration = 60;

const CERT_API_KEY = process.env.CERTIFICADOS_API_KEY;

// Escape unescaped control chars inside JSON string literals.
// TextIt interpolates @results.observaciones raw, so multiline user input
// produces unescaped \n/\r/\t inside strings that break JSON.parse.
function sanitizeJsonControlChars(raw: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (!inString) {
      if (ch === '"') inString = true;
      out += ch;
      continue;
    }
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      out += ch;
      inString = false;
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code < 0x20) {
      if (ch === "\n") out += "\\n";
      else if (ch === "\r") out += "\\r";
      else if (ch === "\t") out += "\\t";
      else out += "\\u" + code.toString(16).padStart(4, "0");
      continue;
    }
    out += ch;
  }
  return out;
}

function validateApiKey(request: NextRequest): boolean {
  if (!CERT_API_KEY) {
    console.warn(
      "[certificados/generar] CERTIFICADOS_API_KEY not set — allowing request without auth"
    );
    return true;
  }
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === CERT_API_KEY;
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const raw = await request.text();
    let body: CertificadoInput;
    try {
      body = JSON.parse(raw);
    } catch {
      body = JSON.parse(sanitizeJsonControlChars(raw));
    }

    const result = await crearCertificadoCompleto(body, {
      solicitudOrigen: "portal",
      after,
    });

    console.log(
      `[certificados/generar] Certificate ${result.consecutivo} generated successfully`
    );
    return NextResponse.json({
      consecutivo: result.consecutivo,
      recordId: result.recordId,
      pdfUrl: result.pdfUrl,
      status: "ok",
    });
  } catch (error) {
    console.error("[certificados/generar] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    // Mantener compatibilidad con el contrato anterior: errores de validación
    // y de Airtable se devuelven como 400/500 con el detalle.
    if (
      message.startsWith("Faltan campos requeridos") ||
      message.startsWith("La finca")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Error interno generando certificado", details: message },
      { status: 500 }
    );
  }
}
