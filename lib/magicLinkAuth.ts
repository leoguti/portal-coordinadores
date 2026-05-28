/**
 * Helper de auth para endpoints que deben aceptar tanto sesión NextAuth
 * como un token de magic-link válido (vía query `?token=XXX`).
 *
 * Útil para endpoints de catálogo (municipios, cultivos) que los formularios
 * de /m/* necesitan consultar sin login.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { leerToken, estaConsumido, estaExpirado } from "@/lib/edicionTokens";

/**
 * Devuelve true si la request tiene sesión NextAuth o un token de magic-link
 * todavía válido (no consumido, no expirado).
 *
 * Uso típico:
 *   if (!(await isAuthorizedOrMagicLink(request))) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 */
export async function isAuthorizedOrMagicLink(request: Request): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (session) return true;

  const url = new URL(request.url);
  const tokenQ = url.searchParams.get("token");
  if (!tokenQ) return false;

  const t = await leerToken(tokenQ);
  if (!t) return false;
  if (estaConsumido(t)) return false;
  if (estaExpirado(t)) return false;
  return true;
}
