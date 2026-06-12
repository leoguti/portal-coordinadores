import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { validarFechaDevolucion } from "@/lib/certificadosReglas";

export const maxDuration = 60;

/**
 * POST /api/certificados/portal
 *
 * Versión del endpoint generar para coordinadores autenticados en el portal.
 * Toma el coordinadorId de la sesión y llama internamente al endpoint /api/certificados/generar.
 *
 * Body esperado (sin coordinadorId — se toma de la sesión):
 * {
 *   fincaId: string,            // esquema nuevo GENERADORES/FINCAS
 *   municipioDevolucionId: string,
 *   rigidos: number,
 *   flexibles: number,
 *   metalicos: number,
 *   embalaje: number,
 *   triplelavado: "SI" | "NO" | "NO APLICA" | "PENDIENTE",
 *   lugardevolucion: string,
 *   fechadevolucion: string,   // YYYY-MM-DD
 *   observaciones?: string
 * }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const coordinadorId = session.user.coordinatorRecordId;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    fincaId,
    municipioDevolucionId,
    rigidos,
    flexibles,
    metalicos,
    embalaje,
    triplelavado,
    lugardevolucion,
    fechadevolucion,
    observaciones,
  } = body as {
    fincaId?: string;
    municipioDevolucionId?: string;
    rigidos?: number;
    flexibles?: number;
    metalicos?: number;
    embalaje?: number;
    triplelavado?: string;
    lugardevolucion?: string;
    fechadevolucion?: string;
    observaciones?: string;
  };

  if (!fincaId || !municipioDevolucionId || !lugardevolucion || !fechadevolucion || !triplelavado) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: fincaId, municipioDevolucionId, lugardevolucion, fechadevolucion, triplelavado" },
      { status: 400 }
    );
  }

  // Política de fechas unificada (lib/certificadosReglas.ts).
  const errorFecha = validarFechaDevolucion(fechadevolucion);
  if (errorFecha) {
    return NextResponse.json({ error: errorFecha }, { status: 400 });
  }

  // Validar al menos un material > 0
  const total = Number(rigidos || 0) + Number(flexibles || 0) + Number(metalicos || 0) + Number(embalaje || 0);
  if (total <= 0) {
    return NextResponse.json({ error: "Debe ingresar al menos un material con cantidad mayor a 0" }, { status: 400 });
  }

  // Llamar al endpoint generar con la API key (server-side, no expone la key al cliente)
  const apiKey = process.env.CERTIFICADOS_API_KEY;
  const baseUrl = process.env.NEXTAUTH_URL || "https://portal.campolimpio.org";

  const generarRes = await fetch(`${baseUrl}/api/certificados/generar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      fincaId,
      coordinadorId,
      municipioDevolucionId,
      rigidos: Number(rigidos || 0),
      flexibles: Number(flexibles || 0),
      metalicos: Number(metalicos || 0),
      embalaje: Number(embalaje || 0),
      triplelavado,
      lugardevolucion,
      fechadevolucion,
      observaciones: observaciones || "",
    }),
  });

  const result = await generarRes.json();

  if (!generarRes.ok) {
    return NextResponse.json(result, { status: generarRes.status });
  }

  return NextResponse.json(result);
}
