import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveGeneradorDataFromFinca } from "@/lib/fincaGeneradorResolver";

export const maxDuration = 30;

/**
 * GET /api/certificados/finca-info?fincaId=recXXX
 *
 * Devuelve, para una finca, los datos del generador que se "congelarán" en
 * el certificado. Se usa para mostrar un panel informativo en el formulario
 * antes de generar (mismo resolver que /generar → lo mostrado == lo congelado).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    return NextResponse.json(
      { error: "Airtable no configurado" },
      { status: 500 }
    );
  }

  const fincaId = (req.nextUrl.searchParams.get("fincaId") || "").trim();
  if (!fincaId) {
    return NextResponse.json({ error: "fincaId requerido" }, { status: 400 });
  }

  try {
    const r = await resolveGeneradorDataFromFinca(apiKey, baseId, fincaId);
    return NextResponse.json({
      fincaNombre: r.fincaNombre,
      nombregenerador: r.nombregenerador,
      cedulagenerador: r.cedulagenerador,
      municipiogenerador: r.municipiogenerador,
      cultivogenerador: r.cultivogenerador,
      cultivoIds: r.cultivoIds,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Finca inválida" },
      { status: 400 }
    );
  }
}
