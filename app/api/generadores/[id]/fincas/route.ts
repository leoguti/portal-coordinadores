import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { esMovilCOValido } from "@/lib/validacionesCO";

export const maxDuration = 30;

/**
 * POST /api/generadores/[id]/fincas
 *
 * Crea una FINCA nueva enlazada a un GENERADOR que YA existe.
 * Caso de uso: el generador ya está registrado, pero le sale una finca
 * adicional. Distinto de /api/generadores/crear (que crea generador
 * Y su primera finca en un solo flujo).
 *
 * Reglas: mismas validaciones que /crear para la sección de finca
 * (móvil colombiano, municipio, ≥ 1 cultivo). El generador no se toca.
 */

interface Body {
  finca?: {
    nombre?: string;
    municipioId?: string;
    cultivoIds?: string[];
    movil?: string;
    email?: string;
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.coordinatorRecordId) {
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

  const { id: generadorId } = await params;
  if (!generadorId) {
    return NextResponse.json(
      { error: "generadorId requerido en la URL" },
      { status: 400 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const f = body.finca || {};
  const nombre = (f.nombre || "").trim();
  const municipioId = (f.municipioId || "").trim();
  const cultivoIds = Array.isArray(f.cultivoIds)
    ? f.cultivoIds.filter((x) => typeof x === "string" && x.trim())
    : [];
  const movil = (f.movil || "").trim();
  const email = (f.email || "").trim();

  const faltan: string[] = [];
  if (!nombre) faltan.push("nombre de la finca");
  if (!municipioId) faltan.push("municipio");
  if (!movil) faltan.push("móvil");
  if (cultivoIds.length === 0) faltan.push("al menos un cultivo");
  if (faltan.length > 0) {
    return NextResponse.json(
      { error: `Faltan campos obligatorios: ${faltan.join(", ")}` },
      { status: 400 }
    );
  }
  if (!esMovilCOValido(movil)) {
    return NextResponse.json(
      { error: "El móvil de la finca no es un celular colombiano válido" },
      { status: 400 }
    );
  }

  // Verificar que el generador existe (sanidad)
  const genRes = await fetch(
    `https://api.airtable.com/v0/${baseId}/GENERADORES/${generadorId}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" }
  );
  if (!genRes.ok) {
    return NextResponse.json(
      { error: "Generador no encontrado" },
      { status: 404 }
    );
  }

  // Crear la finca
  const fincaFields: Record<string, unknown> = {
    nombre,
    generador: [generadorId],
    municipio: [municipioId],
    cultivos: cultivoIds,
    movil,
    email,
    revisado: true,
  };

  try {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/FINCAS`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: fincaFields, typecast: true }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("[generadores/fincas/POST]", t);
      return NextResponse.json(
        { error: "Error creando la finca" },
        { status: 500 }
      );
    }
    const data = await res.json();
    return NextResponse.json(
      { finca: { id: data.id, nombre } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[generadores/fincas/POST] excepción:", err);
    return NextResponse.json(
      { error: "Error creando la finca" },
      { status: 500 }
    );
  }
}
