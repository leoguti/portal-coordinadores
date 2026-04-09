import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const maxDuration = 60;

/**
 * POST /api/certificados/portal
 *
 * Versión del endpoint generar para coordinadores autenticados en el portal.
 * Toma el coordinadorId de la sesión y llama internamente al endpoint /api/certificados/generar.
 *
 * Body esperado (sin coordinadorId — se toma de la sesión):
 * {
 *   ubicacionId: string,
 *   municipioDevolucionId: string,
 *   rigidos: number,
 *   flexibles: number,
 *   metalicos: number,
 *   embalaje: number,
 *   triplelavado: "SI" | "NO" | "PENDIENTE",
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

  const { ubicacionId, municipioDevolucionId, rigidos, flexibles, metalicos, embalaje, triplelavado, lugardevolucion, fechadevolucion, observaciones } = body as any;

  if (!ubicacionId || !municipioDevolucionId || !lugardevolucion || !fechadevolucion || !triplelavado) {
    return NextResponse.json(
      { error: "Faltan campos requeridos: ubicacionId, municipioDevolucionId, lugardevolucion, fechadevolucion, triplelavado" },
      { status: 400 }
    );
  }

  // Validar fecha: no futura, no más de 120 días atrás
  const fecha = new Date(fechadevolucion + "T00:00:00");
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const hace120 = new Date(hoy);
  hace120.setDate(hace120.getDate() - 120);

  if (fecha > hoy) {
    return NextResponse.json({ error: "La fecha de devolución no puede ser futura" }, { status: 400 });
  }
  if (fecha < hace120) {
    return NextResponse.json({ error: "La fecha de devolución no puede tener más de 120 días de antigüedad" }, { status: 400 });
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
      ubicacionId,
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
