import { NextRequest, NextResponse } from "next/server";
import { createActividad } from "@/lib/airtable";

export const maxDuration = 60;

/**
 * POST /api/actividades/textit
 *
 * Crea una actividad desde TextIt (sin sesión NextAuth).
 * Auth: Authorization: Bearer <TEXTIT_API_KEY>
 *
 * Body:
 * {
 *   coordinadorId: string,   // Airtable record ID del coordinador (@fields.airtableid)
 *   nombre: string,          // Nombre de la actividad
 *   fecha: string,           // YYYY-MM-DD
 *   municipioId?: string,    // Opcional
 * }
 *
 * Response:
 * { ok: true, actividadId: string, qrUrl: string, waUrl: string }
 */
export async function POST(req: NextRequest) {
  // Validate API key
  const auth = req.headers.get("authorization") ?? "";
  const apiKey = process.env.TEXTIT_ACTIVITIES_API_KEY;
  if (!apiKey || auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    coordinadorId?: string;
    nombre?: string;
    fecha?: string;
    municipioId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { coordinadorId, nombre, fecha, municipioId } = body;

  if (!coordinadorId || !nombre || !fecha) {
    return NextResponse.json(
      { error: "coordinadorId, nombre y fecha son requeridos" },
      { status: 400 }
    );
  }

  const actividad = await createActividad({
    coordinatorRecordId: coordinadorId,
    name: nombre,
    fecha,
    descripcion: "",
    tipo: "Sensibilización",
    estado: "En curso",
    municipioId,
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://portal.campolimpio.org";
  const waNumber = "573234688397";
  const waUrl = `https://wa.me/${waNumber}?text=EVAL-${actividad.id}`;
  const qrUrl = `${baseUrl}/api/actividades/qr?actividadId=${actividad.id}`;

  return NextResponse.json({
    ok: true,
    actividadId: actividad.id,
    qrUrl,
    waUrl,
  });
}
