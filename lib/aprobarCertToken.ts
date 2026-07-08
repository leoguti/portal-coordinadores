/**
 * Helpers del enlace mágico de aprobación de certificados (intent
 * "aprobar-cert"). Compartidos por:
 *   - GET/POST /api/m/[token]/aprobar-cert
 *   - POST     /api/m/[token]/rechazar-cert
 *
 * (Viven en lib porque los route files de Next solo pueden exportar handlers.)
 */

import { NextResponse } from "next/server";
import {
  leerToken,
  estaExpirado,
  type EdicionToken,
} from "@/lib/edicionTokens";
import { coordIdsDelCert, type CertRecord } from "@/lib/certificadosDecision";

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;

/**
 * Valida el token del enlace de aprobación (existencia, intent, expiración).
 * Devuelve el token o un NextResponse de error listo para retornar. La
 * verificación de consumido/estado vivo la hace cada handler (el GET quiere
 * responder "ya fue resuelta" con 200, no un error).
 */
export async function validarTokenAprobacion(
  token: string
): Promise<{ t: EdicionToken } | { error: NextResponse }> {
  if (!token || token.length < 16) {
    return {
      error: NextResponse.json({ error: "Token inválido" }, { status: 400 }),
    };
  }
  const t = await leerToken(token);
  if (!t || t.intent !== "aprobar-cert" || !t.recordId) {
    return {
      error: NextResponse.json(
        { error: "Este enlace no es válido.", code: "INVALID" },
        { status: 404 }
      ),
    };
  }
  if (estaExpirado(t)) {
    return {
      error: NextResponse.json(
        {
          error:
            "Este enlace expiró (vence a los 7 días). Puedes gestionar la solicitud desde el portal, en Solicitudes pendientes.",
          code: "EXPIRED",
        },
        { status: 410 }
      ),
    };
  }
  return { t };
}

/** Lee el certificado sin exigir estado (para el GET informativo). */
export async function leerCert(id: string): Promise<CertRecord | null> {
  const r = await fetch(
    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Certificados/${id}`,
    { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }, cache: "no-store" }
  );
  if (!r.ok) return null;
  return r.json() as Promise<CertRecord>;
}

/** Coordinador que decide: el del contexto del token, o el asignado al cert. */
export function coordIdParaDecision(t: EdicionToken, rec: CertRecord): string {
  const ctxCoord = String(
    (t.contexto as { coordinadorId?: unknown }).coordinadorId || ""
  );
  return ctxCoord || coordIdsDelCert(rec)[0] || "";
}
